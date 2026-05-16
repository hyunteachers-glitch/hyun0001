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
};

export default function LibraryPage() {
  const [webtoons, setWebtoons] = useState<WebtoonItem[]>([]);
  const [search, setSearch] = useState("");
  const [sortType, setSortType] = useState<"latest" | "abc">("latest");
  const [page, setPage] = useState(1);
  const [isMobile, setIsMobile] = useState(false);

  const itemsPerPage = isMobile ? 40 : 60;

  useEffect(() => {
    getWebtoons();

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

  const filteredWebtoons = useMemo(() => {
    let result = webtoons.filter((toon) =>
      toon.title.toLowerCase().includes(search.toLowerCase())
    );

    if (sortType === "latest") {
      result = [...result].sort((a, b) => {
        const aTime = a.updated_at ? new Date(a.updated_at).getTime() : 0;
        const bTime = b.updated_at ? new Date(b.updated_at).getTime() : 0;
        return bTime - aTime;
      });
    }

    if (sortType === "abc") {
      result = [...result].sort((a, b) =>
        a.title.localeCompare(b.title, "ko")
      );
    }

    return result;
  }, [webtoons, search, sortType]);

  const totalPages = Math.max(1, Math.ceil(filteredWebtoons.length / itemsPerPage));

  const pagedWebtoons = filteredWebtoons.slice(
    (page - 1) * itemsPerPage,
    page * itemsPerPage
  );

  return (
    <main className="min-h-screen bg-black text-white px-5 md:px-8 py-10">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-5xl font-bold mb-3">LIBRARY</h1>
          <p className="text-white/50">웹툰 보관 공간</p>
        </div>

        <div className="flex gap-2">
          <Link href="/" className="border border-white px-4 py-2 rounded-full hover:bg-white hover:text-black transition">
            HOME
          </Link>

          <Link href="/upload" className="border border-white px-4 py-2 rounded-full hover:bg-white hover:text-black transition">
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

      {filteredWebtoons.length === 0 && (
        <p className="text-white/40 text-center">검색 결과가 없어.</p>
      )}

      <div className="flex justify-center">
        <div
          className="grid gap-4"
          style={{
            gridTemplateColumns: isMobile
              ? "repeat(4, 72px)"
              : "repeat(6, 150px)",
          }}
        >
          {pagedWebtoons.map((toon) => (
            <Link
              key={toon.id}
              href={`/library/${toon.id}`}
              style={{
                width: isMobile ? "72px" : "150px",
                textDecoration: "none",
                color: "white",
              }}
            >
              <div
                style={{
                  width: isMobile ? "72px" : "150px",
                  height: isMobile ? "96px" : "200px",
                  borderRadius: "10px",
                  overflow: "hidden",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.12)",
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

              <h2
                style={{
                  fontSize: isMobile ? "11px" : "14px",
                  fontWeight: "bold",
                  marginTop: "8px",
                  lineHeight: "1.3",
                  wordBreak: "keep-all",
                }}
              >
                {toon.title}
              </h2>
            </Link>
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
    </main>
  );
}