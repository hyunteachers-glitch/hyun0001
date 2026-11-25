"use client";

import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Upload, BookPlus, LayoutPanelTop, CirclePlus } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import PasswordGuard from "../components/PasswordGuard";
import type { ImageItem, Webtoon } from "@/lib/types";
import { cleanTitle } from "@/lib/title";
import { findWebtoonByTitle } from "@/lib/queries";

type WebtoonItem = Pick<Webtoon, "id" | "title">;

type FailedUpload = {
  fileName: string;
  reason: string;
  file: File;
  uploadedUrl?: string; // R2 업로드는 성공했지만 DB insert만 실패한 경우, 재시도 시 재업로드 생략용
};

// 사진 목록 불러오기 장수
// - 처음(및 업로드/삭제 후 새로고침) 보이는 장수는 모바일/PC가 다름
// - "사진 더보기"로 추가되는 장수는 모바일/PC 공통
const INITIAL_IMAGE_COUNT_MOBILE = 120; // 3열 × 40줄
const INITIAL_IMAGE_COUNT_DESKTOP = 100; // 10열 × 10줄
const LOAD_MORE_IMAGE_COUNT = 100;
// 모바일 판정 — 그리드가 3열(grid-cols-3)로 보이는 Tailwind md(768px) 미만과 같은 기준
const MOBILE_MEDIA_QUERY = "(max-width: 767px)";

function getInitialImageCount() {
  if (typeof window === "undefined") return INITIAL_IMAGE_COUNT_DESKTOP;
  return window.matchMedia(MOBILE_MEDIA_QUERY).matches
    ? INITIAL_IMAGE_COUNT_MOBILE
    : INITIAL_IMAGE_COUNT_DESKTOP;
}
const LONG_PRESS_MS = 400;
const AUTO_SCROLL_EDGE_PX = 72; // 뷰포트 위/아래 이 픽셀 안쪽이면 자동 스크롤
// 자동 스크롤 속도는 "초당 px" — 프레임 간 경과 시간을 곱해서 주사율(60/120Hz)·프레임 드랍과 무관하게 일정
const AUTO_SCROLL_MIN_SPEED = 60; // 가장자리 영역에 막 들어왔을 때(px/s)
const AUTO_SCROLL_MAX_SPEED = 1100; // 화면 끝에 닿았을 때(px/s) — 기존 60Hz 기준 프레임당 18px과 비슷
const AUTO_SCROLL_MAX_DT_MS = 50; // 프레임이 크게 밀려도(탭 전환 등) 한 번에 튀지 않게 상한
const UPLOAD_CONCURRENCY = 10; // 한 번에(배치 단위로) 업로드하는 사진 수

// 썸네일 — 400×400 정사각형, 가운데 기준 cover 크롭, webp
const THUMB_SIZE = 400;
const THUMB_QUALITY = 0.8;
// 원본 업로드는 10개 동시지만, 디코딩(사진 1장당 수십 MB 비트맵)은 메모리를 많이 쓰므로
// 썸네일 "생성"만 이 개수로 제한. 생성된 webp(수십 KB)의 PUT은 제한 없이 진행.
const THUMB_GEN_CONCURRENCY = 2;

let thumbGenActive = 0;
const thumbGenQueue: (() => void)[] = [];

async function withThumbGenSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (thumbGenActive >= THUMB_GEN_CONCURRENCY) {
    await new Promise<void>((resolve) => thumbGenQueue.push(resolve));
  }
  thumbGenActive++;
  try {
    return await fn();
  } finally {
    thumbGenActive--;
    thumbGenQueue.shift()?.();
  }
}

async function createThumbnailBlob(file: File): Promise<Blob> {
  return withThumbGenSlot(async () => {
    // HEIC 등 디코딩 불가 형식이면 여기서 throw → 호출부에서 조용히 건너뜀
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const canvas = document.createElement("canvas");

    try {
      const { width, height } = bitmap;
      if (!width || !height) throw new Error("이미지 크기를 읽을 수 없음");

      // object-cover와 같은 모양: 짧은 변 기준 정사각형을 가운데에서 잘라냄
      const side = Math.min(width, height);
      const sx = (width - side) / 2;
      const sy = (height - side) / 2;

      canvas.width = THUMB_SIZE;
      canvas.height = THUMB_SIZE;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas 2d 컨텍스트 생성 실패");

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, THUMB_SIZE, THUMB_SIZE);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/webp", THUMB_QUALITY)
      );

      // webp 인코딩 미지원 브라우저는 PNG 등으로 대체 인코딩하므로 type으로 확인
      if (!blob || blob.type !== "image/webp") {
        throw new Error("webp 인코딩 미지원");
      }

      return blob;
    } finally {
      bitmap.close();
      // 캔버스 백버퍼 즉시 해제
      canvas.width = 0;
      canvas.height = 0;
    }
  });
}

