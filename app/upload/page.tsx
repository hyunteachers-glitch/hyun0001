"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../supabase";

type ImageItem = {
  id: number;
  url: string;
};

type WebtoonItem = {
  id: number;
  title: string;
};

const IMAGE_LIMIT = 100;

export default function UploadPage() {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [webtoons, setWebtoons] = useState<WebtoonItem[]>([]);
  const [uploading, setUploading] = useState(false);
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

  const [episodePreviewMode, setEpisodePreviewMode] = useState(false);
  const [episodePreviewImages, setEpisodePreviewImages] = useState<string[]>([]);
  const [editingOrderIndex, setEditingOrderIndex] = useState<number | null>(null);
  const [orderInput, setOrderInput] = useState("");

  useEffect(() => {
    getImages(true);
    getWebtoons();
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

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);

    try {
      const fileArray = Array.from(files);
      const uploadedRows: { order: number; url: string }[] = [];
      const chunkSize = 5;

      for (let i = 0; i < fileArray.length; i += chunkSize) {
        const chunk = fileArray.slice(i, i + chunkSize);

        const results = await Promise.all(
          chunk.map(async (file, index) => {
            const originalOrder = i + index;
            const safeName = file.name.replace(/\s+/g, "_");
            const filePath = `uploads/${Date.now()}-${originalOrder}-${safeName}`;

            const { error: uploadError } = await supabase.storage
              .from("webtoon")
              .upload(filePath, file);

            if (uploadError) {
              console.error(uploadError);
              return null;
            }

            const publicUrl = supabase.storage
              .from("webtoon")
              .getPublicUrl(filePath).data.publicUrl;

            return {
              order: originalOrder,
              url: publicUrl,
            };
          })
        );

        const validResults = results.filter(
          (item): item is { order: number; url: string } => item !== null
        );

        uploadedRows.push(...validResults);
      }

      const orderedRows = uploadedRows
        .sort((a, b) => a.order - b.order)
        .map((item) => ({
          url: item.url,
        }));

      if (orderedRows.length > 0) {
        const { error: insertError } = await supabase
          .from("images")
          .insert(orderedRows);

        if (insertError) {
          alert(insertError.message);
        }
      }

      await getImages(true);
    } catch (error) {
      console.error(error);
      alert("업로드 중 오류가 발생했어.");
    }

    setUploading(false);
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

  function handleImageClick(item: ImageItem) {
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

    const targetImages = images.filter((image) => deleteTargets.includes(image.id));

    for (const image of targetImages) {
      const filePath = image.url.split("/webtoon/")[1];

      if (filePath) {
        await supabase.storage.from("webtoon").remove([filePath]);
      }

      await supabase.from("images").delete().eq("id", image.id);
    }

    resetDelete();
    setMode("gallery");
    await getImages(true);
  }

  const filteredWebtoons =
    webtoonSearch.trim() === ""
      ? webtoons
      : webtoons.filter((toon) =>
          toon.title.toLowerCase().includes(webtoonSearch.toLowerCase())
        );

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

          <button
            onClick={() => {
              if (mode === "delete") {
                completeDelete();
              } else {
                resetDelete();
                setMode("delete");
              }
            }}
            className={mode === "delete" ? deleteActiveClass : deleteButtonClass}
          >
            {mode === "delete" ? "삭제 완료" : "삭제"}
          </button>
        </div>
      </div>

      {uploading && <p className="mb-6 text-white/60">업로드 중...</p>}

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

      {mode === "delete" && (
        <div className="mb-8 flex gap-3 flex-wrap">
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
      )}

      <div className="grid grid-cols-3 md:grid-cols-10 gap-2 md:gap-3">
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
              onClick={() => handleImageClick(item)}
              className={`relative aspect-square overflow-hidden rounded-xl border ${
                selected || deleteSelected || isThumbnail || isMain || isRangeStart
                  ? "border-red-500 border-2"
                  : "border-white/15"
              }`}
            >
              <img src={item.url} alt="" loading="lazy" className="w-full h-full object-cover" />

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
  );
}

const buttonClass =
  "border border-white px-5 py-3 rounded-full bg-black text-white cursor-pointer text-base no-underline hover:bg-white hover:text-black transition";

const activeButtonClass =
  "border border-white px-5 py-3 rounded-full bg-white text-black cursor-pointer text-base transition";

const deleteButtonClass =
  "border border-red-500 px-5 py-3 rounded-full bg-black text-red-400 cursor-pointer text-base hover:bg-red-500 hover:text-white transition";

const deleteActiveClass =
  "border border-red-500 px-5 py-3 rounded-full bg-red-500 text-white cursor-pointer text-base transition";

const inputClass =
  "border border-white/25 rounded-2xl px-4 py-3 bg-black text-white text-base outline-none w-full";