"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import PasswordGuard from "../../components/PasswordGuard";
import type { Webtoon } from "@/lib/types";

export default function LibraryTrashPage() {
  const [trashWebtoons, setTrashWebtoons] = useState<Webtoon[]>([]);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    getTrashWebtoons();

    function checkMobile() {
      setIsMobile(window.innerWidth < 768);
    }

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  async function getTrashWebtoons() {
    const { data, error } = await supabase
      .from("webtoons")
      .select("*")
      .eq("deleted", true)
      .order("updated_at", { ascending: false });

    if (error) return alert(error.message);
    setTrashWebtoons(data || []);
  }

  async function restoreWebtoon(id: number) {
    const { error } = await supabase
      .from("webtoons")
      .update({ deleted: false, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) return alert(error.message);

    getTrashWebtoons();
  }

  async function permanentDeleteWebtoon(id: number) {
    const ok = confirm("정말 영구 삭제할까?");
    if (!ok) return;

    const { data: episodes, error: episodesFetchError } = await supabase
      .from("episodes")
      .select("id")
      .eq("webtoon_id", id);

    if (episodesFetchError) {
      alert("에피소드 목록을 불러오는 데 실패했어, 다시 시도해줘.");
      return;
    }

    const episodeIds = episodes?.map((episode) => episode.id) || [];

    if (episodeIds.length > 0) {
      const { error: episodeImagesError } = await supabase
        .from("episode_images")
        .delete()
        .in("episode_id", episodeIds);

      if (episodeImagesError) {
        alert("이미지 삭제에 실패했어, 다시 시도해줘.");
        return;
      }
    }

    const { error: episodesDeleteError } = await supabase
      .from("episodes")
      .delete()
      .eq("webtoon_id", id);

    if (episodesDeleteError) {
      alert("에피소드 삭제에 실패했어, 다시 시도해줘.");
      return;
    }

    const { error: webtoonImagesError } = await supabase
      .from("webtoon_images")
      .delete()
      .eq("webtoon_id", id);

    if (webtoonImagesError) {
      alert("작품 썸네일 이미지 삭제에 실패했어, 다시 시도해줘.");
      return;
    }

    const { error: webtoonDeleteError } = await supabase
      .from("webtoons")
      .delete()
      .eq("id", id);

    if (webtoonDeleteError) {
      alert("작품 삭제에 실패했어, 다시 시도해줘.");
      return;
    }

    getTrashWebtoons();
  }

  const cardWidth = isMobile ? 88 : 190;
  const thumbnailSize = isMobile ? 88 : 190;
  const cardHeight = isMobile ? 132 : 275;

  const gridStyle = {
    display: "grid",
    gridTemplateColumns: isMobile ? "repeat(4, 88px)" : "repeat(6, 190px)",
    gap: isMobile ? "12px" : "20px",
  };

  function Card({ toon }: { toon: Webtoon }) {
    return (
      <div
        style={{
          position: "relative",
          width: cardWidth,
          height: "auto",
          minHeight: cardHeight,
          borderRadius: "14px",
          overflow: "hidden",
          border: "1px solid rgba(239,68,68,0.65)",
          background: "rgba(255,255,255,0.02)",
          color: "white",
        }}
      >
        <div style={{ width: thumbnailSize, height: thumbnailSize, overflow: "hidden" }}>
          <img
            src={toon.cover_url}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        </div>

        <div style={{ padding: isMobile ? "6px" : "9px", paddingBottom: isMobile ? "22px" : "28px" }}>
          <h2
            style={{
              fontSize: isMobile ? "9px" : "15px",
              fontWeight: "bold",
              marginTop: "5px",
              lineHeight: "1.15",
              wordBreak: "keep-all",
            }}
          >
            {toon.title}
          </h2>
        </div>

        <div style={{ padding: isMobile ? "6px" : "9px", paddingTop: 0 }} className="flex flex-col gap-1">
          <button
            onClick={() => restoreWebtoon(toon.id)}
            className="border border-white/30 text-white text-[10px] md:text-xs py-1 rounded-lg hover:bg-white hover:text-black transition"
          >
            복구
          </button>

          <button
            onClick={() => permanentDeleteWebtoon(toon.id)}
            className="border border-red-500 text-red-400 text-[10px] md:text-xs py-1 rounded-lg hover:bg-red-500 hover:text-white transition"
          >
            영구삭제
          </button>
        </div>
      </div>
    );
  }

  return (
    <PasswordGuard>
      <main className="min-h-screen bg-black text-white px-5 md:px-8 py-10 flex flex-col">
        <div className="mb-8">
          <Link
            href="/library"
            aria-label="라이브러리로 돌아가기"
            title="라이브러리로 돌아가기"
            className="p-2 rounded-full hover:bg-white hover:text-black transition inline-flex"
          >
            <ArrowLeft size={24} />
          </Link>
        </div>

        <h1 className="text-3xl font-bold text-center mb-10">TRASH</h1>

        {trashWebtoons.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-white/40">휴지통이 비어 있어.</p>
          </div>
        ) : (
          <div className="flex justify-center">
            <div style={gridStyle}>
              {trashWebtoons.map((toon) => (
                <Card key={toon.id} toon={toon} />
              ))}
            </div>
          </div>
        )}
      </main>
    </PasswordGuard>
  );
}
