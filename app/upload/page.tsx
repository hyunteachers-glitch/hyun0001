"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { supabase } from "@/lib/supabase/client";
import PasswordGuard from "../components/PasswordGuard";
import type { ImageItem, Webtoon } from "@/lib/types";

type WebtoonItem = Pick<Webtoon, "id" | "title">;

type FailedUpload = {
  fileName: string;
  reason: string;
  file: File;
  uploadedUrl?: string; // R2 업로드는 성공했지만 DB insert만 실패한 경우, 재시도 시 재업로드 생략용
};

const IMAGE_LIMIT = 100;
const LONG_PRESS_MS = 400;
const AUTO_SCROLL_EDGE_PX = 72; // 뷰포트 위/아래 이 픽셀 안쪽이면 자동 스크롤
const AUTO_SCROLL_MAX_SPEED = 18; // 프레임당 최대 스크롤량(px), 가장자리 깊이에 비례해 줄어듦

export default function UploadPage() {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [webtoons, setWebtoons] = useState<WebtoonItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ completed: number; total: number } | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [failedUploads, setFailedUploads] = useState<FailedUpload[]>([]);
  const [lastUploadSummary, setLastUploadSummary] = useState<{ success: number; failed: number } | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMoreImages, setHasMoreImages] = useState(true);

  const [mode, setMode] = useState<"gallery" | "work" | "episode" | "delete">("gallery");
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [mainImageUrl, setMainImageUrl] = useState("");
  const [selectMode, setSelectMode] = useState<"none" | "thumbnail" | "main">("none");

  const [episodeTitle, setEpisodeTitle] = useState("");
  const [selectedWebtoonId, setSelectedWebtoonId] = useState("");
  const [webtoonSearch, setWebtoonSearch] = useState("");
  const [showWebtoonList, setShowWebtoonList] = useState(false);

  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [deleteTargets, setDeleteTargets] = useState<number[]>([]);
  const [rangeMode, setRangeMode] = useState(false);
  const [rangeStartId, setRangeStartId] = useState<number | null>(null);

  // long-press 감지용 — 리렌더가 필요 없는 값이라 상태 대신 ref로만 처리
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFiredRef = useRef(false);

  // 드래그 다중선택용 (삼성 갤러리 방식) — 그리드 컨테이너 참조 + 드래그 상태 추적
  const gridRef = useRef<HTMLDivElement>(null);
  const dragSelectingRef = useRef(false);
  const dragStartIdRef = useRef<number | null>(null);
  const lastDragImageIdRef = useRef<number | null>(null);
  const dragCleanupRef = useRef<(() => void) | null>(null);

  // 가장자리 자동 스크롤용 — 마지막 포인터 좌표 + 현재 스크롤 속도/프레임 핸들
  const lastPointerClientXRef = useRef(0);
  const lastPointerClientYRef = useRef(0);
  const autoScrollSpeedRef = useRef(0);
  const autoScrollFrameRef = useRef<number | null>(null);

  const [episodePreviewMode, setEpisodePreviewMode] = useState(false);
  const [episodePreviewImages, setEpisodePreviewImages] = useState<string[]>([]);
  const [editingOrderIndex, setEditingOrderIndex] = useState<number | null>(null);
  const [orderInput, setOrderInput] = useState("");

  useEffect(() => {
    getImages(true);
    getWebtoons();
  }, []);

  // 드래그 선택 도중 페이지를 벗어나는 등 드문 경우에도 document 리스너가 안 남게 정리
  useEffect(() => {
    return () => {
      dragCleanupRef.current?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resetWork() {
    setTitle("");
    setDescription("");
    setCoverUrl("");
    setMainImageUrl("");
    setSelectMode("none");
    // episode 모드에서 범위선택을 켠 채로 work 모드를 거쳐 gallery로 돌아오면
    // rangeMode가 true로 남아있던 leak을 막기 위해 여기서도 초기화
    setRangeMode(false);
    setRangeStartId(null);
  }

  function resetEpisode() {
    setEpisodeTitle("");
    setSelectedWebtoonId("");
    setWebtoonSearch("");
    setShowWebtoonList(false);
    setSelectedImages([]);
    setRangeMode(false);
    setRangeStartId(null);
    setEpisodePreviewMode(false);
    setEpisodePreviewImages([]);
    setEditingOrderIndex(null);
    setOrderInput("");
  }

  function resetDelete() {
    setDeleteTargets([]);
    setRangeMode(false);
    setRangeStartId(null);
  }

  function normalizeTitle(value: string) {
    return value.trim().toLowerCase();
  }

  async function getImages(reset = false) {
    if (loadingMore) return;

    setLoadingMore(true);

    const start = reset ? 0 : images.length;
    const end = start + IMAGE_LIMIT - 1;

    const { data, error } = await supabase
      .from("images")
      .select("*")
      .order("id", { ascending: false })
      .range(start, end);

    if (error) {
      alert(error.message);
      setLoadingMore(false);
      return;
    }

    const nextImages = data || [];

    if (reset) setImages(nextImages);
    else setImages((prev) => [...prev, ...nextImages]);

    setHasMoreImages(nextImages.length === IMAGE_LIMIT);
    setLoadingMore(false);
  }

  async function getWebtoons() {
    const { data, error } = await supabase
      .from("webtoons")
      .select("id,title")
      .eq("deleted", false)
      .order("updated_at", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    setWebtoons(data || []);
  }

  async function uploadSingleFile(
    file: File,
    accessToken: string
  ): Promise<{ ok: true; url: string } | { ok: false; reason: string }> {
    try {
      // ① 서버에서 presigned URL 발급 (작은 JSON 요청이라 4.5MB 제한과 무관)
      const presignResponse = await fetch("/api/upload-r2-presign", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ fileName: file.name }),
      });

      const presignResult = await presignResponse.json().catch(() => null);

      if (!presignResponse.ok) {
        return {
          ok: false,
          reason: presignResult?.error || `업로드 URL 발급 실패 (${presignResponse.status})`,
        };
      }

      if (!presignResult?.uploadUrl || !presignResult?.publicUrl) {
        return { ok: false, reason: "서버 응답에 업로드 URL이 없어." };
      }

      // ② 발급받은 URL로 브라우저가 R2에 직접 PUT — 서버(Vercel Function)를 거치지 않음
      const putResponse = await fetch(presignResult.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });

      if (!putResponse.ok) {
        return { ok: false, reason: `R2 업로드 실패 (${putResponse.status})` };
      }

      return { ok: true, url: presignResult.publicUrl as string };
    } catch (error) {
      return {
        ok: false,
        reason: error instanceof Error ? error.message : "네트워크 오류로 업로드에 실패했어.",
      };
    }
  }

  async function runUpload(tasks: { file: File; knownUrl?: string }[]) {
    if (tasks.length === 0) return;

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;

    if (!accessToken) {
      alert("로그인이 필요해.");
      return;
    }

    setUploading(true);
    setShowUploadModal(true);
    setFailedUploads([]);
    setLastUploadSummary(null);
    setUploadProgress({ completed: 0, total: tasks.length });

    const chunkSize = 5;
    const failures: FailedUpload[] = [];
    let successCount = 0;
    let completedCount = 0;

    for (let i = 0; i < tasks.length; i += chunkSize) {
      const chunk = tasks.slice(i, i + chunkSize);

      const chunkResults = await Promise.all(
        chunk.map(async (task) => ({
          file: task.file,
          result: task.knownUrl
            ? ({ ok: true, url: task.knownUrl } as const)
            : await uploadSingleFile(task.file, accessToken),
        }))
      );

      for (const item of chunkResults) {
        if (!item.result.ok) {
          failures.push({ fileName: item.file.name, reason: item.result.reason, file: item.file });
        }
      }

      const succeeded = chunkResults.filter(
        (item): item is { file: File; result: { ok: true; url: string } } => item.result.ok
      );

      if (succeeded.length > 0) {
        const { error: insertError } = await supabase
          .from("images")
          .insert(succeeded.map((item) => ({ url: item.result.url })));

        if (insertError) {
          for (const item of succeeded) {
            failures.push({
              fileName: item.file.name,
              reason: `R2 업로드는 성공, DB 저장 실패: ${insertError.message}`,
              file: item.file,
              uploadedUrl: item.result.url,
            });
          }
        } else {
          successCount += succeeded.length;
        }
      }

      completedCount += chunk.length;
      setUploadProgress({ completed: completedCount, total: tasks.length });
    }

    setFailedUploads(failures);
    setLastUploadSummary({ success: successCount, failed: failures.length });

    await getImages(true);
    setUploading(false);
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    await runUpload(Array.from(files).map((file) => ({ file })));
  }

  async function retryFailedUploads() {
    if (failedUploads.length === 0) return;

    await runUpload(
      failedUploads.map((item) => ({ file: item.file, knownUrl: item.uploadedUrl }))
    );
  }

  function getRangeItems(startId: number, endId: number) {
    const startIndex = images.findIndex((image) => image.id === startId);
    const endIndex = images.findIndex((image) => image.id === endId);

    if (startIndex === -1 || endIndex === -1) return [];
    if (startIndex <= endIndex) return images.slice(startIndex, endIndex + 1);

    return images.slice(endIndex, startIndex + 1).reverse();
  }

  function toggleEpisodeImage(item: ImageItem) {
    if (rangeMode) {
      if (rangeStartId === null) {
        setRangeStartId(item.id);
        setSelectedImages([item.url]);
        return;
      }

      const rangeItems = getRangeItems(rangeStartId, item.id);
      setSelectedImages(rangeItems.map((image) => image.url));
      setRangeStartId(null);
      return;
    }

    if (selectedImages.includes(item.url)) {
      setSelectedImages(selectedImages.filter((url) => url !== item.url));
    } else {
      setSelectedImages([...selectedImages, item.url]);
    }
  }

  function toggleDeleteImage(item: ImageItem) {
    if (rangeMode) {
      if (rangeStartId === null) {
        setRangeStartId(item.id);
        setDeleteTargets([item.id]);
        return;
      }

      const rangeItems = getRangeItems(rangeStartId, item.id);
      setDeleteTargets(rangeItems.map((image) => image.id));
      setRangeStartId(null);
      return;
    }

    if (deleteTargets.includes(item.id)) {
      setDeleteTargets(deleteTargets.filter((id) => id !== item.id));
    } else {
      setDeleteTargets([...deleteTargets, item.id]);
    }
  }

  function clearLongPressTimer() {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }

  // clientX/clientY(뷰포트 좌표)는 스크롤 여부와 무관하게 "지금 그 자리에 보이는 카드"를
  // 항상 정확히 가리키므로, pointermove든 자동 스크롤 중이든 이 함수 하나로 재탐지한다.
  function updateDragSelectionAtPoint(clientX: number, clientY: number) {
    if (!dragSelectingRef.current || dragStartIdRef.current === null) return;

    const hit = document.elementFromPoint(clientX, clientY);
    const card = hit?.closest("[data-image-id]");
    if (!(card instanceof HTMLElement)) return;

    const id = Number(card.dataset.imageId);
    if (!Number.isFinite(id) || id === lastDragImageIdRef.current) return;

    lastDragImageIdRef.current = id;

    // rangeMode(범위선택)가 쓰는 것과 동일한 "순서 범위" 로직 재사용 —
    // 시작 카드 ~ 지금 커서 아래 카드 사이에 낀 행이 전부 포함됨.
    // add-only가 아니라 매번 통째로 교체 — 커서가 뒤로 가면 범위도 자연스럽게 줄어듦.
    const rangeItems = getRangeItems(dragStartIdRef.current, id);
    setDeleteTargets(rangeItems.map((image) => image.id));
  }

  // 가장자리로부터 얼마나 깊이 들어왔는지에 비례한 스크롤 속도. 0이면 자동 스크롤 없음.
  function getAutoScrollSpeed(clientY: number) {
    const viewportHeight = window.innerHeight;

    if (clientY < AUTO_SCROLL_EDGE_PX) {
      const depth = (AUTO_SCROLL_EDGE_PX - clientY) / AUTO_SCROLL_EDGE_PX;
      return -Math.ceil(depth * AUTO_SCROLL_MAX_SPEED);
    }

    if (clientY > viewportHeight - AUTO_SCROLL_EDGE_PX) {
      const depth = (clientY - (viewportHeight - AUTO_SCROLL_EDGE_PX)) / AUTO_SCROLL_EDGE_PX;
      return Math.ceil(depth * AUTO_SCROLL_MAX_SPEED);
    }

    return 0;
  }

  function runAutoScrollStep() {
    if (!dragSelectingRef.current || autoScrollSpeedRef.current === 0) {
      autoScrollFrameRef.current = null;
      return;
    }

    window.scrollBy(0, autoScrollSpeedRef.current);
    // 포인터가 안 움직였어도, 스크롤됐으니 같은 좌표 아래 카드는 바뀌었을 수 있다 — 재탐지
    updateDragSelectionAtPoint(lastPointerClientXRef.current, lastPointerClientYRef.current);

    autoScrollFrameRef.current = requestAnimationFrame(runAutoScrollStep);
  }

  function stopAutoScroll() {
    if (autoScrollFrameRef.current !== null) {
      cancelAnimationFrame(autoScrollFrameRef.current);
      autoScrollFrameRef.current = null;
    }
    autoScrollSpeedRef.current = 0;
  }

  function handleDragPointerMove(event: PointerEvent) {
    if (!dragSelectingRef.current) return;

    lastPointerClientXRef.current = event.clientX;
    lastPointerClientYRef.current = event.clientY;

    updateDragSelectionAtPoint(event.clientX, event.clientY);

    const speed = getAutoScrollSpeed(event.clientY);
    autoScrollSpeedRef.current = speed;

    if (speed !== 0 && autoScrollFrameRef.current === null) {
      autoScrollFrameRef.current = requestAnimationFrame(runAutoScrollStep);
    } else if (speed === 0) {
      stopAutoScroll();
    }
  }

  // React의 onTouchMove는 passive라 preventDefault가 안 먹기 때문에 document에 직접 등록
  function preventScrollWhileDragging(event: TouchEvent) {
    if (dragSelectingRef.current) event.preventDefault();
  }

  function endDragSelect() {
    dragSelectingRef.current = false;
    dragStartIdRef.current = null;
    lastDragImageIdRef.current = null;
    stopAutoScroll();

    if (gridRef.current) {
      gridRef.current.style.touchAction = "";
    }

    document.removeEventListener("pointermove", handleDragPointerMove);
    document.removeEventListener("pointerup", endDragSelect);
    document.removeEventListener("pointercancel", endDragSelect);
    document.removeEventListener("touchmove", preventScrollWhileDragging);
    dragCleanupRef.current = null;
  }

  function beginDragSelect(startId: number) {
    if (rangeMode) return; // 범위선택 모드와는 동시에 동작시키지 않음 (기존 rangeMode 로직 보호)

    dragSelectingRef.current = true;
    dragStartIdRef.current = startId;
    lastDragImageIdRef.current = startId;

    // 모바일에서 드래그 도중 페이지가 스크롤되지 않도록
    if (gridRef.current) {
      gridRef.current.style.touchAction = "none";
    }

    document.addEventListener("pointermove", handleDragPointerMove);
    document.addEventListener("pointerup", endDragSelect);
    document.addEventListener("pointercancel", endDragSelect);
    document.addEventListener("touchmove", preventScrollWhileDragging, { passive: false });

    dragCleanupRef.current = endDragSelect;
  }

  // gallery 모드에서만 동작. 포인터를 누르고 있다가 LONG_PRESS_MS를 넘기면
  // delete 모드로 전환 + 그 사진을 바로 선택 상태로 만들고, 드래그 다중선택을 시작한다.
  function startLongPress(item: ImageItem) {
    if (mode !== "gallery") return;

    clearLongPressTimer();
    longPressFiredRef.current = false;

    longPressTimerRef.current = setTimeout(() => {
      longPressFiredRef.current = true;
      setMode("delete");
      toggleDeleteImage(item);
      beginDragSelect(item.id);
    }, LONG_PRESS_MS);
  }

  // 포인터를 뗐거나(pointerup) 카드 밖으로 나갔거나(pointerleave/cancel) 아직 타이머가 안 터졌다면
  // 짧은 탭이었다는 뜻이므로 그냥 취소
  function cancelLongPress() {
    clearLongPressTimer();
  }

  function handleImageClick(item: ImageItem) {
    // long-press로 이미 delete 모드 진입 + 선택까지 끝났다면,
    // 뒤따라오는 이 click은 무시 (안 그러면 toggleDeleteImage가 다시 호출돼 방금 고른 게 바로 해제됨)
    if (longPressFiredRef.current) {
      longPressFiredRef.current = false;
      return;
    }

    if (mode === "gallery") {
      setPreviewImage(item.url);
      return;
    }

    if (mode === "work") {
      if (selectMode === "thumbnail") setCoverUrl(item.url);
      if (selectMode === "main") setMainImageUrl(item.url);
      return;
    }

    if (mode === "episode") {
      toggleEpisodeImage(item);
      return;
    }

    if (mode === "delete") toggleDeleteImage(item);
  }

  function startOrderEdit(index: number) {
    setEditingOrderIndex(index);
    setOrderInput(String(index + 1));
  }

  function applyOrderEdit(index: number) {
    const targetNumber = Number(orderInput);
    const total = episodePreviewImages.length;

    if (!Number.isInteger(targetNumber) || targetNumber < 1 || targetNumber > total) {
      alert(`1부터 ${total} 사이의 숫자를 입력해줘.`);
      return;
    }

    const targetIndex = targetNumber - 1;

    setEpisodePreviewImages((prev) => {
      const next = [...prev];
      const [moved] = next.splice(index, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });

    setEditingOrderIndex(null);
    setOrderInput("");

    setTimeout(() => {
      document
        .getElementById(`preview-image-${targetIndex}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
  }

  function removePreviewImage(index: number) {
    setEpisodePreviewImages((prev) => prev.filter((_, i) => i !== index));
    setEditingOrderIndex(null);
    setOrderInput("");
  }

  async function createWork() {
    const cleanTitle = title.trim();

    if (!cleanTitle) return alert("작품 제목을 입력해줘.");
    if (!coverUrl) return alert("썸네일을 선택해줘.");
    if (!mainImageUrl) return alert("메인사진을 선택해줘.");

    const duplicate = webtoons.some(
      (toon) => normalizeTitle(toon.title) === normalizeTitle(cleanTitle)
    );

    if (duplicate) {
      alert("이미 같은 제목의 작품이 있어.");
      return;
    }

    const { error } = await supabase.from("webtoons").insert([
      {
        title: cleanTitle,
        description: description.trim(),
        cover_url: coverUrl,
        main_image_url: mainImageUrl,
        deleted: false,
        updated_at: new Date().toISOString(),
      },
    ]);

    if (error) {
      if (error.code === "23505") {
        alert("이미 같은 제목의 작품이 있어.");
        return;
      }

      alert(error.message);
      return;
    }

    alert("작품 생성 완료!");

    resetWork();
    setMode("gallery");
    getWebtoons();
  }

  function openEpisodePreview() {
    if (!selectedWebtoonId) return alert("작품을 선택해줘.");
    if (!episodeTitle.trim()) return alert("에피소드 제목을 입력해줘.");
    if (selectedImages.length === 0) return alert("이미지를 선택해줘.");

    setEpisodePreviewImages([...selectedImages]);
    setEpisodePreviewMode(true);
    setEditingOrderIndex(null);
    setOrderInput("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function finalCreateEpisode() {
    if (!selectedWebtoonId) return alert("작품을 선택해줘.");
    if (!episodeTitle.trim()) return alert("에피소드 제목을 입력해줘.");
    if (episodePreviewImages.length === 0) return alert("사진이 없어.");

    const { data: existingEpisodes } = await supabase
      .from("episodes")
      .select("*")
      .eq("webtoon_id", Number(selectedWebtoonId))
      .eq("deleted", false)
      .order("episode_no", { ascending: true })
      .order("id", { ascending: true });

    const nextEpisodeNo = (existingEpisodes?.length || 0) + 1;

    const { data: episodeData, error: episodeError } = await supabase
      .from("episodes")
      .insert([
        {
          webtoon_id: Number(selectedWebtoonId),
          title: episodeTitle.trim(),
          episode_no: nextEpisodeNo,
          cover_url: episodePreviewImages[0],
          deleted: false,
        },
      ])
      .select()
      .single();

    if (episodeError) {
      alert(episodeError.message);
      return;
    }

    const imageRows = episodePreviewImages.map((url, index) => ({
      episode_id: episodeData.id,
      image_url: url,
      image_order: index,
    }));

    const { error: imageError } = await supabase.from("episode_images").insert(imageRows);

    if (imageError) {
      alert(imageError.message);
      return;
    }

    await supabase
      .from("webtoons")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", Number(selectedWebtoonId));

    alert("에피소드 생성 완료!");

    resetEpisode();
  }

  async function completeDelete() {
  if (deleteTargets.length === 0) {
    resetDelete();
    setMode("gallery");
    return;
  }

  const ok = confirm(`${deleteTargets.length}개의 사진을 삭제할까?`);
  if (!ok) return;

  try {
    const targetImages = images.filter((image) =>
      deleteTargets.includes(image.id)
    );

    const filePaths = targetImages
      .map((image) => image.url.split("/webtoon/")[1])
      .filter(Boolean);

    if (filePaths.length > 0) {
      const { error: storageError } = await supabase.storage
        .from("webtoon")
        .remove(filePaths);

      if (storageError) {
        console.error(storageError);
      }
    }

    const { error: deleteError } = await supabase
      .from("images")
      .delete()
      .in("id", deleteTargets);

    if (deleteError) {
      alert(deleteError.message);
      return;
    }

    resetDelete();
    setMode("gallery");

    await getImages(true);
  } catch (error) {
    console.error(error);
    alert("삭제 중 오류가 발생했어.");
  }
}

  const filteredWebtoons =
    webtoonSearch.trim() === ""
      ? webtoons
      : webtoons.filter((toon) =>
          toon.title.toLowerCase().includes(webtoonSearch.toLowerCase())
        );

  const uploadPercent = uploadProgress
    ? Math.round((uploadProgress.completed / uploadProgress.total) * 100)
    : 0;

  if (episodePreviewMode) {
    return (
      <main className="min-h-screen bg-black text-white px-4 md:px-8 py-8">
        <div className="mb-6 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-3xl md:text-5xl font-bold">에피소드 미리보기</h1>
            <p className="text-white/50 mt-2">
              번호를 눌러 순서를 바꾸고, 필요 없는 사진은 제거해줘.
            </p>
          </div>

          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => {
                setEpisodePreviewMode(false);
                setEditingOrderIndex(null);
                setOrderInput("");
              }}
              className={buttonClass}
            >
              취소
            </button>

            <button onClick={finalCreateEpisode} className={activeButtonClass}>
              최종 생성
            </button>
          </div>
        </div>

        <div className="mb-6 border border-white/10 rounded-2xl p-4">
          <p className="text-white/60 text-sm md:text-base">
            선택된 사진 {episodePreviewImages.length}장
          </p>
        </div>

        <div className="flex flex-col gap-5 items-center">
          {episodePreviewImages.map((url, index) => (
            <div
              id={`preview-image-${index}`}
              key={`${url}-${index}`}
              className="w-full md:max-w-[680px] border border-white/15 rounded-2xl overflow-hidden bg-white/[0.03]"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 gap-3">
                {editingOrderIndex === index ? (
                  <div className="flex items-center gap-2">
                    <input
                      value={orderInput}
                      onChange={(e) => setOrderInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") applyOrderEdit(index);
                        if (e.key === "Escape") {
                          setEditingOrderIndex(null);
                          setOrderInput("");
                        }
                      }}
                      className="w-[76px] bg-black border border-white/25 rounded-xl px-3 py-2 text-center outline-none"
                      autoFocus
                    />

                    <button
                      onClick={() => applyOrderEdit(index)}
                      className="border border-white/30 px-3 py-2 rounded-xl text-sm hover:bg-white hover:text-black transition"
                    >
                      이동
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => startOrderEdit(index)}
                    className="font-bold border border-white/20 px-4 py-2 rounded-xl hover:bg-white hover:text-black transition"
                  >
                    {index + 1}
                  </button>
                )}

                <button
                  onClick={() => removePreviewImage(index)}
                  className="border border-red-500 text-red-400 px-3 py-2 rounded-xl text-sm hover:bg-red-500 hover:text-white transition"
                >
                  제거
                </button>
              </div>

              <img
                src={url}
                alt=""
                loading="lazy"
                className="w-full h-auto object-contain"
              />
            </div>
          ))}
        </div>
      </main>
    );
  }

  return (
    <PasswordGuard>
    <main className="min-h-screen bg-black text-white px-4 md:px-8 py-8">
      <div className="flex flex-col gap-6 mb-8">
        <div className="flex gap-3 flex-wrap">
          <Link href="/library" className={buttonClass}>
            LIBRARY
          </Link>

          <label className={buttonClass}>
            갤러리 추가
            <input type="file" multiple onChange={handleUpload} className="hidden" />
          </label>

          <button
            onClick={() => {
              if (mode === "work") {
                resetWork();
                setMode("gallery");
              } else {
                resetWork();
                setMode("work");
              }
            }}
            className={mode === "work" ? activeButtonClass : buttonClass}
          >
            작품 생성
          </button>

          <button
            onClick={() => {
              if (mode === "episode") {
                resetEpisode();
                setMode("gallery");
              } else {
                resetEpisode();
                setMode("episode");
              }
            }}
            className={mode === "episode" ? activeButtonClass : buttonClass}
          >
            에피소드 생성
          </button>

        </div>
      </div>

      {mode === "work" && (
        <div className="mb-8 max-w-[900px] flex flex-col gap-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="작품 제목"
            className={inputClass}
          />

          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="작품 설명"
            className={`${inputClass} min-h-[100px] resize-y`}
          />

          <div className="flex gap-3 flex-wrap">
            <button
              onClick={() => setSelectMode("thumbnail")}
              className={
                selectMode === "thumbnail" ? activeButtonClass : buttonClass
              }
            >
              썸네일 선택
            </button>

            <button
              onClick={() => setSelectMode("main")}
              className={selectMode === "main" ? activeButtonClass : buttonClass}
            >
              메인사진 선택
            </button>
          </div>

          <div className="flex gap-6 flex-wrap">
            {coverUrl && (
              <div>
                <p className="mb-2 text-white/60">썸네일</p>
                <img
                  src={coverUrl}
                  alt=""
                  className="w-[120px] h-[120px] object-cover rounded-xl border border-white/20"
                />
              </div>
            )}

            {mainImageUrl && (
              <div>
                <p className="mb-2 text-white/60">메인사진</p>
                <img
                  src={mainImageUrl}
                  alt=""
                  className="w-[240px] h-[120px] object-cover rounded-xl border border-white/20"
                />
              </div>
            )}
          </div>

          <button onClick={createWork} className={buttonClass}>
            작품 만들기
          </button>
        </div>
      )}

      {mode === "episode" && (
        <div className="mb-8 max-w-[720px] flex flex-col gap-3">
          <div className="relative">
            <input
              value={webtoonSearch}
              onClick={() => setShowWebtoonList((prev) => !prev)}
              onChange={(e) => {
                setWebtoonSearch(e.target.value);
                setSelectedWebtoonId("");
                setShowWebtoonList(true);
              }}
              placeholder="작품 검색"
              className={inputClass}
            />

            {showWebtoonList && (
              <div className="absolute left-0 right-0 top-[100%] mt-2 bg-black border border-white/15 rounded-2xl overflow-hidden max-h-[280px] overflow-y-auto z-50">
                {filteredWebtoons.length === 0 && (
                  <div className="px-4 py-3 text-white/40">
                    검색 결과가 없어.
                  </div>
                )}

                {filteredWebtoons.map((toon) => (
                  <button
                    key={toon.id}
                    onClick={() => {
                      setSelectedWebtoonId(String(toon.id));
                      setWebtoonSearch(toon.title);
                      setShowWebtoonList(false);
                    }}
                    className={`w-full text-left px-4 py-3 border-b border-white/5 hover:bg-white hover:text-black transition ${
                      selectedWebtoonId === String(toon.id)
                        ? "bg-white text-black"
                        : "bg-black text-white"
                    }`}
                  >
                    {toon.title}
                  </button>
                ))}
              </div>
            )}
          </div>

          <input
            value={episodeTitle}
            onChange={(e) => setEpisodeTitle(e.target.value)}
            placeholder="에피소드 제목"
            className={inputClass}
          />

          <div className="flex gap-3 flex-wrap">
            <button onClick={openEpisodePreview} className={buttonClass}>
              에피소드 만들기
            </button>

            <button
              onClick={() => {
                setRangeMode(!rangeMode);
                setRangeStartId(null);
              }}
              className={rangeMode ? activeButtonClass : buttonClass}
            >
              {rangeMode ? "범위선택 중" : "범위선택"}
            </button>
          </div>
        </div>
      )}

      {/* delete 모드 전용 범위선택 UI 제거 — episode 모드의 범위선택은 그대로 유지 */}

      <div ref={gridRef} className="grid grid-cols-3 md:grid-cols-10 gap-px bg-black">
        {images.map((item) => {
          const selected = selectedImages.includes(item.url);
          const deleteSelected = deleteTargets.includes(item.id);
          const episodeOrder = selectedImages.indexOf(item.url) + 1;
          const deleteOrder = deleteTargets.indexOf(item.id) + 1;
          const isThumbnail = coverUrl === item.url;
          const isMain = mainImageUrl === item.url;
          const isRangeStart = rangeStartId === item.id;

          let badgeText = "";
          if (isThumbnail && isMain) badgeText = "썸네일 · 메인";
          else if (isThumbnail) badgeText = "썸네일";
          else if (isMain) badgeText = "메인";

          return (
            <button
              key={item.id}
              data-image-id={item.id}
              onClick={() => handleImageClick(item)}
              onPointerDown={() => startLongPress(item)}
              onPointerUp={cancelLongPress}
              onPointerLeave={cancelLongPress}
              onPointerCancel={cancelLongPress}
              onContextMenu={(e) => e.preventDefault()}
              onDragStart={(e) => e.preventDefault()}
              className={`relative aspect-square overflow-hidden select-none ${
                selected || deleteSelected || isThumbnail || isMain || isRangeStart
                  ? "ring-2 ring-inset ring-red-500"
                  : ""
              }`}
              style={{ WebkitTouchCallout: "none" }}
            >
              <Image
                src={item.url}
                alt=""
                fill
                sizes="(max-width: 768px) 33vw, 10vw"
                loading="lazy"
                draggable={false}
                className="object-cover"
              />

              {selected && mode === "episode" && (
                <div className="absolute top-1 right-1 w-7 h-7 bg-red-500 text-white flex items-center justify-center font-bold">
                  {episodeOrder}
                </div>
              )}

              {deleteSelected && mode === "delete" && (
                <div className="absolute top-1 right-1 w-7 h-7 bg-red-500 text-white flex items-center justify-center font-bold">
                  {deleteOrder}
                </div>
              )}

              {isRangeStart && rangeMode && (
                <div className="absolute left-1 top-1 bg-white text-black text-[10px] font-bold px-2 py-1 rounded-md">
                  시작
                </div>
              )}

              {badgeText && (
                <div className="absolute right-1 bottom-1 bg-white text-black text-[10px] font-bold px-2 py-1 rounded-md">
                  {badgeText}
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-10 flex justify-center">
        {hasMoreImages ? (
          <button
            onClick={() => getImages(false)}
            disabled={loadingMore}
            className="border border-white/30 px-6 py-3 rounded-full hover:bg-white hover:text-black transition disabled:opacity-40"
          >
            {loadingMore ? "불러오는 중..." : "사진 더보기"}
          </button>
        ) : (
          <p className="text-white/35">모든 사진을 불러왔어.</p>
        )}
      </div>

      {mode === "delete" && (
        <div className="fixed bottom-6 right-4 md:right-8 z-40 flex gap-3">
          <button
            onClick={() => {
              resetDelete();
              setMode("gallery");
            }}
            className={`${buttonClass} shadow-lg shadow-black/50`}
            aria-label="삭제 취소"
            title="삭제 취소"
          >
            취소
          </button>

          <button
            onClick={completeDelete}
            className={`${deleteActiveClass} shadow-lg shadow-black/50`}
          >
            {deleteTargets.length > 0 ? `삭제 (${deleteTargets.length})` : "삭제 완료"}
          </button>
        </div>
      )}

      {showUploadModal && (
        <div className="fixed inset-0 z-[9999] bg-black/70 flex items-center justify-center p-5">
          <div className="w-full max-w-sm bg-black border border-white/20 rounded-2xl p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">{uploading ? "업로드 중" : "업로드 완료"}</h3>

              <button
                onClick={() => setShowUploadModal(false)}
                className="text-white/50 hover:text-white transition text-xl leading-none"
              >
                ×
              </button>
            </div>

            {uploading && uploadProgress && (
              <>
                <p className="text-white/70 text-sm">
                  {uploadProgress.completed} / {uploadProgress.total}장 업로드 중... {uploadPercent}%
                </p>

                <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-white transition-all duration-300"
                    style={{ width: `${uploadPercent}%` }}
                  />
                </div>
              </>
            )}

            {!uploading && lastUploadSummary && (
              <div className="flex flex-col gap-3">
                <p className="text-white/70">
                  완료: 성공 {lastUploadSummary.success}장
                  {lastUploadSummary.failed > 0 && `, 실패 ${lastUploadSummary.failed}장`}
                </p>

                {failedUploads.length > 0 && (
                  <>
                    <ul className="text-red-400 text-sm flex flex-col gap-1 max-h-[240px] overflow-y-auto">
                      {failedUploads.map((item, index) => (
                        <li key={`${item.fileName}-${index}`}>
                          {item.fileName} — {item.reason}
                        </li>
                      ))}
                    </ul>

                    <button
                      onClick={retryFailedUploads}
                      className="border border-white px-4 py-2 rounded-full self-start hover:bg-white hover:text-black transition"
                    >
                      실패한 {failedUploads.length}장 재시도
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {previewImage && (
        <div className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center p-5">
          <button
            onClick={() => setPreviewImage(null)}
            className="absolute top-5 right-5 border border-white px-5 py-2 rounded-full"
          >
            닫기
          </button>

          <img
            src={previewImage}
            alt=""
            className="max-w-[92vw] max-h-[90vh] object-contain"
          />
        </div>
      )}
    </main>
    </PasswordGuard>
  );
}

const buttonClass =
  "border border-white px-5 py-3 rounded-full bg-black text-white cursor-pointer text-base no-underline hover:bg-white hover:text-black transition";

const activeButtonClass =
  "border border-white px-5 py-3 rounded-full bg-white text-black cursor-pointer text-base transition";

const deleteActiveClass =
  "border border-red-500 px-5 py-3 rounded-full bg-red-500 text-white cursor-pointer text-base transition";

const inputClass =
  "border border-white/25 rounded-2xl px-4 py-3 bg-black text-white text-base outline-none w-full";