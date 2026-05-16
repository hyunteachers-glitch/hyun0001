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
  title: string | null;
  episode_no: number;
  deleted: boolean;
};

export default function WebtoonDetailPage() {
  const params = useParams();
  const router = useRouter();
  const webtoonId = Number(params.id);

  const [webtoon, setWebtoon] = useState<Webtoon | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);

  const [episodeEditMode, setEpisodeEditMode] = useState(false);
  const [episodeDeleteMode, setEpisodeDeleteMode] = useState(false);

  const [editedEpisodes, setEditedEpisodes] = useState<
    Record<number, { title: string; episode_no: string }>
  >({});

  const [deleteTargets, setDeleteTargets] = useState<number[]>([]);

  useEffect(() => {
    if (!webtoonId) return;

    getWebtoon();
    getEpisodes();
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
      .order("episode_no", { ascending: true })
      .order("id", { ascending: true });

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

  function startEditMode() {
    const initial: Record<number, { title: string; episode_no: string }> = {};

    episodes.forEach((episode) => {
      initial[episode.id] = {
        title: episode.title ?? "",
        episode_no: String(episode.episode_no ?? ""),
      };
    });

    setEditedEpisodes(initial);
    setEpisodeEditMode(true);
    setEpisodeDeleteMode(false);
    setDeleteTargets([]);
  }

  function startDeleteMode() {
    setDeleteTargets([]);
    setEpisodeDeleteMode(true);
    setEpisodeEditMode(false);
    setEditedEpisodes({});
  }

  function cancelModes() {
    setEpisodeEditMode(false);
    setEpisodeDeleteMode(false);
    setEditedEpisodes({});
    setDeleteTargets([]);
  }

  function updateEditedEpisodeTitle(id: number, value: string) {
    setEditedEpisodes((prev) => ({
      ...prev,
      [id]: {
        title: value,
        episode_no: prev[id]?.episode_no ?? "",
      },
    }));
  }

  function updateEditedEpisodeNo(id: number, value: string) {
    setEditedEpisodes((prev) => ({
      ...prev,
      [id]: {
        title: prev[id]?.title ?? "",
        episode_no: value,
      },
    }));
  }

  function toggleDeleteTarget(id: number) {
    if (deleteTargets.includes(id)) {
      setDeleteTargets(deleteTargets.filter((target) => target !== id));
    } else {
      setDeleteTargets([...deleteTargets, id]);
    }
  }

  async function completeEpisodeEdit() {
    for (const episode of episodes) {
      const edited = editedEpisodes[episode.id];

      if (!edited) continue;

      const newTitle = edited.title;

      const newEpisodeNo = Number(edited.episode_no);

      if (edited.episode_no.trim() === "") {
        alert("화 번호는 비울 수 없어.");
        return;
      }

      if (
        !Number.isInteger(newEpisodeNo) ||
        newEpisodeNo <= 0
      ) {
        alert("화 번호는 1 이상의 숫자여야 해.");
        return;
      }

      const { error } = await supabase
        .from("episodes")
        .update({
          title: newTitle,
          episode_no: newEpisodeNo,
        })
        .eq("id", episode.id);

      if (error) {
        alert(error.message);
        return;
      }
    }

    await touchWebtoon();

    alert("에피소드 수정 완료!");

    cancelModes();

    getEpisodes();
  }

  async function completeEpisodeDelete() {
    if (deleteTargets.length === 0) {
      alert("삭제할 에피소드를 선택해줘.");
      return;
    }

    const ok = confirm(
      "선택한 에피소드를 삭제할까?"
    );

    if (!ok) return;

    const { error } = await supabase
      .from("episodes")
      .update({
        deleted: true,
      })
      .in("id", deleteTargets);

    if (error) {
      alert(error.message);
      return;
    }

    await touchWebtoon();

    alert("에피소드 삭제 완료!");

    cancelModes();

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

          <div className="flex gap-3 flex-wrap">

            <Link
              href="/upload"
              className="border border-white px-5 py-3 rounded-xl hover:bg-white hover:text-black transition"
            >
              에피소드 추가
            </Link>

            <button
              onClick={
                episodeEditMode
                  ? completeEpisodeEdit
                  : startEditMode
              }
              className={`px-5 py-3 rounded-xl transition border ${
                episodeEditMode
                  ? "bg-white text-black border-white"
                  : "border-white/40 text-white hover:bg-white hover:text-black"
              }`}
            >
              {episodeEditMode
                ? "수정 완료"
                : "에피소드 수정"}
            </button>

            <button
              onClick={
                episodeDeleteMode
                  ? completeEpisodeDelete
                  : startDeleteMode
              }
              className={`px-5 py-3 rounded-xl transition border ${
                episodeDeleteMode
                  ? "bg-red-500 text-white border-red-500"
                  : "border-red-500 text-red-400 hover:bg-red-500 hover:text-white"
              }`}
            >
              {episodeDeleteMode
                ? "삭제 완료"
                : "에피소드 삭제"}
            </button>

            {(episodeEditMode || episodeDeleteMode) && (
              <button
                onClick={cancelModes}
                className="border border-white/30 px-5 py-3 rounded-xl hover:bg-white hover:text-black transition"
              >
                취소
              </button>
            )}

          </div>

        </div>

        <div className="flex flex-col gap-3">

          {episodes.map((episode) => {

            const isDeleteTarget =
              deleteTargets.includes(episode.id);

            const edited =
              editedEpisodes[episode.id];

            return (
              <div
                key={episode.id}
                className={`border rounded-2xl px-6 py-5 ${
                  isDeleteTarget
                    ? "border-red-500 bg-red-500/10"
                    : "border-white/10"
                }`}
              >

                <div className="flex items-center justify-between gap-4">

                  {!episodeEditMode &&
                    !episodeDeleteMode && (

                    <Link
                      href={`/viewer/${episode.id}`}
                      className="flex-1"
                    >

                      <div className="flex items-center justify-between">

                        <div className="text-xl font-bold">
                          {episode.title ||
                            "제목 없는 에피소드"}
                        </div>

                        <div className="text-sm opacity-60">
                          {episode.episode_no}화
                        </div>

                      </div>

                    </Link>

                  )}

                  {episodeEditMode &&
                    edited && (

                    <div className="flex flex-1 gap-3 items-center">

                      <input
                        type="text"
                        value={edited.title}
                        onChange={(e) =>
                          updateEditedEpisodeTitle(
                            episode.id,
                            e.target.value
                          )
                        }
                        placeholder="에피소드 이름"
                        className="flex-1 bg-black border border-white/20 rounded-xl px-4 py-3 outline-none text-white"
                      />

                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={edited.episode_no}
                        onChange={(e) =>
                          updateEditedEpisodeNo(
                            episode.id,
                            e.target.value
                          )
                        }
                        placeholder="화 번호"
                        className="w-28 bg-black border border-white/20 rounded-xl px-4 py-3 outline-none text-center text-white"
                      />

                    </div>

                  )}

                  {episodeDeleteMode && (

                    <button
                      onClick={() =>
                        toggleDeleteTarget(
                          episode.id
                        )
                      }
                      className="flex-1 text-left"
                    >

                      <div className="flex items-center justify-between">

                        <div className="text-xl font-bold">
                          {episode.title ||
                            "제목 없는 에피소드"}
                        </div>

                        <div className="text-sm opacity-60">
                          {episode.episode_no}화
                        </div>

                      </div>

                    </button>

                  )}

                  {episodeDeleteMode && (

                    <button
                      onClick={() =>
                        toggleDeleteTarget(
                          episode.id
                        )
                      }
                      className={`border px-4 py-2 rounded-xl transition ${
                        isDeleteTarget
                          ? "bg-red-500 text-white border-red-500"
                          : "border-red-500 text-red-400 hover:bg-red-500 hover:text-white"
                      }`}
                    >
                      {isDeleteTarget
                        ? "선택됨"
                        : "선택"}
                    </button>

                  )}

                </div>

              </div>
            );
          })}

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