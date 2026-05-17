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

export default function UploadPage() {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [webtoons, setWebtoons] = useState<WebtoonItem[]>([]);
  const [uploading, setUploading] = useState(false);

  const [mode, setMode] = useState<"gallery" | "work" | "episode" | "delete">(
    "gallery"
  );

  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [mainImageUrl, setMainImageUrl] = useState("");

  const [selectMode, setSelectMode] = useState<"none" | "thumbnail" | "main">(
    "none"
  );

  const [episodeTitle, setEpisodeTitle] = useState("");
  const [selectedWebtoonId, setSelectedWebtoonId] = useState("");
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [deleteTargets, setDeleteTargets] = useState<number[]>([]);

  const [rangeMode, setRangeMode] = useState(false);
  const [rangeStartId, setRangeStartId] = useState<number | null>(null);

  useEffect(() => {
    getImages();
    getWebtoons();
  }, []);

  function resetWork() {
    setTitle("");
    setDescription("");
    setCoverUrl("");
    setMainImageUrl("");
    setSelectMode("none");
  }

  function normalizeTitle(value: string) {
    return value.trim().toLowerCase();
  }

  async function getImages() {
    const { data, error } = await supabase
      .from("images")
      .select("*")
      .order("id", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    setImages(data || []);
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

    for (const file of Array.from(files)) {
      const filePath = `uploads/${Date.now()}-${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from("webtoon")
        .upload(filePath, file);

      if (uploadError) {
        alert(uploadError.message);
        continue;
      }

      const publicUrl = supabase.storage
        .from("webtoon")
        .getPublicUrl(filePath).data.publicUrl;

      await supabase.from("images").insert([{ url: publicUrl }]);
    }

    setUploading(false);
    getImages();
  }

  function getRangeItems(startId: number, endId: number) {
    const startIndex = images.findIndex((image) => image.id === startId);
    const endIndex = images.findIndex((image) => image.id === endId);

    if (startIndex === -1 || endIndex === -1) return [];

    if (startIndex <= endIndex) {
      return images.slice(startIndex, endIndex + 1);
    }

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

    if (mode === "delete") {
      toggleDeleteImage(item);
    }
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

  async function createEpisode() {
    if (!selectedWebtoonId) return alert("작품을 선택해줘.");
    if (!episodeTitle.trim()) return alert("에피소드 제목을 입력해줘.");
    if (selectedImages.length === 0) return alert("이미지를 선택해줘.");

    const { data: existingEpisodes } = await supabase
      .from("episodes")
      .select("*")
      .eq("webtoon_id", Number(selectedWebtoonId));

    const nextEpisodeNo = (existingEpisodes?.length || 0) + 1;

    const { data: episodeData, error: episodeError } = await supabase
      .from("episodes")
      .insert([
        {
          webtoon_id: Number(selectedWebtoonId),
          title: episodeTitle.trim(),
          episode_no: nextEpisodeNo,
          cover_url: selectedImages[0],
          deleted: false,
        },
      ])
      .select()
      .single();

    if (episodeError) {
      alert(episodeError.message);
      return;
    }

    const imageRows = selectedImages.map((url, index) => ({
      episode_id: episodeData.id,
      image_url: url,
      image_order: index,
    }));

    const { error: imageError } = await supabase
      .from("episode_images")
      .insert(imageRows);

    if (imageError) {
      alert(imageError.message);
      return;
    }

    await supabase
      .from("webtoons")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", Number(selectedWebtoonId));

    alert("에피소드 생성 완료!");

    setEpisodeTitle("");
    setSelectedWebtoonId("");
    setSelectedImages([]);
    setRangeStartId(null);
  }

  async function completeDelete() {
    if (deleteTargets.length === 0) return alert("삭제할 사진을 선택해줘.");

    const ok = confirm(`${deleteTargets.length}개의 사진을 삭제할까?`);
    if (!ok) return;

    const targetImages = images.filter((image) =>
      deleteTargets.includes(image.id)
    );

    for (const image of targetImages) {
      const filePath = image.url.split("/webtoon/")[1];

      if (filePath) {
        await supabase.storage.from("webtoon").remove([filePath]);
      }

      await supabase.from("images").delete().eq("id", image.id);
    }

    setDeleteTargets([]);
    setRangeStartId(null);
    getImages();
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
            <input
              type="file"
              multiple
              onChange={handleUpload}
              className="hidden"
            />
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
            onClick={() =>
              setMode(mode === "episode" ? "gallery" : "episode")
            }
            className={mode === "episode" ? activeButtonClass : buttonClass}
          >
            에피소드 생성
          </button>

          <button
            onClick={() => {
              if (mode === "delete") {
                completeDelete();
              } else {
                setMode("delete");
                setDeleteTargets([]);
                setRangeStartId(null);
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
          <select
            value={selectedWebtoonId}
            onChange={(e) => setSelectedWebtoonId(e.target.value)}
            className={inputClass}
          >
            <option value="">작품 선택</option>
            {webtoons.map((toon) => (
              <option key={toon.id} value={toon.id}>
                {toon.title}
              </option>
            ))}
          </select>

          <input
            value={episodeTitle}
            onChange={(e) => setEpisodeTitle(e.target.value)}
            placeholder="에피소드 제목"
            className={inputClass}
          />

          <div className="flex gap-3 flex-wrap">
            <button onClick={createEpisode} className={buttonClass}>
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
              <img
                src={item.url}
                alt=""
                className="w-full h-full object-cover"
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
  "border border-white/25 rounded-2xl px-4 py-3 bg-black text-white text-base outline-none";