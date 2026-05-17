"use client";

import { useEffect, useMemo, useState } from "react";
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

type EditedEpisode = {
  title: string;
  episode_no: string;
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
    Record<number, EditedEpisode>
  >({});

  const [deleteTargets, setDeleteTargets] = useState<number[]>([]);

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
      .order("episode_no", { ascending: true });

    if (error) {
      alert(error.message);
      return;
    }

    setEpisodes(data || []);
  }

  async function touchWebtoon() {
    await supabase
      .from("webtoons")
      .update({
        updated_at: new Date().toISOString(),
      })
      .eq("id", webtoonId);
  }

  function startEpisodeEditMode() {
    const initial: Record<number, EditedEpisode> = {};

    episodes.forEach((episode) => {
      initial[episode.id] = {
        title: episode.title || "",
        episode_no: String(episode.episode_no),
      };
    });

    setEditedEpisodes(initial);
    setDeleteTargets([]);
    setEpisodeDeleteMode(false);
    setEpisodeEditMode(true);
  }

  function cancelEpisodeModes() {
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
        episode_no: prev[id]?.episode_no || "",
      },
    }));
  }

  function updateEditedEpisodeNo(id: number, value: string) {
    setEditedEpisodes((prev) => ({
      ...prev,
      [id]: {
        title: prev[id]?.title || "",
        episode_no: value,
      },
    }));
  }

  const hasEpisodeChanges = useMemo(() => {
    return episodes.some((episode) => {
      const edited = editedEpisodes[episode.id];

      if (!edited) return false;

      return (
        edited.title !== (episode.title || "") ||
        edited.episode_no !== String(episode.episode_no)
      );
    });
  }, [episodes, editedEpisodes]);

  async function completeEpisodeEdit() {
    if (!hasEpisodeChanges) return;

    for (const episode of episodes) {
      const edited = editedEpisodes[episode.id];

      if (!edited) continue;

      const parsedNo = Number(edited.episode_no);

      if (!edited.episode_no.trim()) {
        alert("화수를 입력해줘.");
        return;
      }

      if (!Number.isInteger(parsedNo) || parsedNo <= 0) {
        alert("화수는 1 이상의 숫자만 가능해.");
        return;
      }
    }

    const usedNumbers = new Set<number>();

    for (const episode of episodes) {
      const edited = editedEpisodes[episode.id];

      if (!edited) continue;

      const parsedNo = Number(edited.episode_no);

      if (usedNumbers.has(parsedNo)) {
        alert("같은 화수가 중복됐어.");
        return;
      }

      usedNumbers.add(parsedNo);
    }

    for (const episode of episodes) {
      const edited = editedEpisodes[episode.id];

      if (!edited) continue;

      const { error } = await supabase
        .from("episodes")
        .update({
          title: edited.title.trim(),
          episode_no: Number(edited.episode_no),
        })
        .eq("id", episode.id);

      if (error) {
        alert(error.message);
        return;
      }
    }

    await touchWebtoon();

    alert("에피소드 수정 완료!");

    cancelEpisodeModes();
    getEpisodes();
  }

  function toggleDeleteTarget(id: number) {
    if (deleteTargets.includes(id)) {
      setDeleteTargets(deleteTargets.filter((target) => target !== id));
    } else {
      setDeleteTargets([...deleteTargets, id]);
    }
  }

  async function completeEpisodeDelete() {
    if (deleteTargets.length === 0) {
      cancelEpisodeModes();
      return;
    }

    const ok = confirm(`${deleteTargets.length}개의 에피소드를 삭제할까?`);

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

    alert("삭제 완료!");

    cancelEpisodeModes();
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
    <main className="min-h-screen bg-black text-white px-4 md:px-8 py-6 md:py-8">
      <div className="mb-8 flex items-center justify-between">
        <Link
          href="/library"
          className="border border-white px-4 py-2 rounded-full hover:bg-white hover:text-black transition"
        >
          ← LIBRARY
        </Link>
      </div>

      <section className="flex flex-col md:flex-row gap-6 md:gap-10 mb-12">
        <div className="w-full md:w-1/3 aspect-[2/1] overflow-hidden rounded-3xl border border-white/10">
          <img
            src={webtoon.main_image_url || webtoon.cover_url}
            alt=""
            className="w-full h-full object-cover"
          />
        </div>

        <div className="flex-1">
          <h1 className="text-3xl md:text-5xl font-bold mb-4">
            {webtoon.title}
          </h1>

          <p className="text-white/70 leading-relaxed whitespace-pre-wrap">
            {webtoon.description || "설명이 없는 작품"}
          </p>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
          <h2 className="text-3xl font-bold">EPISODES</h2>

          <div className="flex items-center gap-2 flex-wrap justify-end">
            {!episodeEditMode && (
              <button
                onClick={startEpisodeEditMode}
                className={buttonClass}
              >
                에피소드 수정
              </button>
            )}

            {episodeEditMode && (
              <>
                <Link href="/upload" className={buttonClass}>
                  에피소드 추가
                </Link>

                <button
                  onClick={() =>
                    setEpisodeDeleteMode(!episodeDeleteMode)
                  }
                  className={
                    episodeDeleteMode
                      ? deleteActiveClass
                      : deleteButtonClass
                  }
                >
                  에피소드 삭제
                </button>

                {hasEpisodeChanges && (
                  <button
                    onClick={completeEpisodeEdit}
                    className={activeButtonClass}
                  >
                    완료
                  </button>
                )}

                {episodeDeleteMode && deleteTargets.length > 0 && (
                  <button
                    onClick={completeEpisodeDelete}
                    className={deleteActiveClass}
                  >
                    삭제 완료
                  </button>
                )}

                <button
                  onClick={cancelEpisodeModes}
                  className={buttonClass}
                >
                  취소
                </button>
              </>
            )}

            <div className="text-white/50 text-sm ml-1">
              총 {episodes.length}화
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          {episodes.map((episode) => {
            const edited = editedEpisodes[episode.id];
            const selectedDelete = deleteTargets.includes(episode.id);

            return (
              <div
                key={episode.id}
                className={`border rounded-2xl px-5 py-5 transition ${
                  selectedDelete
                    ? "border-red-500 bg-red-500/10"
                    : "border-white/10 hover:bg-white/5"
                }`}
              >
                {!episodeEditMode && (
                  <Link href={`/viewer/${episode.id}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-bold text-lg truncate">
                        {episode.title || "제목 없음"}
                      </div>

                      <div className="text-white/50 text-sm whitespace-nowrap">
                        {episode.episode_no}화
                      </div>
                    </div>
                  </Link>
                )}

                {episodeEditMode && edited && (
                  <div className="flex items-center gap-3">
                    <input
                      value={edited.title}
                      onChange={(e) =>
                        updateEditedEpisodeTitle(
                          episode.id,
                          e.target.value
                        )
                      }
                      className="flex-1 bg-black border border-white/20 rounded-xl px-4 py-3 outline-none text-white font-bold"
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
                      className="w-[90px] bg-black border border-white/20 rounded-xl px-3 py-3 outline-none text-center text-white"
                    />

                    {episodeDeleteMode && (
                      <button
                        onClick={() =>
                          toggleDeleteTarget(episode.id)
                        }
                        className={`px-4 py-3 rounded-xl text-sm transition whitespace-nowrap ${
                          selectedDelete
                            ? "bg-red-500 text-white"
                            : "border border-red-500 text-red-400"
                        }`}
                      >
                        {selectedDelete ? "선택됨" : "삭제"}
                      </button>
                    )}
                  </div>
                )}
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

const buttonClass =
  "border border-white/20 px-4 py-2 rounded-xl hover:bg-white hover:text-black transition whitespace-nowrap";

const activeButtonClass =
  "border border-white px-4 py-2 rounded-xl bg-white text-black transition whitespace-nowrap";

const deleteButtonClass =
  "border border-red-500 text-red-400 px-4 py-2 rounded-xl hover:bg-red-500 hover:text-white transition whitespace-nowrap";

const deleteActiveClass =
  "border border-red-500 bg-red-500 text-white px-4 py-2 rounded-xl transition whitespace-nowrap";