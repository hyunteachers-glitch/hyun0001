// app/upload/page.tsx

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

  const [mode, setMode] = useState<
    "gallery" | "work" | "episode" | "delete"
  >("gallery");

  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const [coverUrl, setCoverUrl] = useState("");
  const [mainImageUrl, setMainImageUrl] = useState("");

  const [selectMode, setSelectMode] = useState<
    "none" | "thumbnail" | "main"
  >("none");

  const [episodeTitle, setEpisodeTitle] = useState("");
  const [selectedWebtoonId, setSelectedWebtoonId] =
    useState("");

  const [webtoonSearch, setWebtoonSearch] =
    useState("");

  const [showWebtoonList, setShowWebtoonList] =
    useState(false);

  const [selectedImages, setSelectedImages] =
    useState<string[]>([]);

  const [deleteTargets, setDeleteTargets] =
    useState<number[]>([]);

  const [rangeMode, setRangeMode] =
    useState(false);

  const [rangeStartId, setRangeStartId] =
    useState<number | null>(null);

  const [episodePreviewMode, setEpisodePreviewMode] =
    useState(false);

  const [episodePreviewImages, setEpisodePreviewImages] =
    useState<string[]>([]);

  const [editingOrderIndex, setEditingOrderIndex] =
    useState<number | null>(null);

  const [orderInput, setOrderInput] =
    useState("");

  useEffect(() => {
    getImages(true);
    getWebtoons();
  }, []);

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

    if (reset) {
      setImages(nextImages);
    } else {
      setImages((prev) => [
        ...prev,
        ...nextImages,
      ]);
    }

    setHasMoreImages(
      nextImages.length === IMAGE_LIMIT
    );

    setLoadingMore(false);
  }

  async function getWebtoons() {
    const { data, error } = await supabase
      .from("webtoons")
      .select("id,title")
      .eq("deleted", false)
      .order("updated_at", {
        ascending: false,
      });

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

    if (!files || files.length === 0)
      return;

    setUploading(true);

    for (const file of Array.from(files)) {
      const filePath = `uploads/${Date.now()}-${file.name}`;

      const { error: uploadError } =
        await supabase.storage
          .from("webtoon")
          .upload(filePath, file);

      if (uploadError) {
        alert(uploadError.message);
        continue;
      }

      const publicUrl =
        supabase.storage
          .from("webtoon")
          .getPublicUrl(filePath).data
          .publicUrl;

      await supabase
        .from("images")
        .insert([
          {
            url: publicUrl,
          },
        ]);
    }

    setUploading(false);

    await getImages(true);
  }

  function getRangeItems(
    startId: number,
    endId: number
  ) {
    const startIndex = images.findIndex(
      (image) => image.id === startId
    );

    const endIndex = images.findIndex(
      (image) => image.id === endId
    );

    if (
      startIndex === -1 ||
      endIndex === -1
    ) {
      return [];
    }

    if (startIndex <= endIndex) {
      return images.slice(
        startIndex,
        endIndex + 1
      );
    }

    return images
      .slice(endIndex, startIndex + 1)
      .reverse();
  }

  function toggleEpisodeImage(item: ImageItem) {
    if (rangeMode) {
      if (rangeStartId === null) {
        setRangeStartId(item.id);
        setSelectedImages([item.url]);
        return;
      }

      const rangeItems = getRangeItems(
        rangeStartId,
        item.id
      );

      setSelectedImages(
        rangeItems.map((image) => image.url)
      );

      setRangeStartId(null);

      return;
    }

    if (selectedImages.includes(item.url)) {
      setSelectedImages(
        selectedImages.filter(
          (url) => url !== item.url
        )
      );
    } else {
      setSelectedImages([
        ...selectedImages,
        item.url,
      ]);
    }
  }

  function toggleDeleteImage(item: ImageItem) {
    if (rangeMode) {
      if (rangeStartId === null) {
        setRangeStartId(item.id);
        setDeleteTargets([item.id]);
        return;
      }

      const rangeItems = getRangeItems(
        rangeStartId,
        item.id
      );

      setDeleteTargets(
        rangeItems.map((image) => image.id)
      );

      setRangeStartId(null);

      return;
    }

    if (deleteTargets.includes(item.id)) {
      setDeleteTargets(
        deleteTargets.filter(
          (id) => id !== item.id
        )
      );
    } else {
      setDeleteTargets([
        ...deleteTargets,
        item.id,
      ]);
    }
  }

  function handleImageClick(item: ImageItem) {
    if (mode === "gallery") {
      setPreviewImage(item.url);
      return;
    }

    if (mode === "work") {
      if (selectMode === "thumbnail") {
        setCoverUrl(item.url);
      }

      if (selectMode === "main") {
        setMainImageUrl(item.url);
      }

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

  function openEpisodePreview() {
    if (!selectedWebtoonId) {
      alert("작품을 선택해줘.");
      return;
    }

    if (!episodeTitle.trim()) {
      alert(
        "에피소드 제목을 입력해줘."
      );
      return;
    }

    if (selectedImages.length === 0) {
      alert("이미지를 선택해줘.");
      return;
    }

    setEpisodePreviewImages([
      ...selectedImages,
    ]);

    setEpisodePreviewMode(true);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function startOrderEdit(index: number) {
    setEditingOrderIndex(index);
    setOrderInput(String(index + 1));
  }

  function applyOrderEdit(index: number) {
    const targetNumber =
      Number(orderInput);

    const total =
      episodePreviewImages.length;

    if (
      !Number.isInteger(targetNumber) ||
      targetNumber < 1 ||
      targetNumber > total
    ) {
      alert(
        `1부터 ${total} 사이 숫자 입력`
      );
      return;
    }

    const targetIndex =
      targetNumber - 1;

    setEpisodePreviewImages((prev) => {
      const next = [...prev];

      const [moved] = next.splice(
        index,
        1
      );

      next.splice(targetIndex, 0, moved);

      return next;
    });

    setEditingOrderIndex(null);

    setOrderInput("");

    setTimeout(() => {
      document
        .getElementById(
          `preview-image-${targetIndex}`
        )
        ?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
    }, 50);
  }

  function removePreviewImage(index: number) {
    setEpisodePreviewImages((prev) =>
      prev.filter((_, i) => i !== index)
    );

    setEditingOrderIndex(null);

    setOrderInput("");
  }

  async function finalCreateEpisode() {
    if (!selectedWebtoonId) return;

    const {
      data: existingEpisodes,
    } = await supabase
      .from("episodes")
      .select("*")
      .eq(
        "webtoon_id",
        Number(selectedWebtoonId)
      )
      .eq("deleted", false);

    const nextEpisodeNo =
      (existingEpisodes?.length || 0) + 1;

    const {
      data: episodeData,
      error: episodeError,
    } = await supabase
      .from("episodes")
      .insert([
        {
          webtoon_id:
            Number(selectedWebtoonId),
          title: episodeTitle.trim(),
          episode_no: nextEpisodeNo,
          cover_url:
            episodePreviewImages[0],
          deleted: false,
        },
      ])
      .select()
      .single();

    if (episodeError) {
      alert(episodeError.message);
      return;
    }

    const imageRows =
      episodePreviewImages.map(
        (url, index) => ({
          episode_id: episodeData.id,
          image_url: url,
          image_order: index,
        })
      );

    const { error: imageError } =
      await supabase
        .from("episode_images")
        .insert(imageRows);

    if (imageError) {
      alert(imageError.message);
      return;
    }

    alert("에피소드 생성 완료");

    resetEpisode();
  }

  const filteredWebtoons =
    webtoonSearch.trim() === ""
      ? webtoons
      : webtoons.filter((toon) =>
          toon.title
            .toLowerCase()
            .includes(
              webtoonSearch.toLowerCase()
            )
        );

  if (episodePreviewMode) {
    return (
      <main className="min-h-screen bg-black text-white px-4 md:px-8 py-8">
        <div className="mb-6 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-3xl md:text-5xl font-bold">
              에피소드 미리보기
            </h1>

            <p className="text-white/50 mt-2">
              번호를 눌러 순서를
              변경할 수 있어.
            </p>
          </div>

          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() =>
                setEpisodePreviewMode(false)
              }
              className={buttonClass}
            >
              취소
            </button>

            <button
              onClick={finalCreateEpisode}
              className={
                activeButtonClass
              }
            >
              최종 생성
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-5 items-center">
          {episodePreviewImages.map(
            (url, index) => (
              <div
                id={`preview-image-${index}`}
                key={`${url}-${index}`}
                className="w-full md:w-[75vw] border border-white/15 rounded-2xl overflow-hidden bg-white/[0.03]"
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                  {editingOrderIndex ===
                  index ? (
                    <div className="flex items-center gap-2">
                      <input
                        value={orderInput}
                        onChange={(e) =>
                          setOrderInput(
                            e.target.value
                          )
                        }
                        className="w-[80px] bg-black border border-white/20 rounded-xl px-3 py-2 text-center outline-none"
                      />

                      <button
                        onClick={() =>
                          applyOrderEdit(
                            index
                          )
                        }
                        className="border border-white/20 px-3 py-2 rounded-xl"
                      >
                        이동
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() =>
                        startOrderEdit(
                          index
                        )
                      }
                      className="border border-white/20 px-4 py-2 rounded-xl"
                    >
                      {index + 1}
                    </button>
                  )}

                  <button
                    onClick={() =>
                      removePreviewImage(
                        index
                      )
                    }
                    className="border border-red-500 text-red-400 px-3 py-2 rounded-xl"
                  >
                    제거
                  </button>
                </div>

                <img
                  src={url}
                  alt=""
                  className="w-full h-auto object-contain"
                />
              </div>
            )
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white px-4 md:px-8 py-8">
      <div className="flex gap-3 flex-wrap mb-8">
        <Link
          href="/library"
          className={buttonClass}
        >
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
            setMode("work")
          }
          className={buttonClass}
        >
          작품 생성
        </button>

        <button
          onClick={() =>
            setMode("episode")
          }
          className={buttonClass}
        >
          에피소드 생성
        </button>

        <button
          onClick={() =>
            setMode("delete")
          }
          className={buttonClass}
        >
          삭제
        </button>
      </div>

      {mode === "episode" && (
        <div className="mb-8 max-w-[720px] flex flex-col gap-3">
          <div className="relative">
            <input
              value={webtoonSearch}
              onClick={() =>
                setShowWebtoonList(
                  (prev) => !prev
                )
              }
              onChange={(e) => {
                setWebtoonSearch(
                  e.target.value
                );

                setSelectedWebtoonId("");

                setShowWebtoonList(true);
              }}
              placeholder="작품 검색"
              className={inputClass}
            />

            {showWebtoonList && (
              <div className="absolute left-0 right-0 top-[100%] mt-2 bg-black border border-white/15 rounded-2xl overflow-hidden max-h-[280px] overflow-y-auto z-50">
                {filteredWebtoons.map(
                  (toon) => (
                    <button
                      key={toon.id}
                      onClick={() => {
                        setSelectedWebtoonId(
                          String(toon.id)
                        );

                        setWebtoonSearch(
                          toon.title
                        );

                        setShowWebtoonList(
                          false
                        );
                      }}
                      className="w-full text-left px-4 py-3 border-b border-white/5 hover:bg-white hover:text-black transition"
                    >
                      {toon.title}
                    </button>
                  )
                )}
              </div>
            )}
          </div>

          <input
            value={episodeTitle}
            onChange={(e) =>
              setEpisodeTitle(
                e.target.value
              )
            }
            placeholder="에피소드 제목"
            className={inputClass}
          />

          <div className="flex gap-3 flex-wrap">
            <button
              onClick={openEpisodePreview}
              className={buttonClass}
            >
              에피소드 만들기
            </button>

            <button
              onClick={() =>
                setRangeMode(
                  !rangeMode
                )
              }
              className={
                rangeMode
                  ? activeButtonClass
                  : buttonClass
              }
            >
              {rangeMode
                ? "범위선택 중"
                : "범위선택"}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 md:grid-cols-10 gap-2 md:gap-3">
        {images.map((item) => (
          <button
            key={item.id}
            onClick={() =>
              handleImageClick(item)
            }
            className="relative aspect-square overflow-hidden rounded-xl border border-white/15"
          >
            <img
              src={item.url}
              alt=""
              loading="lazy"
              className="w-full h-full object-cover"
            />
          </button>
        ))}
      </div>
    </main>
  );
}

const buttonClass =
  "border border-white px-5 py-3 rounded-full bg-black text-white cursor-pointer text-base hover:bg-white hover:text-black transition";

const activeButtonClass =
  "border border-white px-5 py-3 rounded-full bg-white text-black cursor-pointer text-base transition";

const inputClass =
  "border border-white/25 rounded-2xl px-4 py-3 bg-black text-white text-base outline-none w-full";