// 썸네일 생성+업로드. 어떤 실패도 throw하지 않음 — 원본 업로드 결과에 영향 X
// (빠진 썸네일은 나중에 일괄 스크립트가 채우고, 화면은 onError로 원본에 대체됨)
async function uploadThumbnail(file: File, thumbUploadUrl: string) {
  try {
    const blob = await createThumbnailBlob(file);
    const res = await fetch(thumbUploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
      body: blob,
    });
    if (!res.ok) throw new Error(`썸네일 PUT 실패 (${res.status})`);
  } catch (error) {
    console.warn(`[thumbnail] ${file.name} 썸네일 건너뜀:`, error);
  }
}

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

  // long-press 감지용 — 리렌더가 필요 없는 값이라 상태 대신 ref로만 처리
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFiredRef = useRef(false);

  // 드래그 다중선택용 (삼성 갤러리 방식) — 그리드 컨테이너 참조 + 드래그 상태 추적
  const gridRef = useRef<HTMLDivElement>(null);
  const dragSelectingRef = useRef(false);
  const dragStartIdRef = useRef<number | null>(null);
  const lastDragImageIdRef = useRef<number | null>(null);
  const dragCleanupRef = useRef<(() => void) | null>(null);
  // 이번 드래그가 delete 모드(deleteTargets)용인지 episode 모드(selectedImages)용인지
  const dragKindRef = useRef<"delete" | "episode" | null>(null);

  // 드래그 프레임 루프용 — 마지막 포인터 좌표 + rAF 핸들 + 시간 기반 자동 스크롤 상태
  const lastPointerClientXRef = useRef(0);
  const lastPointerClientYRef = useRef(0);
  const pointerDirtyRef = useRef(false); // 포인터가 움직였거나 스크롤돼서 "아래 카드"를 다시 찾아야 하는지
  const dragFrameRef = useRef<number | null>(null);
  const autoScrollLastTimeRef = useRef<number | null>(null);
  const autoScrollRemainderRef = useRef(0); // 1px 미만 이동량 누적

  const [episodePreviewMode, setEpisodePreviewMode] = useState(false);
  const [episodePreviewImages, setEpisodePreviewImages] = useState<string[]>([]);
  const [editingOrderIndex, setEditingOrderIndex] = useState<number | null>(null);
  const [orderInput, setOrderInput] = useState("");

  // 드래그 중 document 리스너/rAF 루프는 시작 시점의 클로저로 돌기 때문에,
  // 최신 목록과 id→인덱스 맵을 ref로 들고 있어서 범위 계산을 인덱스 조회로 처리
  const imageIndexMap = useMemo(
    () => new Map(images.map((image, index) => [image.id, index])),
    [images]
  );
  const imagesRef = useRef(images);
  const imageIndexMapRef = useRef(imageIndexMap);
  useLayoutEffect(() => {
    imagesRef.current = images;
    imageIndexMapRef.current = imageIndexMap;
  }, [images, imageIndexMap]);

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

  // 업로드 페이지에 있는 동안만 루트 스크롤의 overscroll 동작(당겨서 새로고침/바운스 체인)을 막는다.
  // 떠날 때 원래 인라인 값으로 되돌려서 다른 페이지에는 영향이 없게 함.
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.overscrollBehaviorY;
    const prevBody = body.style.overscrollBehaviorY;

    html.style.overscrollBehaviorY = "contain";
    body.style.overscrollBehaviorY = "contain";

    return () => {
      html.style.overscrollBehaviorY = prevHtml;
      body.style.overscrollBehaviorY = prevBody;
    };
  }, []);

  // 드래그 선택 중 터치 스크롤/당겨서 새로고침 차단용 touchmove 리스너.
  // 롱프레스가 터진 뒤(터치 도중)에 등록하면, 크롬 계열은 touchstart 시점에 "막을 수 있는 리스너가 없던"
  // 터치를 끝까지 취소 불가(cancelable=false)로 보내서 preventDefault가 무시된다.
  // 그래서 페이지에 있는 동안 non-passive로 계속 등록해 두고, 드래그 선택 중일 때만 막는다
  // (롱프레스 전 단계에서 손가락을 움직이면 그대로 일반 스크롤).
  useEffect(() => {
    function preventScrollWhileDragging(event: TouchEvent) {
      if (dragSelectingRef.current && event.cancelable) event.preventDefault();
    }

    document.addEventListener("touchmove", preventScrollWhileDragging, { passive: false });
    return () => {
      document.removeEventListener("touchmove", preventScrollWhileDragging);
    };
  }, []);

  function resetWork() {
    setTitle("");
    setDescription("");
    setCoverUrl("");
    setMainImageUrl("");
    setSelectMode("none");
  }

  function resetEpisode() {
    setEpisodeTitle("");
    setSelectedWebtoonId("");
    setWebtoonSearch("");
    setShowWebtoonList(false);
    setSelectedImages([]);
    setEpisodePreviewMode(false);
    setEpisodePreviewImages([]);
    setEditingOrderIndex(null);
    setOrderInput("");
  }

  function resetDelete() {
    setDeleteTargets([]);
  }

  async function getImages(reset = false) {
    if (loadingMore) return;

    setLoadingMore(true);

    const count = reset ? getInitialImageCount() : LOAD_MORE_IMAGE_COUNT;
    const start = reset ? 0 : images.length;
    const end = start + count - 1;

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

    setHasMoreImages(nextImages.length === count);
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
        headers: {
          "Content-Type": file.type || "application/octet-stream",
          // 키가 매번 새로 생성되므로(타임스탬프+UUID) 같은 주소의 내용이 바뀌지 않음 → immutable 안전
          "Cache-Control": "public, max-age=31536000, immutable",
        },
        body: file,
      });

      if (!putResponse.ok) {
        return { ok: false, reason: `R2 업로드 실패 (${putResponse.status})` };
      }

      // ③ 원본 성공 후 썸네일 생성+업로드 — 실패해도 원본은 성공 처리(내부에서 예외를 삼킴)
      if (typeof presignResult.thumbUploadUrl === "string" && presignResult.thumbUploadUrl) {
        await uploadThumbnail(file, presignResult.thumbUploadUrl);
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

    const chunkSize = UPLOAD_CONCURRENCY;
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
    const list = imagesRef.current;
    const startIndex = imageIndexMapRef.current.get(startId) ?? -1;
    const endIndex = imageIndexMapRef.current.get(endId) ?? -1;

    if (startIndex === -1 || endIndex === -1) return [];
    if (startIndex <= endIndex) return list.slice(startIndex, endIndex + 1);

    return list.slice(endIndex, startIndex + 1).reverse();
  }

  // 함수형 업데이트 — 롱프레스 타이머(0.4초 뒤 실행)처럼 오래된 클로저에서 불려도 최신 상태 기준
  function toggleEpisodeImage(item: ImageItem) {
    setSelectedImages((prev) =>
      prev.includes(item.url) ? prev.filter((url) => url !== item.url) : [...prev, item.url]
    );
  }

  // 롱프레스로 드래그 다중선택을 시작할 때만 사용 — 이미 선택돼 있으면 그대로 두고
  // (토글하지 않음) 없을 때만 추가한다. episode 모드는 이미 몇 장 선택된 상태에서
  // 롱프레스를 시작할 수 있어서, 토글을 쓰면 "이미 선택된 사진을 롱프레스했더니
  // 해제되며 드래그가 시작"되는 어색한 상황이 생길 수 있어 별도로 분리함.
  function ensureEpisodeSelected(item: ImageItem) {
    setSelectedImages((prev) => (prev.includes(item.url) ? prev : [...prev, item.url]));
  }

  function toggleDeleteImage(item: ImageItem) {
    setDeleteTargets((prev) =>
      prev.includes(item.id) ? prev.filter((id) => id !== item.id) : [...prev, item.id]
    );
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
    if (!dragSelectingRef.current || dragStartIdRef.current === null || !dragKindRef.current) return;

    const hit = document.elementFromPoint(clientX, clientY);
    const card = hit?.closest("[data-image-id]");
    if (!(card instanceof HTMLElement)) return;

    const id = Number(card.dataset.imageId);
    if (!Number.isFinite(id) || id === lastDragImageIdRef.current) return;

    lastDragImageIdRef.current = id;

    // 시작 카드 ~ 지금 커서 아래 카드 사이에 낀 행이 전부 포함되는 "순서 범위" 로직.
    // add-only가 아니라 매번 통째로 교체 — 커서가 뒤로 가면 범위도 자연스럽게 줄어듦.
    const rangeItems = getRangeItems(dragStartIdRef.current, id);

    if (dragKindRef.current === "delete") {
      setDeleteTargets(rangeItems.map((image) => image.id));
    } else {
      setSelectedImages(rangeItems.map((image) => image.url));
    }
  }

  // 가장자리로부터 얼마나 깊이 들어왔는지(0~1)에 가속 곡선(제곱)을 적용한 속도(px/s).
  // 끝에 가까울수록 부드럽게 빨라짐. 0이면 자동 스크롤 없음.
  function getAutoScrollSpeed(clientY: number, viewportHeight: number) {
    let depth = 0;
    let direction = 0;

    if (clientY < AUTO_SCROLL_EDGE_PX) {
      depth = (AUTO_SCROLL_EDGE_PX - clientY) / AUTO_SCROLL_EDGE_PX;
      direction = -1;
    } else if (clientY > viewportHeight - AUTO_SCROLL_EDGE_PX) {
      depth = (clientY - (viewportHeight - AUTO_SCROLL_EDGE_PX)) / AUTO_SCROLL_EDGE_PX;
      direction = 1;
    }

    if (direction === 0) return 0;

    const t = Math.min(1, Math.max(0, depth)); // 포인터가 창 밖으로 나가도 최대 속도로 제한
    return direction * (AUTO_SCROLL_MIN_SPEED + (AUTO_SCROLL_MAX_SPEED - AUTO_SCROLL_MIN_SPEED) * t * t);
  }

  function scheduleDragFrame() {
    if (dragFrameRef.current === null) {
      dragFrameRef.current = requestAnimationFrame(runDragFrame);
    }
  }

  // 드래그 중 프레임마다 한 번만 도는 루프. 강제 리플로우를 피하려고
  // ① 읽기(elementFromPoint, innerHeight)를 먼저 끝내고 ② 쓰기(scrollBy)는 마지막에 한 번만 한다.
  // 이번 프레임의 스크롤 결과는 다음 프레임 읽기 단계에서(레이아웃이 정리된 상태로) 반영된다.
  function runDragFrame(now: number) {
    dragFrameRef.current = null;
    if (!dragSelectingRef.current) return;

    // ── 읽기 단계 ──
    const x = lastPointerClientXRef.current;
    const y = lastPointerClientYRef.current;

    if (pointerDirtyRef.current) {
      pointerDirtyRef.current = false;
      updateDragSelectionAtPoint(x, y);
    }

    const speed = getAutoScrollSpeed(y, window.innerHeight);

    // ── 쓰기 단계 ──
    if (speed === 0) {
      // 가장자리를 벗어남 — 루프 정지(다음 pointermove가 다시 깨움)
      autoScrollLastTimeRef.current = null;
      autoScrollRemainderRef.current = 0;
      return;
    }

    const lastTime = autoScrollLastTimeRef.current;
    autoScrollLastTimeRef.current = now;

    if (lastTime !== null) {
      const dt = Math.min(now - lastTime, AUTO_SCROLL_MAX_DT_MS) / 1000;
      autoScrollRemainderRef.current += speed * dt;

      const step = Math.trunc(autoScrollRemainderRef.current);
      if (step !== 0) {
        autoScrollRemainderRef.current -= step;
        window.scrollBy({ top: step, behavior: "instant" });
        // 포인터가 안 움직였어도 스크롤됐으니 같은 좌표 아래 카드는 바뀌었을 수 있다 — 다음 프레임에 재탐지
        pointerDirtyRef.current = true;
      }
    }

    scheduleDragFrame();
  }

  function stopDragFrame() {
    if (dragFrameRef.current !== null) {
      cancelAnimationFrame(dragFrameRef.current);
      dragFrameRef.current = null;
    }
    autoScrollLastTimeRef.current = null;
    autoScrollRemainderRef.current = 0;
    pointerDirtyRef.current = false;
  }

  // pointermove는 한 프레임에 여러 번 올 수 있으므로 좌표만 기록하고, 실제 처리는 프레임 루프에 맡긴다
  function handleDragPointerMove(event: PointerEvent) {
    if (!dragSelectingRef.current) return;

    lastPointerClientXRef.current = event.clientX;
    lastPointerClientYRef.current = event.clientY;
    pointerDirtyRef.current = true;
    scheduleDragFrame();
  }

  function endDragSelect() {
    dragSelectingRef.current = false;
    dragKindRef.current = null;
    dragStartIdRef.current = null;
    lastDragImageIdRef.current = null;
    stopDragFrame();

    if (gridRef.current) {
      gridRef.current.style.touchAction = "";
    }

    document.removeEventListener("pointermove", handleDragPointerMove);
    document.removeEventListener("pointerup", endDragSelect);
    document.removeEventListener("pointercancel", endDragSelect);
    dragCleanupRef.current = null;
  }

  function beginDragSelect(startId: number, kind: "delete" | "episode") {
    dragSelectingRef.current = true;
    dragKindRef.current = kind;
    dragStartIdRef.current = startId;
    lastDragImageIdRef.current = startId;

    // 보조 수단 — touch-action은 touchstart 시점에 정해져서 이미 진행 중인 터치에는 효과가 제한적.
    // 실제 스크롤/당겨서 새로고침 차단은 상시 등록된 non-passive touchmove 리스너가 담당한다.
    if (gridRef.current) {
      gridRef.current.style.touchAction = "none";
    }

    document.addEventListener("pointermove", handleDragPointerMove);
    document.addEventListener("pointerup", endDragSelect);
    document.addEventListener("pointercancel", endDragSelect);

    dragCleanupRef.current = endDragSelect;
  }

  // gallery 모드에서 롱프레스하면 delete 모드로 전환하면서 드래그 다중선택을 시작하고,
  // episode 모드에서 롱프레스하면 모드 전환 없이 그 안에서 바로 드래그 다중선택을 시작한다.
  function startLongPress(item: ImageItem) {
    if (mode !== "gallery" && mode !== "episode") return;

    const kind: "delete" | "episode" = mode === "gallery" ? "delete" : "episode";

    clearLongPressTimer();
    longPressFiredRef.current = false;

    longPressTimerRef.current = setTimeout(() => {
      longPressFiredRef.current = true;

      if (kind === "delete") {
        setMode("delete");
        toggleDeleteImage(item);
      } else {
        ensureEpisodeSelected(item);
      }

      beginDragSelect(item.id, kind);
    }, LONG_PRESS_MS);
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

  // 카드(React.memo)에 넘기는 핸들러는 렌더마다 새로 만들지 않고 고정 — 최신 구현은 ref로 호출.
  // 그래야 선택이 바뀌어도 props가 바뀐 카드만 다시 그려진다.
  const cardHandlersRef = useRef({ handleImageClick, startLongPress });
  useLayoutEffect(() => {
    cardHandlersRef.current = { handleImageClick, startLongPress };
  });

  const onCardClick = useCallback((item: ImageItem) => {
    cardHandlersRef.current.handleImageClick(item);
  }, []);

  const onCardPressStart = useCallback((item: ImageItem) => {
    cardHandlersRef.current.startLongPress(item);
  }, []);

  // 포인터를 뗐거나(pointerup) 카드 밖으로 나갔거나(pointerleave/cancel) 아직 타이머가 안 터졌다면
  // 짧은 탭이었다는 뜻이므로 그냥 취소 (ref만 다루므로 고정 핸들러로 충분)
  const onCardPressEnd = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  // 선택 여부 + 순번을 O(1)로 조회 (기존: 카드마다 includes/indexOf → 카드 수 × 선택 수)
  const episodeOrderMap = useMemo(
    () => new Map(selectedImages.map((url, index) => [url, index + 1])),
    [selectedImages]
  );
  const deleteOrderMap = useMemo(
    () => new Map(deleteTargets.map((id, index) => [id, index + 1])),
    [deleteTargets]
  );

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
    const cleanedTitle = cleanTitle(title);
    setTitle(cleanedTitle);

    if (!cleanedTitle) return alert("작품 제목을 입력해줘.");
    if (!coverUrl) return alert("썸네일을 선택해줘.");
    if (!mainImageUrl) return alert("메인사진을 선택해줘.");

    let duplicate;
    try {
      duplicate = await findWebtoonByTitle(cleanedTitle);
    } catch (error) {
      alert(error instanceof Error ? error.message : "제목 확인 중 오류가 났어.");
      return;
    }

    if (duplicate) {
      alert("이미 같은 제목의 작품이 있어.");
      return;
    }

    const { error } = await supabase.from("webtoons").insert([
      {
        title: cleanedTitle,
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
    const selectedWebtoonTitle =
      webtoons.find((toon) => String(toon.id) === selectedWebtoonId)?.title || "";

    return (
      <main className="min-h-screen bg-black text-white px-4 md:px-8 py-8 pb-28">
        <div className="mb-6">
          <span className="text-base text-white">{selectedWebtoonTitle}</span>{" "}
          <span className="text-base text-white/50">
            ({episodePreviewImages.length}장)
          </span>
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

        <div className="fixed bottom-6 right-4 md:right-8 z-40 flex gap-3">
          <button
            onClick={() => {
              setEpisodePreviewMode(false);
              setEditingOrderIndex(null);
              setOrderInput("");
            }}
            className={`${buttonClass} shadow-lg shadow-black/50`}
          >
            취소
          </button>

          <button
            onClick={finalCreateEpisode}
            className={`${activeButtonClass} shadow-lg shadow-black/50`}
          >
            최종 생성
          </button>
        </div>
      </main>
    );
  }

  return (
    <PasswordGuard>
    <main
      className={`min-h-screen bg-black text-white px-4 md:px-8 pt-8 ${
        mode === "episode" || mode === "delete" ? "pb-28" : "pb-8"
      }`}
    >
      <div className="flex flex-col gap-6 mb-8">
        <div className="flex items-center justify-between gap-3">
          <Link href="/library" className={backButtonClass}>
            ← LIBRARY
          </Link>

          <div className="flex items-center gap-3 md:gap-9">
            <label aria-label="갤러리 추가" title="갤러리 추가" className={iconButtonClass}>
              <Upload size={24} />
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
              aria-label="작품 생성"
              title="작품 생성"
              className={mode === "work" ? activeIconButtonClass : iconButtonClass}
            >
              <BookPlus size={24} />
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
              aria-label="에피소드 생성"
              title="에피소드 생성"
              className={`group ${mode === "episode" ? activeIconButtonClass : iconButtonClass}`}
            >
              <EpisodeCreateIcon active={mode === "episode"} />
            </button>
          </div>
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
        </div>
      )}

      {/* 범위선택 버튼(episode/delete 둘 다) 제거 — 롱프레스+드래그로 대체 */}

      <div ref={gridRef} className="grid grid-cols-3 md:grid-cols-10 gap-px bg-black">
        {images.map((item) => {
          const episodeOrder = episodeOrderMap.get(item.url) ?? 0;
          const deleteOrder = deleteOrderMap.get(item.id) ?? 0;
          const isThumbnail = coverUrl === item.url;
          const isMain = mainImageUrl === item.url;

          let badgeText = "";
          if (isThumbnail && isMain) badgeText = "썸네일 · 메인";
          else if (isThumbnail) badgeText = "썸네일";
          else if (isMain) badgeText = "메인";

          return (
            <GalleryCard
              key={item.id}
              item={item}
              highlighted={episodeOrder > 0 || deleteOrder > 0 || isThumbnail || isMain}
              episodeOrder={mode === "episode" ? episodeOrder : 0}
              deleteOrder={mode === "delete" ? deleteOrder : 0}
              badgeText={badgeText}
              onSelect={onCardClick}
              onPressStart={onCardPressStart}
              onPressEnd={onCardPressEnd}
            />
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

      {mode === "episode" && (
        <div className="fixed bottom-6 right-4 md:right-8 z-40 flex gap-3">
          <button
            onClick={() => {
              resetEpisode();
              setMode("gallery");
            }}
            className={`${buttonClass} shadow-lg shadow-black/50`}
            aria-label="에피소드 생성 취소"
            title="에피소드 생성 취소"
          >
            취소
          </button>

          <button
            onClick={openEpisodePreview}
            className={`${activeButtonClass} shadow-lg shadow-black/50`}
          >
            {selectedImages.length > 0 ? `생성 (${selectedImages.length})` : "생성"}
          </button>
        </div>
      )}

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

type GalleryCardProps = {
  item: ImageItem;
  highlighted: boolean; // 빨간 ring 표시 여부
  episodeOrder: number; // 에피소드 모드 순번 배지, 0이면 없음
  deleteOrder: number; // 삭제 모드 순번 배지, 0이면 없음
  badgeText: string;
  onSelect: (item: ImageItem) => void;
  onPressStart: (item: ImageItem) => void;
  onPressEnd: () => void;
};

// props가 전부 원시값/고정 참조라, 드래그로 선택 범위가 바뀌어도 상태가 바뀐 카드만 다시 렌더링된다.
const GalleryCard = memo(function GalleryCard({
  item,
  highlighted,
  episodeOrder,
  deleteOrder,
  badgeText,
  onSelect,
  onPressStart,
  onPressEnd,
}: GalleryCardProps) {
  return (
    <button
      data-image-id={item.id}
      onClick={() => onSelect(item)}
      onPointerDown={() => onPressStart(item)}
      onPointerUp={onPressEnd}
      onPointerLeave={onPressEnd}
      onPointerCancel={onPressEnd}
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
      // min-w-0: 화면 밖 카드(content-visibility)의 기억된 크기가 그리드 열 최소폭 계산에 끼어들지 않게
      className={`relative aspect-square min-w-0 overflow-hidden select-none ${
        highlighted ? "ring-2 ring-inset ring-red-500" : ""
      }`}
      style={{
        WebkitTouchCallout: "none",
        // 화면 밖 카드는 레이아웃/페인트를 건너뜀. 높이는 aspect-square가 열 너비로 정하므로
        // intrinsic size는 최소값만 둠(auto = 한 번 그려진 실제 크기를 기억)
        contentVisibility: "auto",
        containIntrinsicSize: "auto 1px",
      }}
    >
      <Image
        src={item.url}
        alt=""
        fill
        sizes="(max-width: 768px) 33vw, 10vw"
        loading="lazy"
        decoding="async"
        draggable={false}
        className="object-cover"
      />

      {episodeOrder > 0 && (
        <div className="absolute top-1 right-1 w-7 h-7 bg-red-500 text-white flex items-center justify-center font-bold">
          {episodeOrder}
        </div>
      )}

      {deleteOrder > 0 && (
        <div className="absolute top-1 right-1 w-7 h-7 bg-red-500 text-white flex items-center justify-center font-bold">
          {deleteOrder}
        </div>
      )}

      {badgeText && (
        <div className="absolute right-1 bottom-1 bg-white text-black text-[10px] font-bold px-2 py-1 rounded-md">
          {badgeText}
        </div>
      )}
    </button>
  );
});

function EpisodeCreateIcon({ active }: { active: boolean }) {
  return (
    <span className="relative inline-block w-[18px] h-[24px] align-middle">
      <LayoutPanelTop
        width={18}
        height={24}
        preserveAspectRatio="none"
        className="[&_rect]:[vector-effect:non-scaling-stroke]"
      />
      <CirclePlus
        size={13}
        strokeWidth={2.5}
        className={`absolute -right-1.5 -bottom-1 ${
          active ? "fill-white" : "fill-black group-hover:fill-white"
        }`}
      />
    </span>
  );
}

const backButtonClass =
  "px-4 py-2 rounded-full hover:bg-white hover:text-black transition whitespace-nowrap text-sm md:text-base";

const iconButtonClass =
  "p-2 rounded-full hover:bg-white hover:text-black transition";

const activeIconButtonClass =
  "p-2 rounded-full bg-white text-black transition";

const deleteActiveClass =
  "border border-red-500 px-5 py-3 rounded-full bg-red-500 text-white cursor-pointer text-base transition";

const inputClass =
  "border border-white/25 rounded-2xl px-4 py-3 bg-black text-white text-base outline-none w-full";