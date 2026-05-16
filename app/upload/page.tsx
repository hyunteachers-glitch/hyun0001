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
  cover_url: string;
};

export default function UploadPage() {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [webtoons, setWebtoons] = useState<WebtoonItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const [mode, setMode] = useState<
    "gallery" | "work" | "episode" | "delete"
  >("gallery");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [coverUrl, setCoverUrl] = useState("");

  const [episodeTitle, setEpisodeTitle] = useState("");
  const [selectedWebtoonId, setSelectedWebtoonId] = useState("");
  const [selectedImages, setSelectedImages] = useState<string[]>([]);

  const [deleteTargets, setDeleteTargets] = useState<number[]>([]);

  useEffect(() => {
    getImages();
    getWebtoons();
  }, []);

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
      .select("*")
      .eq("deleted", false)
      .order("id", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    setWebtoons(data || []);
  }

  async function handleUpload(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const files = e.target.files;

    if (!files || files.length === 0) return;

    setUploading(true);
    setMode("gallery");

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

      const { error: dbError } = await supabase
        .from("images")
        .insert([{ url: publicUrl }]);

      if (dbError) {
        alert(dbError.message);
      }
    }

    setUploading(false);
    getImages();
  }

  function toggleDeleteTarget(id: number) {
    if (deleteTargets.includes(id)) {
      setDeleteTargets(
        deleteTargets.filter((target) => target !== id)
      );
    } else {
      setDeleteTargets([...deleteTargets, id]);
    }
  }

  async function completeDelete() {
    if (deleteTargets.length === 0) {
      alert("삭제할 사진을 선택해줘.");
      return;
    }

    const ok = confirm(
      `${deleteTargets.length}개의 사진을 삭제할까?`
    );

    if (!ok) return;

    try {
      const targetImages = images.filter((image) =>
        deleteTargets.includes(image.id)
      );

      for (const image of targetImages) {
        const filePath =
          image.url.split("/webtoon/")[1];

        if (filePath) {
          await supabase.storage
            .from("webtoon")
            .remove([filePath]);
        }

        await supabase
          .from("images")
          .delete()
          .eq("id", image.id);
      }

      setDeleteTargets([]);
      setMode("gallery");

      getImages();
    } catch (err) {
      alert("삭제 실패");
    }
  }

  async function createWork() {
    if (!title.trim()) {
      alert("작품 이름을 입력해줘.");
      return;
    }

    if (!coverUrl) {
      alert("썸네일 사진을 선택해줘.");
      return;
    }

    const { error } = await supabase
      .from("webtoons")
      .insert([
        {
          title: title.trim(),
          description: description.trim(),
          cover_url: coverUrl,
          deleted: false,
          updated_at: new Date().toISOString(),
        },
      ]);

    if (error) {
      alert(error.message);
      return;
    }

    alert("작품 생성 완료!");

    setTitle("");
    setDescription("");
    setCoverUrl("");
    setMode("gallery");

    getWebtoons();
  }

  function toggleEpisodeImage(url: string) {
    if (selectedImages.includes(url)) {
      setSelectedImages(
        selectedImages.filter((item) => item !== url)
      );
    } else {
      setSelectedImages([...selectedImages, url]);
    }
  }

  async function createEpisode() {
    if (!selectedWebtoonId) {
      alert("작품을 선택해줘.");
      return;
    }

    if (!episodeTitle.trim()) {
      alert("에피소드 제목을 입력해줘.");
      return;
    }

    if (selectedImages.length === 0) {
      alert("이미지를 선택해줘.");
      return;
    }

    const { data: existingEpisodes } = await supabase
      .from("episodes")
      .select("*")
      .eq("webtoon_id", Number(selectedWebtoonId));

    const nextEpisodeNo =
      (existingEpisodes?.length || 0) + 1;

    const { data: episodeData, error: episodeError } =
      await supabase
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

    const imageRows = selectedImages.map(
      (url, index) => ({
        episode_id: episodeData.id,
        image_url: url,
        image_order: index,
      })
    );

    const { error: imageError } = await supabase
      .from("episode_images")
      .insert(imageRows);

    if (imageError) {
      alert(imageError.message);
      return;
    }

    await supabase
      .from("webtoons")
      .update({
        updated_at: new Date().toISOString(),
      })
      .eq("id", Number(selectedWebtoonId));

    alert("에피소드 생성 완료!");

    setEpisodeTitle("");
    setSelectedWebtoonId("");
    setSelectedImages([]);
    setMode("gallery");
  }

  function handleImageClick(item: ImageItem) {
    if (mode === "gallery") {
      setPreviewImage(item.url);
      return;
    }

    if (mode === "work") {
      setCoverUrl(item.url);
      return;
    }

    if (mode === "episode") {
      toggleEpisodeImage(item.url);
      return;
    }

    if (mode === "delete") {
      toggleDeleteTarget(item.id);
    }
  }

  return (
    <main className="min-h-screen bg-black text-white px-4 md:px-8 py-8">
      <div className="flex flex-col gap-6 mb-8">
        <div>
          <h1 className="text-5xl font-bold mb-3">
            UPLOAD
          </h1>

          <p className="text-white/50">
            갤러리 관리 / 작품 생성 / 에피소드 생성
          </p>
        </div>

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
            onClick={() =>
              setMode(
                mode === "work"
                  ? "gallery"
                  : "work"
              )
            }
            className={
              mode === "work"
                ? activeButtonClass
                : buttonClass
            }
          >
            작품 생성
          </button>

          <button
            onClick={() =>
              setMode(
                mode === "episode"
                  ? "gallery"
                  : "episode"
              )
            }
            className={
              mode === "episode"
                ? activeButtonClass
                : buttonClass
            }
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
              }
            }}
            className={
              mode === "delete"
                ? deleteActiveClass
                : deleteButtonClass
            }
          >
            {mode === "delete"
              ? "삭제 완료"
              : "삭제"}
          </button>
        </div>
      </div>

      {uploading && (
        <p className="mb-6 text-white/60">
          업로드 중...
        </p>
      )}

      {mode === "work" && (
        <div className="mb-8 max-w-[720px] flex flex-col gap-3">
          <input
            value={title}
            onChange={(e) =>
              setTitle(e.target.value)
            }
            placeholder="작품 이름"
            className={inputClass}
          />

          <textarea
            value={description}
            onChange={(e) =>
              setDescription(e.target.value)
            }
            placeholder="작품 설명"
            className={`${inputClass} min-h-[100px] resize-y`}
          />

          <button
            onClick={createWork}
            className={buttonClass}
          >
            작품 만들기
          </button>
        </div>
      )}

      {mode === "episode" && (
        <div className="mb-8 max-w-[720px] flex flex-col gap-3">
          <select
            value={selectedWebtoonId}
            onChange={(e) =>
              setSelectedWebtoonId(e.target.value)
            }
            className={inputClass}
          >
            <option value="">
              작품 선택
            </option>

            {webtoons.map((toon) => (
              <option
                key={toon.id}
                value={toon.id}
              >
                {toon.title}
              </option>
            ))}
          </select>

          <input
            value={episodeTitle}
            onChange={(e) =>
              setEpisodeTitle(e.target.value)
            }
            placeholder="에피소드 제목"
            className={inputClass}
          />

          <button
            onClick={createEpisode}
            className={buttonClass}
          >
            에피소드 만들기
          </button>
        </div>
      )}

      <div className="grid grid-cols-3 md:grid-cols-10 gap-2 md:gap-3">
        {images.map((item) => {
          const isCover =
            coverUrl === item.url;

          const selected =
            selectedImages.includes(item.url);

          const order =
            selectedImages.indexOf(item.url) + 1;

          const deleteSelected =
            deleteTargets.includes(item.id);

          return (
            <button
              key={item.id}
              onClick={() =>
                handleImageClick(item)
              }
              className={`relative aspect-square overflow-hidden rounded-xl ${
                isCover ||
                selected ||
                deleteSelected
                  ? "border-2 border-red-500"
                  : "border border-white/15"
              }`}
            >
              <img
                src={item.url}
                alt=""
                className="w-full h-full object-cover"
              />

              {isCover &&
                mode === "work" && (
                  <div className="absolute left-1 bottom-1 bg-white text-black text-[10px] font-bold px-2 py-1 rounded-md">
                    썸네일
                  </div>
                )}

              {selected &&
                mode === "episode" && (
                  <div className="absolute top-1 right-1 w-7 h-7 bg-red-500 text-white flex items-center justify-center font-bold">
                    {order}
                  </div>
                )}

              {deleteSelected &&
                mode === "delete" && (
                  <div className="absolute top-1 right-1 w-7 h-7 bg-red-500 text-white flex items-center justify-center font-bold">
                    {
                      deleteTargets.indexOf(
                        item.id
                      ) + 1
                    }
                  </div>
                )}
            </button>
          );
        })}
      </div>

      {previewImage && (
        <div className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center p-5">
          <button
            onClick={() =>
              setPreviewImage(null)
            }
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