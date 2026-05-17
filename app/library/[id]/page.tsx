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

  const [selectImageMode, setSelectImageMode] = useState(false);
  const [editTitleMode, setEditTitleMode] = useState(false);
  const [editDescriptionMode, setEditDescriptionMode] = useState(false);

  const [titleInput, setTitleInput] = useState("");
  const [descriptionInput, setDescriptionInput] = useState("");

  useEffect(() => {
    if (!webtoonId) return;
    getWebtoon();
    getEpisodes();
    getImages();
  }, [webtoonId]);

  async function touchWebtoon() {
    await supabase
      .from("webtoons")
      .update({ updated_at: new Date().toISOString() })
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
    setTitleInput(data.title || "");
    setDescriptionInput(data.description || "");
  }

  async function getEpisodes() {
    const { data, error } = await supabase
      .from("episodes")
      .select("*")
      .eq("webtoon_id", webtoonId)
      .eq("deleted", false)
      .order("episode_no", { ascending: true })
      .order("id", { ascending: true });

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
      .order("id", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    setImages(data || []);
  }

  async function saveTitle() {
    if (!webtoon) return;
    if (!titleInput.trim()) {
      alert("제목을 입력해줘.");
      return;
    }

    const { error } = await supabase
      .from("webtoons")
      .update({ title: titleInput.trim() })
      .eq("id", webtoon.id);

    if (error) {
      alert(error.message);
      return;
    }

    await touchWebtoon();
    setEditTitleMode(false);
    getWebtoon();
  }

  async function saveDescription() {
    if (!webtoon) return;

    const { error } = await supabase
      .from("webtoons")
      .update({ description: descriptionInput })
      .eq("id", webtoon.id);

    if (error) {
      alert(error.message);
      return;
    }

    await touchWebtoon();
    setEditDescriptionMode(false);
    getWebtoon();
  }

  async function updateMainImage(imageUrl: string) {
    const { error } = await supabase
      .from("webtoons")
      .update({ main_image_url: imageUrl })
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

    const ok = confirm("이 작품을 휴지통으로 이동할까?");
    if (!ok) return;

    const { error } = await supabase
      .from("webtoons")
      .update({ deleted: true })
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
      <div className="px-4 md:px-8 py-5 md:py-8">
        <div className="flex items-center justify-between gap-2 mb-7">
          <Link
            href="/library"
            className="border border-white px-3 md:px-4 py-2 rounded-full hover:bg-white hover:text-black transition text-xs md:text-base whitespace-nowrap"
          >
            ← LIBRARY
          </Link>

          <div className="flex gap-1.5 md:gap-2 items-center justify-end flex-nowrap">
            <button
              onClick={() => {
                setEditTitleMode(!editTitleMode);
                setEditDescriptionMode(false);
                setSelectImageMode(false);
              }}
              className={editTitleMode ? activeButtonClass : buttonClass}
            >
              제목 수정
            </button>

            <button
              onClick={() => {
                setSelectImageMode(!selectImageMode);
                setEditTitleMode(false);
                setEditDescriptionMode(false);
              }}
              className={selectImageMode ? activeButtonClass : buttonClass}
            >
              사진 수정
            </button>

            <button
              onClick={() => {
                setEditDescriptionMode(!editDescriptionMode);
                setEditTitleMode(false);
                setSelectImageMode(false);
              }}
              className={editDescriptionMode ? activeButtonClass : buttonClass}
            >
              설명 수정
            </button>

            <button onClick={moveToTrash} className={deleteButtonClass}>
              삭제
            </button>
          </div>
        </div>

        <section className="flex flex-col md:flex-row gap-5 md:gap-10 mb-10 items-start">
          <div className="w-full md:w-1/3 aspect-[2/1] overflow-hidden rounded-2xl md:rounded-3xl border border-white/10 bg-white/5 shrink-0">
            <img
              src={webtoon.main_image_url || webtoon.cover_url}
              alt=""
              className="w-full h-full object-cover"
            />
          </div>

          <div className="flex-1 min-w-0 pt-0">
            {editTitleMode ? (
              <div className="mb-4 flex gap-2">
                <input
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                  className="w-full bg-black border border-white/25 rounded-2xl px-4 py-3 text-white outline-none text-2xl md:text-4xl font-bold"
                />

                <button onClick={saveTitle} className={smallButtonClass}>
                  완료
                </button>
              </div>
            ) : (
              <h1 className="text-3xl md:text-5xl font-bold mb-4 leading-tight">
                {webtoon.title}
              </h1>
            )}

            {editDescriptionMode ? (
              <div className="flex flex-col gap-3">
                <textarea
                  value={descriptionInput}
                  onChange={(e) => setDescriptionInput(e.target.value)}
                  className="w-full min-h-[120px] bg-black border border-white/25 rounded-2xl px-4 py-3 text-white outline-none resize-y"
                />

                <button onClick={saveDescription} className={smallButtonClass}>
                  설명 완료
                </button>
              </div>
            ) : (
              <p className="text-white/70 leading-relaxed text-sm md:text-base whitespace-pre-wrap">
                {webtoon.description || "설명이 없는 작품"}
              </p>
            )}
          </div>
        </section>

        {selectImageMode && (
          <div className="mb-10">
            <h2 className="text-xl font-bold mb-4">메인사진 선택</h2>

            <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
              {images.map((image) => (
                <button
                  key={image.id}
                  onClick={() => updateMainImage(image.url)}
                  className={`relative aspect-square overflow-hidden rounded-xl border ${
                    webtoon.main_image_url === image.url
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
            <h2 className="text-2xl md:text-3xl font-bold">EPISODES</h2>

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
                    {episode.title || "제목 없는 에피소드"}
                  </div>

                  <div className="text-xs md:text-sm text-white/50 whitespace-nowrap">
                    {episode.episode_no}화
                  </div>
                </div>
              </Link>
            ))}

            {episodes.length === 0 && (
              <p className="text-white/40">아직 에피소드가 없어.</p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

const buttonClass =
  "border border-white/20 px-2.5 md:px-4 py-2 rounded-full hover:bg-white hover:text-black transition text-[11px] md:text-base whitespace-nowrap";

const activeButtonClass =
  "border border-white px-2.5 md:px-4 py-2 rounded-full bg-white text-black transition text-[11px] md:text-base whitespace-nowrap";

const deleteButtonClass =
  "border border-red-500 text-red-400 px-2.5 md:px-4 py-2 rounded-full hover:bg-red-500 hover:text-white transition text-[11px] md:text-base whitespace-nowrap";

const smallButtonClass =
  "border border-white px-4 py-2 rounded-xl hover:bg-white hover:text-black transition whitespace-nowrap";