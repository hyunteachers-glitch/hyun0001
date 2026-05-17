"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../supabase";

type Webtoon = {
  id: number;
  title: string;
  cover_url: string;
  main_image_url: string;
  description: string;
  deleted: boolean;
};

type Episode = {
  id: number;
  title: string | null;
  episode_no: number;
  deleted: boolean;
};

type ImageItem = {
  id: number;
  url: string;
};

export default function WebtoonDetailPage() {
  const params = useParams();
  const router = useRouter();

  const webtoonId = Number(params.id);

  const [webtoon, setWebtoon] = useState<Webtoon | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [images, setImages] = useState<ImageItem[]>([]);

  const [selectImageMode, setSelectImageMode] =
    useState(false);

  useEffect(() => {
    if (!webtoonId) return;

    getWebtoon();
    getEpisodes();
    getImages();
  }, [webtoonId]);

  async function touchWebtoon() {
    await supabase
      .from("webtoons")
      .update({
        updated_at: new Date().toISOString(),
      })
      .eq("id", webtoonId);
  }

  async function getWebtoon() {
    const { data, error } = await supabase
      .from("webtoons")
      .select("*")
      .eq("id", webtoonId)
      .single();

    if (error) {
      alert(error.message);
      return;
    }

    setWebtoon(data);
  }

  async function getEpisodes() {
    const { data, error } = await supabase
      .from("episodes")
      .select("*")
      .eq("webtoon_id", webtoonId)
      .eq("deleted", false)
      .order("episode_no", {
        ascending: true,
      })
      .order("id", {
        ascending: true,
      });

    if (error) {
      alert(error.message);
      return;
    }

    setEpisodes(data || []);
  }

  async function getImages() {
    const { data, error } = await supabase
      .from("images")
      .select("*")
      .order("id", {
        ascending: false,
      });

    if (error) {
      alert(error.message);
      return;
    }

    setImages(data || []);
  }

  async function editTitle() {
    if (!webtoon) return;

    const newTitle = prompt(
      "새 제목 입력",
      webtoon.title
    );

    if (!newTitle) return;

    const { error } = await supabase
      .from("webtoons")
      .update({
        title: newTitle,
      })
      .eq("id", webtoon.id);

    if (error) {
      alert(error.message);
      return;
    }

    await touchWebtoon();
    getWebtoon();
  }

  async function editDescription() {
    if (!webtoon) return;

    const newDescription = prompt(
      "새 설명 입력",
      webtoon.description || ""
    );

    if (newDescription === null) return;

    const { error } = await supabase
      .from("webtoons")
      .update({
        description: newDescription,
      })
      .eq("id", webtoon.id);

    if (error) {
      alert(error.message);
      return;
    }

    await touchWebtoon();
    getWebtoon();
  }

  async function updateMainImage(
    imageUrl: string
  ) {
    const { error } = await supabase
      .from("webtoons")
      .update({
        main_image_url: imageUrl,
      })
      .eq("id", webtoonId);

    if (error) {
      alert(error.message);
      return;
    }

    await touchWebtoon();

    setSelectImageMode(false);
    getWebtoon();
  }

  async function moveToTrash() {
    if (!webtoon) return;

    const ok = confirm(
      "이 작품을 휴지통으로 이동할까?"
    );

    if (!ok) return;

    const { error } = await supabase
      .from("webtoons")
      .update({
        deleted: true,
      })
      .eq("id", webtoon.id);

    if (error) {
      alert(error.message);
      return;
    }

    router.push("/library");
  }

  if (!webtoon) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        loading...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="px-4 md:px-8 py-6 md:py-8">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-6">
          <Link
            href="/library"
            className="border border-white px-4 py-2 rounded-full hover:bg-white hover:text-black transition"
          >
            ← LIBRARY
          </Link>

          <div className="flex gap-2 flex-wrap justify-end">
            <button
              onClick={editTitle}
              className={buttonClass}
            >
              제목 수정
            </button>

            <button
              onClick={() =>
                setSelectImageMode(
                  !selectImageMode
                )
              }
              className={
                selectImageMode
                  ? activeButtonClass
                  : buttonClass
              }
            >
              사진 수정
            </button>

            <button
              onClick={editDescription}
              className={buttonClass}
            >
              설명 수정
            </button>

            <button
              onClick={moveToTrash}
              className={deleteButtonClass}
            >
              삭제
            </button>
          </div>
        </div>

        <div className="w-full aspect-[2/1] overflow-hidden rounded-3xl border border-white/10 bg-white/5 mb-8">
          <img
            src={
              webtoon.main_image_url ||
              webtoon.cover_url
            }
            alt=""
            className="w-full h-full object-cover"
          />
        </div>

        <div className="mb-10">
          <h1 className="text-3xl md:text-5xl font-bold mb-4">
            {webtoon.title}
          </h1>

          <p className="text-white/70 leading-relaxed text-sm md:text-base whitespace-pre-wrap">
            {webtoon.description ||
              "설명이 없는 작품"}
          </p>
        </div>

        {selectImageMode && (
          <div className="mb-10">
            <h2 className="text-xl font-bold mb-4">
              메인사진 선택
            </h2>

            <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
              {images.map((image) => (
                <button
                  key={image.id}
                  onClick={() =>
                    updateMainImage(image.url)
                  }
                  className={`relative aspect-square overflow-hidden rounded-xl border ${
                    webtoon.main_image_url ===
                    image.url
                      ? "border-red-500 border-2"
                      : "border-white/15"
                  }`}
                >
                  <img
                    src={image.url}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          </div>
        )}

        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl md:text-3xl font-bold">
              EPISODES
            </h2>

            <div className="text-white/50 text-sm md:text-base">
              총 {episodes.length}화
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {episodes.map((episode) => (
              <Link
                key={episode.id}
                href={`/viewer/${episode.id}`}
                className="border border-white/10 rounded-2xl px-4 md:px-6 py-4 hover:bg-white/5 transition"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-base md:text-lg font-bold truncate">
                    {episode.title ||
                      "제목 없는 에피소드"}
                  </div>

                  <div className="text-xs md:text-sm text-white/50 whitespace-nowrap">
                    {episode.episode_no}화
                  </div>
                </div>
              </Link>
            ))}

            {episodes.length === 0 && (
              <p className="text-white/40">
                아직 에피소드가 없어.
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

const buttonClass =
  "border border-white/20 px-4 py-2 rounded-full hover:bg-white hover:text-black transition";

const activeButtonClass =
  "border border-white px-4 py-2 rounded-full bg-white text-black transition";

const deleteButtonClass =
  "border border-red-500 text-red-400 px-4 py-2 rounded-full hover:bg-red-500 hover:text-white transition";