"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
  const router = useRouter();
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

      <div className="fixed top-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-md border-b border-white/10">

        <div className="h-16 px-6 flex items-center justify-between">

          {/* 좌측 */}
          <Link
            href={`/library/${episode.webtoon_id}`}
            className="text-white/60 hover:text-white transition whitespace-nowrap"
          >
            ← 작품으로
          </Link>

          {/* 중앙 */}
          <div className="absolute left-1/2 -translate-x-1/2 text-xl font-bold whitespace-nowrap">
            {episode.episode_no}화 ·{" "}
            {episode.title || "제목 없음"}
          </div>

          {/* 우측 */}
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

      </div>

      <div className="pt-16 pb-24 flex flex-col items-center">

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
      <div className="fixed right-8 bottom-8 flex flex-col gap-3">

        <button
          onClick={scrollTop}
          className="border border-white/20 bg-black/80 backdrop-blur-md text-white px-5 py-3 rounded-full hover:bg-white hover:text-black transition"
        >
          ↑ 맨 위
        </button>

        <button
          onClick={scrollBottom}
          className="border border-white/20 bg-black/80 backdrop-blur-md text-white px-5 py-3 rounded-full hover:bg-white hover:text-black transition"
        >
          ↓ 맨 아래
        </button>

      </div>

    </main>
  );
}