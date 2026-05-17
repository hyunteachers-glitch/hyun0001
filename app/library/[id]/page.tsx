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
  const [images, setImages] = useState<ImageItem[]>([]);

  const [selectImageMode, setSelectImageMode] = useState(false);
  const [editTitleMode, setEditTitleMode] = useState(false);
  const [editDescriptionMode, setEditDescriptionMode] = useState(false);

  const [titleInput, setTitleInput] = useState("");
  const [descriptionInput, setDescriptionInput] = useState("");

  const [episodeEditMode, setEpisodeEditMode] = useState(false);
  const [episodeDeleteMode, setEpisodeDeleteMode] = useState(false);
  const [editedEpisodes, setEditedEpisodes] = useState<Record<number, EditedEpisode>>({});
  const [deleteTargets, setDeleteTargets] = useState<number[]>([]);

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
      if (error.code === "23505") {
        alert("이미 같은 제목의 작품이 있어.");
        return;
      }

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

  function startEpisodeDeleteMode() {
    setDeleteTargets([]);
    setEditedEpisodes({});
    setEpisodeEditMode(false);
    setEpisodeDeleteMode(true);
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

  async function completeEpisodeEdit() {
    for (const episode of episodes) {
      const edited = editedEpisodes[episode.id];
      if (!edited) continue;

      const episodeNo = Number(edited.episode_no);

      if (!edited.episode_no.trim()) {
        alert("화수는 비워둘 수 없어.");
        return;
      }

      if (!Number.isInteger(episodeNo) || episodeNo <= 0) {
        alert("화수는 1 이상의 정수로 입력해줘.");
        return;
      }
    }

    const usedNumbers = new Set<number>();

    for (const episode of episodes) {
      const edited = editedEpisodes[episode.id];
      if (!edited) continue;

      const episodeNo = Number(edited.episode_no);

      if (usedNumbers.has(episodeNo)) {
        alert("같은 화수가 중복되어 있어.");
        return;
      }

      usedNumbers.add(episodeNo);
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
      .update({ deleted: true })
      .in("id", deleteTargets);

    if (error) {
      alert(error.message);
      return;
    }

    await touchWebtoon();

    alert("에피소드 삭제 완료!");
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
          <div className="flex items-center justify-between gap-3 mb-6">
            <h2 className="text-2xl md:text-3xl font-bold">EPISODES</h2>

            <div className="flex items-center gap-2 flex-wrap justify-end">
              <Link href="/upload" className={episodeButtonClass}>
                에피소드 추가
              </Link>

              <button
                onClick={episodeEditMode ? completeEpisodeEdit : startEpisodeEditMode}
                className={episodeEditMode ? episodeActiveButtonClass : episodeButtonClass}
              >
                {episodeEditMode ? "수정 완료" : "에피소드 수정"}
              </button>

              <button
                onClick={
                  episodeDeleteMode ? completeEpisodeDelete : startEpisodeDeleteMode
                }
                className={
                  episodeDeleteMode ? episodeDeleteActiveButtonClass : episodeDeleteButtonClass
                }
              >
                {episodeDeleteMode ? "삭제 완료" : "에피소드 삭제"}
              </button>

              {(episodeEditMode || episodeDeleteMode) && (
                <button onClick={cancelEpisodeModes} className={episodeButtonClass}>
                  취소
                </button>
              )}

              <div className="text-white/50 text-sm md:text-base ml-1">
                총 {episodes.length}화
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {episodes.map((episode) => {
              const edited = editedEpisodes[episode.id];
              const isDeleteTarget = deleteTargets.includes(episode.id);

              return (
                <div
                  key={episode.id}
                  className={`border rounded-2xl px-4 md:px-6 py-4 transition ${
                    isDeleteTarget
                      ? "border-red-500 bg-red-500/10"
                      : "border-white/10 hover:bg-white/5"
                  }`}
                >
                  {!episodeEditMode && !episodeDeleteMode && (
                    <Link href={`/viewer/${episode.id}`}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-base md:text-lg font-bold truncate">
                          {episode.title || "제목 없는 에피소드"}
                        </div>

                        <div className="text-xs md:text-sm text-white/50 whitespace-nowrap">
                          {episode.episode_no}화
                        </div>
                      </div>
                    </Link>
                  )}

                  {episodeEditMode && edited && (
                    <div className="flex items-center gap-2 md:gap-3">
                      <input
                        value={edited.title}
                        onChange={(e) =>
                          updateEditedEpisodeTitle(episode.id, e.target.value)
                        }
                        placeholder="에피소드 제목"
                        className="flex-1 min-w-0 bg-black border border-white/20 rounded-xl px-3 md:px-4 py-2 md:py-3 outline-none text-white text-sm md:text-base font-bold"
                      />

                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={edited.episode_no}
                        onChange={(e) =>
                          updateEditedEpisodeNo(episode.id, e.target.value)
                        }
                        placeholder="화수"
                        className="w-[74px] md:w-[110px] bg-black border border-white/20 rounded-xl px-2 md:px-4 py-2 md:py-3 outline-none text-center text-white text-sm md:text-base"
                      />
                    </div>
                  )}

                  {episodeDeleteMode && (
                    <button
                      onClick={() => toggleDeleteTarget(episode.id)}
                      className="w-full text-left"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-base md:text-lg font-bold truncate">
                          {episode.title || "제목 없는 에피소드"}
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="text-xs md:text-sm text-white/50 whitespace-nowrap">
                            {episode.episode_no}화
                          </div>

                          <div
                            className={`border px-3 py-1 rounded-xl text-xs md:text-sm ${
                              isDeleteTarget
                                ? "border-red-500 bg-red-500 text-white"
                                : "border-red-500 text-red-400"
                            }`}
                          >
                            {isDeleteTarget ? "선택됨" : "선택"}
                          </div>
                        </div>
                      </div>
                    </button>
                  )}
                </div>
              );
            })}

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

const episodeButtonClass =
  "border border-white/30 px-3 md:px-4 py-2 rounded-xl hover:bg-white hover:text-black transition text-xs md:text-sm whitespace-nowrap";

const episodeActiveButtonClass =
  "border border-white px-3 md:px-4 py-2 rounded-xl bg-white text-black transition text-xs md:text-sm whitespace-nowrap";

const episodeDeleteButtonClass =
  "border border-red-500 text-red-400 px-3 md:px-4 py-2 rounded-xl hover:bg-red-500 hover:text-white transition text-xs md:text-sm whitespace-nowrap";

const episodeDeleteActiveButtonClass =
  "border border-red-500 bg-red-500 text-white px-3 md:px-4 py-2 rounded-xl transition text-xs md:text-sm whitespace-nowrap";