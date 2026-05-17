"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../supabase";

type WebtoonItem = {
  id: number;
  title: string;
  cover_url: string;
  deleted: boolean;
  updated_at: string | null;
  created_at?: string | null;
};

type EpisodeRow = {
  webtoon_id: number;
};

export default function LibraryPage() {
  const [webtoons, setWebtoons] = useState<WebtoonItem[]>([]);
  const [trashWebtoons, setTrashWebtoons] = useState<WebtoonItem[]>([]);
  const [episodeCounts, setEpisodeCounts] = useState<Record<number, number>>({});
  const [search, setSearch] = useState("");
  const [sortType, setSortType] = useState<"latest" | "abc">("latest");
  const [page, setPage] = useState(1);
  const [isMobile, setIsMobile] = useState(false);
  const [showTrash, setShowTrash] = useState(false);

  const itemsPerPage = isMobile ? 40 : 60;

  useEffect(() => {
    getWebtoons();
    getTrashWebtoons();
    getEpisodeCounts();

    function checkMobile() {
      setIsMobile(window.innerWidth < 768);
    }

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search, sortType, isMobile]);

  async function getWebtoons() {
    const { data, error } = await supabase
      .from("webtoons")
      .select("*")
      .eq("deleted", false);

    if (error) {
      alert(error.message);
      return;
    }

    setWebtoons(data || []);
  }

  async function getTrashWebtoons() {
    const { data, error } = await supabase
      .from("webtoons")
      .select("*")
      .eq("deleted", true)
      .order("updated_at", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    setTrashWebtoons(data || []);
  }

  async function getEpisodeCounts() {
    const { data, error } = await supabase
      .from("episodes")
      .select("webtoon_id")
      .eq("deleted", false);

    if (error) {
      alert(error.message);
      return;
    }

    const counts: Record<number, number> = {};

    (data as EpisodeRow[]).forEach((episode) => {
      counts[episode.webtoon_id] = (counts[episode.webtoon_id] || 0) + 1;
    });

    setEpisodeCounts(counts);
  }

  async function restoreWebtoon(id: number) {
    const { error } = await supabase
      .from("webtoons")
      .update({
        deleted: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    getWebtoons();
    getTrashWebtoons();
    getEpisodeCounts();
  }

  async function permanentDeleteWebtoon(id: number) {
    const ok = confirm("정말 영구 삭제할까?");
    if (!ok) return;

    const { data: episodes } = await supabase
      .from("episodes")
      .select("id")
      .eq("webtoon_id", id);

    const episodeIds = episodes?.map((episode) => episode.id) || [];

    if (episodeIds.length > 0) {
      await supabase.from("episode_images").delete().in("episode_id", episodeIds);
    }

    await supabase.from("episodes").delete().eq("webtoon_id", id);
    await supabase.from("webtoon_images").delete().eq("webtoon_id", id);
    await supabase.from("webtoons").delete().eq("id", id);

    getWebtoons();
    getTrashWebtoons();
    getEpisodeCounts();
  }

  function getTime(toon: WebtoonItem) {
    return new Date(toon.updated_at || toon.created_at || 0).getTime();
  }

  function startsWithNumber(title: string) {
    return /^[0-9]/.test(title.trim());
  }

  const filteredWebtoons = useMemo(() => {
    let result = webtoons.filter((toon) =>
      toon.title.toLowerCase().includes(search.toLowerCase())
    );

    if (sortType === "latest") {
      result = [...result].sort((a, b) => getTime(b) - getTime(a));
    }

    if (sortType === "abc") {
      result = [...result].sort((a, b) => {
        const aNumber = startsWithNumber(a.title);
        const bNumber = startsWithNumber(b.title);

        if (aNumber && !bNumber) return 1;
        if (!aNumber && bNumber) return -1;

        return a.title.localeCompare(b.title, "ko", {
          numeric: true,
          sensitivity: "base",
        });
      });
    }

    return result;
  }, [webtoons, search, sortType]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredWebtoons.length / itemsPerPage)
  );

  const pagedWebtoons = filteredWebtoons.slice(
    (page - 1) * itemsPerPage,
    page * itemsPerPage
  );

  const cardSize = isMobile ? 78 : 170;

  const gridStyle = {
    display: "grid",
    gridTemplateColumns: isMobile ? "repeat(4, 88px)" : "repeat(6, 190px)",
    gap: isMobile ? "12px" : "20px",
  };

  function EpisodeLabel({ toonId }: { toonId: number }) {
    const count = episodeCounts[toonId] || 0;

    return (
      <p
        style={{
          fontSize: isMobile ? "10px" : "13px",
          color: "rgba(255,255,255,0.55)",
          marginTop: "5px",
        }}
      >
        {count > 0 ? `에피소드 ${count}` : "에피소드 없음"}
      </p>
    );
  }

  function Thumbnail({ toon, trash }: { toon: WebtoonItem; trash: boolean }) {
    return (
      <div
        style={{
          width: cardSize,
          height: cardSize,
          borderRadius: "10px",
          overflow: "hidden",
          background: "rgba(255,255,255,0.05)",
          opacity: trash ? 0.65 : 1,
        }}
      >
        <img
          src={toon.cover_url}
          alt=""
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
        />
      </div>
    );
  }

  function Title({ title }: { title: string }) {
    return (
      <h2
        style={{
          fontSize: isMobile ? "11px" : "15px",
          fontWeight: "bold",
          marginTop: "8px",
          lineHeight: "1.35",
          wordBreak: "keep-all",
        }}
      >
        {title}
      </h2>
    );
  }

  function Card({ toon, trash = false }: { toon: WebtoonItem; trash?: boolean }) {
    const cardInner = (
      <div
        style={{
          width: isMobile ? "88px" : "190px",
          minHeight: isMobile ? "142px" : "245px",
          padding: isMobile ? "5px" : "9px",
          borderRadius: "14px",
          border: trash
            ? "1px solid rgba(239,68,68,0.65)"
            : "1px solid rgba(255,255,255,0.28)",
          background: "rgba(255,255,255,0.02)",
          color: "white",
        }}
      >
        <Thumbnail toon={toon} trash={trash} />
        <Title title={toon.title} />
        <EpisodeLabel toonId={toon.id} />

        {trash && (
          <div className="mt-2 flex flex-col gap-1">
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
        )}
      </div>
    );

    if (trash) return cardInner;

    return (
      <Link
        href={`/library/${toon.id}`}
        style={{ textDecoration: "none", color: "white" }}
      >
        {cardInner}
      </Link>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white px-5 md:px-8 py-10">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-5xl font-bold mb-3">LIBRARY</h1>
          <p className="text-white/50">웹툰 보관 공간</p>
        </div>

        <div className="flex gap-2">
          <Link
            href="/"
            className="border border-white px-4 py-2 rounded-full hover:bg-white hover:text-black transition"
          >
            HOME
          </Link>

          <Link
            href="/upload"
            className="border border-white px-4 py-2 rounded-full hover:bg-white hover:text-black transition"
          >
            UPLOAD
          </Link>
        </div>
      </div>

      <div className="mb-10 flex justify-center items-center gap-3 flex-wrap">
        <input
          type="text"
          placeholder="작품 검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: "420px",
            maxWidth: "100%",
            border: "1px solid rgba(255,255,255,0.25)",
            borderRadius: "999px",
            padding: "14px 22px",
            background: "black",
            color: "white",
            fontSize: "16px",
            outline: "none",
            textAlign: "center",
          }}
        />

        <button
          onClick={() => setSortType("abc")}
          className={`px-4 py-3 rounded-full border transition ${
            sortType === "abc"
              ? "bg-white text-black border-white"
              : "border-white/20 text-white hover:bg-white hover:text-black"
          }`}
        >
          가나다순
        </button>

        <button
          onClick={() => setSortType("latest")}
          className={`px-4 py-3 rounded-full border transition ${
            sortType === "latest"
              ? "bg-white text-black border-white"
              : "border-white/20 text-white hover:bg-white hover:text-black"
          }`}
        >
          최신순
        </button>
      </div>

      <div className="flex justify-center">
        <div style={gridStyle}>
          {pagedWebtoons.map((toon) => (
            <Card key={toon.id} toon={toon} />
          ))}
        </div>
      </div>

      <div className="mt-12 flex justify-center items-center gap-3">
        <button
          onClick={() => setPage((prev) => Math.max(1, prev - 1))}
          disabled={page === 1}
          className="border border-white/30 px-4 py-2 rounded-full disabled:opacity-30 hover:bg-white hover:text-black transition"
        >
          ←
        </button>

        <span className="text-white/70">
          {page} / {totalPages}
        </span>

        <button
          onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
          disabled={page === totalPages}
          className="border border-white/30 px-4 py-2 rounded-full disabled:opacity-30 hover:bg-white hover:text-black transition"
        >
          →
        </button>
      </div>

      <section className="mt-20 border-t border-white/10 pt-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-3xl font-bold">TRASH</h2>
            <p className="text-white/40 mt-2">삭제된 작품 보관 공간</p>
          </div>

          <button
            onClick={() => setShowTrash(!showTrash)}
            className="border border-red-500 text-red-400 px-4 py-2 rounded-full hover:bg-red-500 hover:text-white transition"
          >
            {showTrash ? "휴지통 닫기" : "휴지통 보기"}
          </button>
        </div>

        {showTrash && (
          <>
            {trashWebtoons.length === 0 && (
              <p className="text-white/40">휴지통이 비어 있어.</p>
            )}

            <div className="flex justify-center">
              <div style={gridStyle}>
                {trashWebtoons.map((toon) => (
                  <Card key={toon.id} toon={toon} trash />
                ))}
              </div>
            </div>
          </>
        )}
      </section>
    </main>
  );
}