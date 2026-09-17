"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import PasswordGuard from "../../../components/PasswordGuard";
import { supabase } from "@/lib/supabase/client";
import { getKeywordByName, getWebtoonsByKeyword } from "@/lib/queries";
import type { Keyword, Webtoon, Episode } from "@/lib/types";

export default function CategoryKeywordPage() {
  const params = useParams();
  const router = useRouter();
  const rawKeyword = Array.isArray(params.keyword) ? params.keyword[0] : params.keyword;
  const keywordName = decodeURIComponent(rawKeyword || "");

  const [keyword, setKeyword] = useState<Keyword | null>(null);
  const [webtoons, setWebtoons] = useState<Webtoon[]>([]);
  const [episodeCounts, setEpisodeCounts] = useState<Record<number, number>>({});
  const [isMobile, setIsMobile] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    function checkMobile() {
      setIsMobile(window.innerWidth < 768);
    }

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    if (!keywordName) return;
    load();
  }, [keywordName]);

  async function load() {
    try {
      const foundKeyword = await getKeywordByName(keywordName);
      setKeyword(foundKeyword);

      if (!foundKeyword) {
        setWebtoons([]);
        return;
      }

      const data = await getWebtoonsByKeyword(foundKeyword.id);
      setWebtoons(data);

      const ids = data.map((toon) => toon.id);
      if (ids.length > 0) {
        getEpisodeCounts(ids);
      } else {
        setEpisodeCounts({});
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : String(error));
    } finally {
      setLoaded(true);
    }
  }

  async function getEpisodeCounts(webtoonIds: number[]) {
    const { data, error } = await supabase
      .from("episodes")
      .select("webtoon_id")
      .eq("deleted", false)
      .in("webtoon_id", webtoonIds);

    if (error) {
      console.error("getEpisodeCounts error:", error);
      return;
    }

    const counts: Record<number, number> = {};
    (data as Pick<Episode, "webtoon_id">[]).forEach((episode) => {
      counts[episode.webtoon_id] = (counts[episode.webtoon_id] || 0) + 1;
    });

    setEpisodeCounts(counts);
  }

  const cardWidth = isMobile ? 88 : 190;
  const thumbnailSize = isMobile ? 88 : 190;
  const cardHeight = isMobile ? 132 : 275;

  const gridColumns = isMobile ? 4 : 6;
  const gridGap = isMobile ? 12 : 20;

  const gridStyle = {
    display: "grid",
    gridTemplateColumns: `repeat(${gridColumns}, ${cardWidth}px)`,
    gap: `${gridGap}px`,
  };

  function EpisodeLabel({ toonId }: { toonId: number }) {
    const count = episodeCounts[toonId] || 0;

    return (
      <div
        style={{
          position: "absolute",
          right: isMobile ? "6px" : "9px",
          bottom: isMobile ? "6px" : "9px",
          fontSize: isMobile ? "8px" : "12px",
          color: "rgba(255,255,255,0.55)",
        }}
      >
        {count > 0 ? `에피소드 ${count}` : "에피소드 없음"}
      </div>
    );
  }

  function Card({ toon }: { toon: Webtoon }) {
    return (
      <div
        onClick={() => router.push(`/library/${toon.id}`)}
        style={{
          position: "relative",
          width: cardWidth,
          height: cardHeight,
          minHeight: cardHeight,
          borderRadius: "14px",
          overflow: "hidden",
          border: "1px solid rgba(255,255,255,0.28)",
          background: "rgba(255,255,255,0.02)",
          color: "white",
          cursor: "pointer",
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

        <EpisodeLabel toonId={toon.id} />
      </div>
    );
  }

  return (
    <PasswordGuard>
      <main className="min-h-screen bg-black text-white px-5 md:px-8 py-10 flex flex-col">
        <div className="mb-8">
          <Link
            href="/library/category"
            aria-label="카테고리로 돌아가기"
            title="카테고리로 돌아가기"
            className="p-2 rounded-full hover:bg-white hover:text-black transition inline-flex"
          >
            <ArrowLeft size={24} />
          </Link>
        </div>

        <h1 className="text-3xl font-bold text-center mb-10">#{keywordName}</h1>

        {loaded && !keyword ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-white/40">존재하지 않는 키워드야.</p>
          </div>
        ) : loaded && webtoons.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-white/40">이 키워드가 달린 작품이 없어.</p>
          </div>
        ) : (
          <div className="flex justify-center">
            <div style={gridStyle}>
              {webtoons.map((toon) => (
                <Card key={toon.id} toon={toon} />
              ))}
            </div>
          </div>
        )}
      </main>
    </PasswordGuard>
  );
}
