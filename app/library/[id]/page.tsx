"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../supabase";

type Webtoon = {
  id: number;
  title: string;
  cover_url: string;
  description: string;
  deleted: boolean;
};

type Episode = {
  id: number;
  title: string;
  episode_no: number;
  deleted: boolean;
};

export default function WebtoonDetailPage() {
  const params = useParams();
  const router = useRouter();
  const webtoonId = Number(params.id);

  const [webtoon, setWebtoon] = useState<Webtoon | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);

  const [episodeDeleteMode, setEpisodeDeleteMode] = useState(false);
  const [episodeEditMode, setEpisodeEditMode] = useState(false);

  useEffect(() => {
    if (!webtoonId) return;

    getWebtoon();
    getEpisodes();
  }, [webtoonId]);

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
      .order("episode_no", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    setEpisodes(data || []);
  }

  async function editTitle() {
    if (!webtoon) return;

    const newTitle = prompt("새 제목 입력", webtoon.title);

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

  async function deleteEpisode(id: number) {
    const ok = confirm(
      "이 에피소드를 삭제할까?"
    );

    if (!ok) return;

    const { error } = await supabase
      .from("episodes")
      .update({
        deleted: true,
      })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    getEpisodes();
  }

  async function editEpisodeTitle(
    id: number,
    currentTitle: string
  ) {
    const newTitle = prompt(
      "새 에피소드 제목 입력",
      currentTitle
    );

    if (!newTitle) return;

    const { error } = await supabase
      .from("episodes")
      .update({
        title: newTitle,
      })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    getEpisodes();
  }

  if (!webtoon) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        loading...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white px-8 py-10">

      <div className="flex justify-between items-center mb-10 flex-wrap gap-3">

        <Link
          href="/library"
          className="border border-white px-4 py-2 rounded-full hover:bg-white hover:text-black transition"
        >
          ← LIBRARY
        </Link>

        <div className="flex gap-3 items-center">

          <button
            onClick={editTitle}
            className="border border-white/40 px-5 py-3 rounded-xl hover:bg-white hover:text-black transition"
          >
            제목 수정
          </button>

          <button
            onClick={editDescription}
            className="border border-white/40 px-5 py-3 rounded-xl hover:bg-white hover:text-black transition"
          >
            설명 수정
          </button>

          <button
            onClick={moveToTrash}
            className="border border-red-500 text-red-400 px-5 py-3 rounded-xl hover:bg-red-500 hover:text-white transition"
          >
            삭제
          </button>

        </div>

      </div>

      <section className="flex gap-8 mb-12 flex-wrap">

        <div className="w-[260px] h-[360px] rounded-3xl overflow-hidden bg-white/5 shrink-0">

          <img
            src={webtoon.cover_url}
            alt=""
            className="w-full h-full object-cover"
          />

        </div>

        <div className="max-w-3xl">

          <h1 className="text-5xl font-bold mb-6">
            {webtoon.title}
          </h1>

          <p className="text-white/70 text-lg leading-relaxed mb-8">
            {webtoon.description || "설명이 없는 작품"}
          </p>

        </div>

      </section>

      <section className="border-t border-white/10 pt-8">

        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">

          <h2 className="text-3xl font-bold">
            EPISODES
          </h2>

          <div className="flex gap-3">

            <Link
              href="/upload"
              className="border border-white px-5 py-3 rounded-xl hover:bg-white hover:text-black transition"
            >
              에피소드 추가
            </Link>

            <button
              onClick={() => {
                setEpisodeDeleteMode(!episodeDeleteMode);
                setEpisodeEditMode(false);
              }}
              className={`px-5 py-3 rounded-xl transition border ${
                episodeDeleteMode
                  ? "bg-red-500 text-white border-red-500"
                  : "border-red-500 text-red-400 hover:bg-red-500 hover:text-white"
              }`}
            >
              에피소드 삭제
            </button>

            <button
              onClick={() => {
                setEpisodeEditMode(!episodeEditMode);
                setEpisodeDeleteMode(false);
              }}
              className={`px-5 py-3 rounded-xl transition border ${
                episodeEditMode
                  ? "bg-white text-black border-white"
                  : "border-white/40 text-white hover:bg-white hover:text-black"
              }`}
            >
              에피소드 수정
            </button>

          </div>

        </div>

        <div className="flex flex-col gap-3">

          {episodes.map((episode) => (

            <div
              key={episode.id}
              className="border border-white/10 rounded-2xl px-6 py-5"
            >

              <div className="flex items-center justify-between gap-4">

                <Link
                  href={`/viewer/${episode.id}`}
                  className="flex-1"
                >

                  <div className="flex items-center justify-between">

                    <div className="text-xl font-bold">
                      {episode.title}
                    </div>

                    <div className="text-sm opacity-60">
                      {episode.episode_no}화
                    </div>

                  </div>

                </Link>

                {episodeDeleteMode && (
                  <button
                    onClick={() => deleteEpisode(episode.id)}
                    className="border border-red-500 text-red-400 px-4 py-2 rounded-xl hover:bg-red-500 hover:text-white transition"
                  >
                    삭제
                  </button>
                )}

                {episodeEditMode && (
                  <button
                    onClick={() =>
                      editEpisodeTitle(
                        episode.id,
                        episode.title
                      )
                    }
                    className="border border-white/40 px-4 py-2 rounded-xl hover:bg-white hover:text-black transition"
                  >
                    수정
                  </button>
                )}

              </div>

            </div>

          ))}

          {episodes.length === 0 && (
            <p className="text-white/40">
              아직 에피소드가 없어.
            </p>
          )}

        </div>

      </section>

    </main>
  );
}