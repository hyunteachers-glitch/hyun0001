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

  const [infoEditMode, setInfoEditMode] = useState(false);
  const [mainImageEditMode, setMainImageEditMode] = useState(false);
  const [textCoverEditMode, setTextCoverEditMode] = useState(false);

  const [titleInput, setTitleInput] = useState("");
  const [descriptionInput, setDescriptionInput] = useState("");
  const [coverInput, setCoverInput] = useState("");
  const [mainImageInput, setMainImageInput] = useState("");

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
    setCoverInput(data.cover_url || "");
    setMainImageInput(data.main_image_url || "");
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

  function openInfoEdit() {
    if (!webtoon) return;

    setInfoEditMode(true);
    setMainImageEditMode(false);
    setTextCoverEditMode(false);

    setTitleInput(webtoon.title || "");
    setDescriptionInput(webtoon.description || "");
    setCoverInput(webtoon.cover_url || "");
    setMainImageInput(webtoon.main_image_url || "");
  }

  function cancelInfoEdit() {
    if (!webtoon) return;

    setInfoEditMode(false);
    setMainImageEditMode(false);
    setTextCoverEditMode(false);

    setTitleInput(webtoon.title || "");
    setDescriptionInput(webtoon.description || "");
    setCoverInput(webtoon.cover_url || "");
    setMainImageInput(webtoon.main_image_url || "");
  }

  const hasInfoChanges = useMemo(() => {
    if (!webtoon) return false;

    return (
      titleInput.trim() !== (webtoon.title || "") ||
      descriptionInput !== (webtoon.description || "") ||
      coverInput !== (webtoon.cover_url || "") ||
      mainImageInput !== (webtoon.main_image_url || "")
    );
  }, [webtoon, titleInput, descriptionInput, coverInput, mainImageInput]);

  async function completeInfoEdit() {
    if (!webtoon) return;

    if (!titleInput.trim()) {
      alert("제목을 입력해줘.");
      return;
    }

    if (!coverInput) {
      alert("썸네일을 선택해줘.");
      return;
    }

    if (!mainImageInput) {
      alert("메인사진을 선택해줘.");
      return;
    }

    const { error } = await supabase
      .from("webtoons")
      .update({
        title: titleInput.trim(),
        description: descriptionInput,
        cover_url: coverInput,
        main_image_url: mainImageInput,
      })
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

    alert("작품 정보 수정 완료!");
    setInfoEditMode(false);
    setMainImageEditMode(false);
    setTextCoverEditMode(false);
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

    episodes.forEach((episode, index) => {
      initial[episode.id] = {
        title: episode.title || "",
        episode_no: String(index + 1),
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
    return episodes.some((episode, index) => {
      const edited = editedEpisodes[episode.id];
      if (!edited) return false;

      return (
        edited.title !== (episode.title || "") ||
        edited.episode_no !== String(index + 1)
      );
    });
  }, [episodes, editedEpisodes]);

  async function completeEpisodeEdit() {
    if (!hasEpisodeChanges) return;

    for (const episode of episodes) {
      const edited = editedEpisodes[episode.id];
      if (!edited) continue;

      const targetNo = Number(edited.episode_no);

      if (!edited.episode_no.trim()) {
        alert("화수를 입력해줘.");
        return;
      }

      if (!Number.isInteger(targetNo) || targetNo <= 0) {
        alert("화수는 1 이상의 숫자만 가능해.");
        return;
      }
    }

    const reordered = [...episodes].sort((a, b) => {
      const aEdited = editedEpisodes[a.id];
      const bEdited = editedEpisodes[b.id];

      const aTarget = Number(aEdited?.episode_no || 999999);
      const bTarget = Number(bEdited?.episode_no || 999999);

      const aOriginalIndex = episodes.findIndex((item) => item.id === a.id);
      const bOriginalIndex = episodes.findIndex((item) => item.id === b.id);

      const aChanged = aEdited?.episode_no !== String(aOriginalIndex + 1);
      const bChanged = bEdited?.episode_no !== String(bOriginalIndex + 1);

      if (aTarget !== bTarget) return aTarget - bTarget;
      if (aChanged && !bChanged) return -1;
      if (!aChanged && bChanged) return 1;

      return aOriginalIndex - bOriginalIndex;
    });

    for (let index = 0; index < reordered.length; index++) {
      const episode = reordered[index];
      const edited = editedEpisodes[episode.id];

      const { error } = await supabase
        .from("episodes")
        .update({
          title: edited?.title.trim() || "",
          episode_no: index + 1,
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

  async function normalizeEpisodeNumbers() {
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

    for (let index = 0; index < (data || []).length; index++) {
      const episode = data![index];

      const { error: updateError } = await supabase
        .from("episodes")
        .update({ episode_no: index + 1 })
        .eq("id", episode.id);

      if (updateError) {
        alert(updateError.message);
        return;
      }
    }
  }

  async function completeEpisodeDelete() {
    if (deleteTargets.length === 0) {
      setEpisodeDeleteMode(false);
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

    await normalizeEpisodeNumbers();
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
      <div className="mb-8 flex items-center justify-between gap-3">
        <Link href="/library" className={topButtonClass}>
          ← LIBRARY
        </Link>

        {!infoEditMode ? (
          <button onClick={openInfoEdit} className={topButtonClass}>
            작품 정보 수정
          </button>
        ) : (
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <button
              onClick={() => {
                setMainImageEditMode(!mainImageEditMode);
                setTextCoverEditMode(false);
              }}
              className={mainImageEditMode ? activeTopButtonClass : topButtonClass}
            >
              사진 수정
            </button>

            <button
              onClick={() => {
                setTextCoverEditMode(!textCoverEditMode);
                setMainImageEditMode(false);
              }}
              className={textCoverEditMode ? activeTopButtonClass : topButtonClass}
            >
              제목 및 썸네일 수정
            </button>

            {hasInfoChanges && (
              <button onClick={completeInfoEdit} className={activeTopButtonClass}>
                완료
              </button>
            )}

            <button onClick={cancelInfoEdit} className={topButtonClass}>
              취소
            </button>

            <button onClick={moveToTrash} className={topDeleteButtonClass}>
              삭제
            </button>
          </div>
        )}
      </div>

      <section className="flex flex-col md:flex-row gap-6 md:gap-10 mb-12">
        <div className="w-full md:w-1/3 aspect-[2/1] overflow-hidden rounded-3xl border border-white/10">
          <img
            src={mainImageInput || webtoon.main_image_url || webtoon.cover_url}
            alt=""
            className="w-full h-full object-cover"
          />
        </div>

        <div className="flex-1">
          {textCoverEditMode ? (
            <div className="flex flex-col gap-3">
              <input
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                className="bg-black border border-white/25 rounded-2xl px-4 py-3 text-white outline-none text-2xl md:text-4xl font-bold"
                placeholder="작품 제목"
              />

              <textarea
                value={descriptionInput}
                onChange={(e) => setDescriptionInput(e.target.value)}
                className="bg-black border border-white/25 rounded-2xl px-4 py-3 text-white outline-none min-h-[110px] resize-y"
                placeholder="작품 설명"
              />

              {coverInput && (
                <div>
                  <p className="text-white/50 text-sm mb-2">선택한 썸네일</p>
                  <img
                    src={coverInput}
                    alt=""
                    className="w-[110px] h-[110px] object-cover rounded-xl border border-white/20"
                  />
                </div>
              )}
            </div>
          ) : (
            <>
              <h1 className="text-3xl md:text-5xl font-bold mb-4">
                {titleInput || webtoon.title}
              </h1>

              <p className="text-white/70 leading-relaxed whitespace-pre-wrap">
                {descriptionInput || webtoon.description || "설명이 없는 작품"}
              </p>
            </>
          )}
        </div>
      </section>

      {infoEditMode && mainImageEditMode && (
        <section className="mb-10">
          <h2 className="text-xl font-bold mb-4">메인사진 선택</h2>

          <div className="grid grid-cols-3 md:grid-cols-8 gap-3">
            {images.map((image) => (
              <button
                key={image.id}
                onClick={() => setMainImageInput(image.url)}
                className={`relative aspect-square overflow-hidden rounded-xl border ${
                  mainImageInput === image.url
                    ? "border-red-500 border-2"
                    : "border-white/15"
                }`}
              >
                <img src={image.url} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </section>
      )}

      {infoEditMode && textCoverEditMode && (
        <section className="mb-10">
          <h2 className="text-xl font-bold mb-4">썸네일 선택</h2>

          <div className="grid grid-cols-3 md:grid-cols-8 gap-3">
            {images.map((image) => (
              <button
                key={image.id}
                onClick={() => setCoverInput(image.url)}
                className={`relative aspect-square overflow-hidden rounded-xl border ${
                  coverInput === image.url
                    ? "border-red-500 border-2"
                    : "border-white/15"
                }`}
              >
                <img src={image.url} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
          <h2 className="text-3xl font-bold">EPISODES</h2>

          <div className="flex items-center gap-2 flex-wrap justify-end">
            {!episodeEditMode && (
              <button onClick={startEpisodeEditMode} className={episodeButtonClass}>
                에피소드 수정
              </button>
            )}

            {episodeEditMode && (
              <>
                <Link href="/upload" className={episodeButtonClass}>
                  에피소드 추가
                </Link>

                <button
                  onClick={() => setEpisodeDeleteMode(!episodeDeleteMode)}
                  className={
                    episodeDeleteMode
                      ? episodeDeleteActiveButtonClass
                      : episodeDeleteButtonClass
                  }
                >
                  에피소드 삭제
                </button>

                {hasEpisodeChanges && (
                  <button onClick={completeEpisodeEdit} className={episodeActiveButtonClass}>
                    완료
                  </button>
                )}

                {episodeDeleteMode && deleteTargets.length > 0 && (
                  <button onClick={completeEpisodeDelete} className={episodeDeleteActiveButtonClass}>
                    삭제 완료
                  </button>
                )}

                <button onClick={cancelEpisodeModes} className={episodeButtonClass}>
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
          {episodes.map((episode, index) => {
            const edited = editedEpisodes[episode.id];
            const selectedDelete = deleteTargets.includes(episode.id);
            const displayEpisodeNo = index + 1;

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
                        {displayEpisodeNo}화
                      </div>
                    </div>
                  </Link>
                )}

                {episodeEditMode && edited && (
                  <div className="flex items-center gap-3">
                    <input
                      value={edited.title}
                      onChange={(e) =>
                        updateEditedEpisodeTitle(episode.id, e.target.value)
                      }
                      className="flex-1 bg-black border border-white/20 rounded-xl px-4 py-3 outline-none text-white font-bold"
                    />

                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={edited.episode_no}
                      onChange={(e) =>
                        updateEditedEpisodeNo(episode.id, e.target.value)
                      }
                      className="w-[90px] bg-black border border-white/20 rounded-xl px-3 py-3 outline-none text-center text-white"
                    />

                    {episodeDeleteMode && (
                      <button
                        onClick={() => toggleDeleteTarget(episode.id)}
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
            <p className="text-white/40">아직 에피소드가 없어.</p>
          )}
        </div>
      </section>
    </main>
  );
}

const topButtonClass =
  "border border-white/25 px-4 py-2 rounded-full hover:bg-white hover:text-black transition whitespace-nowrap text-sm md:text-base";

const activeTopButtonClass =
  "border border-white px-4 py-2 rounded-full bg-white text-black transition whitespace-nowrap text-sm md:text-base";

const topDeleteButtonClass =
  "border border-red-500 text-red-400 px-4 py-2 rounded-full hover:bg-red-500 hover:text-white transition whitespace-nowrap text-sm md:text-base";

const episodeButtonClass =
  "border border-white/20 px-4 py-2 rounded-xl hover:bg-white hover:text-black transition whitespace-nowrap";

const episodeActiveButtonClass =
  "border border-white px-4 py-2 rounded-xl bg-white text-black transition whitespace-nowrap";

const episodeDeleteButtonClass =
  "border border-red-500 text-red-400 px-4 py-2 rounded-xl hover:bg-red-500 hover:text-white transition whitespace-nowrap";

const episodeDeleteActiveButtonClass =
  "border border-red-500 bg-red-500 text-white px-4 py-2 rounded-xl transition whitespace-nowrap";