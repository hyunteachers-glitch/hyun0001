"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../supabase";

type Episode = {
  id: number;
  title: string | null;
  episode_no: number;
  webtoon_id: number;
};

type EpisodeImage = {
  id: number;
  image_url: string;
  image_order: number;
};

export default function ViewerPage() {
  const params = useParams();
  const episodeId = Number(params.episode);

  const [episode, setEpisode] = useState<Episode | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [images, setImages] = useState<EpisodeImage[]>([]);

  useEffect(() => {
    if (!episodeId) return;
    loadViewer();
  }, [episodeId]);

  async function loadViewer() {
    const { data: episodeData, error: episodeError } = await supabase
      .from("episodes")
      .select("*")
      .eq("id", episodeId)
      .single();

    if (episodeError) {
      alert(episodeError.message);
      return;
    }

    setEpisode(episodeData);

    const { data: episodeList, error: listError } = await supabase
      .from("episodes")
      .select("*")
      .eq("webtoon_id", episodeData.webtoon_id)
      .eq("deleted", false)
      .order("episode_no", { ascending: true })
      .order("id", { ascending: true });

    if (listError) {
      alert(listError.message);
      return;
    }

    setEpisodes(episodeList || []);

    const { data: imageData, error: imageError } = await supabase
      .from("episode_images")
      .select("*")
      .eq("episode_id", episodeId)
      .order("image_order", { ascending: true });

    if (imageError) {
      alert(imageError.message);
      return;
    }

    setImages(imageData || []);
  }

  const currentIndex = episodes.findIndex(
    (item) => item.id === episodeId
  );

  const previousEpisode =
    currentIndex > 0
      ? episodes[currentIndex - 1]
      : null;

  const nextEpisode =
    currentIndex >= 0 &&
    currentIndex < episodes.length - 1
      ? episodes[currentIndex + 1]
      : null;

  function scrollTop() {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function scrollBottom() {
    window.scrollTo({
      top: document.body.scrollHeight,
      behavior: "smooth",
    });
  }

  if (!episode) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        loading...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white">

      {/* 상단바 */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-md border-b border-white/10">

        {/* PC */}
        <div className="hidden md:flex h-16 px-6 items-center justify-between">

          <Link
            href={`/library/${episode.webtoon_id}`}
            className="text-white/60 hover:text-white transition whitespace-nowrap"
          >
            ← 작품으로
          </Link>

          <div className="absolute left-1/2 -translate-x-1/2 text-xl font-bold whitespace-nowrap">
            {episode.episode_no}화 ·{" "}
            {episode.title || "제목 없음"}
          </div>

          <div className="flex items-center gap-6">

            {previousEpisode ? (
              <Link
                href={`/viewer/${previousEpisode.id}`}
                className="text-white/70 hover:text-white transition whitespace-nowrap"
              >
                ← 이전화
              </Link>
            ) : (
              <div />
            )}

            {nextEpisode ? (
              <Link
                href={`/viewer/${nextEpisode.id}`}
                className="text-white/70 hover:text-white transition whitespace-nowrap"
              >
                다음화 →
              </Link>
            ) : (
              <div />
            )}

          </div>

        </div>

        {/* 모바일 */}
        <div className="md:hidden px-4 py-3 flex flex-col gap-3">

          <div className="flex items-center justify-between">

            <Link
              href={`/library/${episode.webtoon_id}`}
              className="text-sm text-white/60"
            >
              ← 작품으로
            </Link>

            <div className="flex items-center gap-4 text-sm">

              {previousEpisode && (
                <Link
                  href={`/viewer/${previousEpisode.id}`}
                  className="text-white/70"
                >
                  ← 이전화
                </Link>
              )}

              {nextEpisode && (
                <Link
                  href={`/viewer/${nextEpisode.id}`}
                  className="text-white/70"
                >
                  다음화 →
                </Link>
              )}

            </div>

          </div>

          <div className="text-center font-bold text-base break-keep">
            {episode.episode_no}화 ·{" "}
            {episode.title || "제목 없음"}
          </div>

        </div>

      </div>

      {/* 이미지 */}
      <div className="pt-20 md:pt-16 pb-24 flex flex-col items-center">

        {images.map((image) => (
          <img
            key={image.id}
            src={image.image_url}
            alt=""
            className="w-full max-w-[720px] block"
          />
        ))}

        {images.length === 0 && (
          <p className="text-white/40 mt-20">
            이미지가 없어.
          </p>
        )}

      </div>

      {/* 스크롤 버튼 */}
      <div className="fixed right-3 md:right-8 bottom-3 md:bottom-8 flex flex-col gap-2 md:gap-3">

        <button
          onClick={scrollTop}
          className="border border-white/20 bg-black/80 backdrop-blur-md text-white px-4 md:px-5 py-2 md:py-3 rounded-full hover:bg-white hover:text-black transition text-sm md:text-base"
        >
          ↑ 위
        </button>

        <button
          onClick={scrollBottom}
          className="border border-white/20 bg-black/80 backdrop-blur-md text-white px-4 md:px-5 py-2 md:py-3 rounded-full hover:bg-white hover:text-black transition text-sm md:text-base"
        >
          ↓ 아래
        </button>

      </div>

    </main>
  );
}