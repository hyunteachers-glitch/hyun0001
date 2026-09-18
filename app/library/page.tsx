"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Home, Plus, Trash2, Hash, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import PasswordGuard from "../components/PasswordGuard";
import type { Webtoon, Episode } from "@/lib/types";

const SEARCH_DEBOUNCE_MS = 300;

export default function LibraryPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-black text-white flex items-center justify-center">
          loading...
        </main>
      }
    >
      <LibraryPageInner />
    </Suspense>
  );
}

function LibraryPageInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [webtoons, setWebtoons] = useState<Webtoon[]>([]);
  const [episodeCounts, setEpisodeCounts] = useState<Record<number, number>>({});

  const [totalWebtoonCount, setTotalWebtoonCount] = useState(0);
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.innerWidth < 768
  );

  const itemsPerPage = isMobile ? 28 : 60;

  const pageParam = Number(searchParams.get("page"));
  const page = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1;
  const urlSearch = searchParams.get("q") || "";
  const sortType: "latest" | "abc" = searchParams.get("sort") === "abc" ? "abc" : "latest";

  const [searchInput, setSearchInput] = useState(urlSearch);

  function navigate(overrides: { page?: number; sort?: "latest" | "abc"; q?: string }) {
    const params = new URLSearchParams(searchParams.toString());

    const nextPage = overrides.page ?? page;
    const nextSort = overrides.sort ?? sortType;
    const nextQ = overrides.q ?? urlSearch;

    if (nextPage > 1) params.set("page", String(nextPage));
    else params.delete("page");

    if (nextSort === "abc") params.set("sort", "abc");
    else params.delete("sort");

    if (nextQ.trim()) params.set("q", nextQ);
    else params.delete("q");

    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  useEffect(() => {
    function checkMobile() {
      setIsMobile(window.innerWidth < 768);
    }

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const prevIsMobile = useRef(isMobile);

  useEffect(() => {
    if (prevIsMobile.current === isMobile) return;
    prevIsMobile.current = isMobile;

    if (page !== 1) {
      navigate({ page: 1 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile]);

  useEffect(() => {
    setSearchInput(urlSearch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlSearch]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (searchInput.trim() === urlSearch.trim()) return;
      navigate({ q: searchInput, page: 1 });
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  useEffect(() => {
    getWebtoons();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, itemsPerPage, urlSearch, sortType]);

  useEffect(() => {
    if (totalWebtoonCount === 0) return;

    const totalPages = Math.max(1, Math.ceil(totalWebtoonCount / itemsPerPage));
    if (page > totalPages) {
      navigate({ page: totalPages });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalWebtoonCount, itemsPerPage, page]);

  async function getWebtoons() {
    const from = (page - 1) * itemsPerPage;
    const to = page * itemsPerPage - 1;

    let query = supabase
    .from("webtoons")
    .select("*", { count: "exact" })
    .eq("deleted", false);

     if (urlSearch.trim()) {
      query = query.ilike("title", `%${urlSearch.trim()}%`);
     }

     if (sortType === "abc") {
      query = query.order("title", { ascending: true });
     } else {
      query = query.order("updated_at", { ascending: false });
     }

     const { data, count, error } = await query.range(from, to);

     if (error) return alert(error.message);

    setWebtoons(data || []);
    setTotalWebtoonCount(count || 0);

    const ids = (data || []).map((toon) => Number(toon.id));

     if (ids.length === 0) {
      setEpisodeCounts({});
     } else {
      getEpisodeCounts(ids);
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

    console.log("episodes raw:", data);
    console.log("counts:", counts);
    setEpisodeCounts(counts);
  }

  function getTime(toon: Webtoon) {
    return new Date(toon.updated_at || toon.created_at || 0).getTime();
  }

  function startsWithNumber(title: string) {
    return /^[0-9]/.test(title.trim());
  }

  const filteredWebtoons = webtoons;

  const totalPages = Math.max(1, Math.ceil(totalWebtoonCount / itemsPerPage));

  const pageGroupSize = 5;
  const pageGroupStart = Math.floor((page - 1) / pageGroupSize) * pageGroupSize + 1;
  const pageGroupEnd = Math.min(pageGroupStart + pageGroupSize - 1, totalPages);
  const pageNumbers = Array.from(
    { length: pageGroupEnd - pageGroupStart + 1 },
    (_, i) => pageGroupStart + i
  );
  const pageSlots: (number | null)[] = [
    ...pageNumbers,
    ...Array(pageGroupSize - pageNumbers.length).fill(null),
  ];

  const pagedWebtoons = filteredWebtoons;





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

  const gridWidth = gridColumns * cardWidth + (gridColumns - 1) * gridGap;

  function goToDetail(id: number) {
    const qs = searchParams.toString();
    const from = encodeURIComponent(qs ? `${pathname}?${qs}` : pathname);
    router.push(`/library/${id}?from=${from}`);
  }

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
        onClick={() => goToDetail(toon.id)}
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
    <main className="min-h-screen bg-black text-white px-5 md:px-8 py-10">
      <div className="flex justify-between items-center mb-8">
        <div>
          <Link href="/">
  <Image
    src="/logo-horizontal.png"
    alt="hyun0001"
    width={340}
    height={95}
    priority
  />
</Link>
        </div>

        <div className="flex gap-3 md:gap-9 justify-end items-center">
          <Link
            href="/"
            aria-label="홈"
            title="홈"
            className="p-2 rounded-full hover:bg-white hover:text-black transition"
          >
            <Home size={24} />
          </Link>

          <Link
            href="/library/category"
            aria-label="카테고리"
            title="카테고리"
            className="p-2 rounded-full hover:bg-white hover:text-black transition"
          >
            <Hash size={24} />
          </Link>

          <Link
            href="/upload"
            aria-label="업로드"
            title="업로드"
            className="p-2 rounded-full hover:bg-white hover:text-black transition"
          >
            <Plus size={24} />
          </Link>

          <Link
            href="/library/trash"
            aria-label="휴지통"
            title="휴지통"
            className="p-2 rounded-full text-red-500 hover:bg-red-500 hover:text-white transition"
          >
            <Trash2 size={24} />
          </Link>
        </div>
      </div>

      <div className="mx-auto mb-2 md:mb-4" style={{ width: gridWidth, maxWidth: "100%" }}>
        <input
          type="text"
          placeholder="작품 검색"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="w-full"
          style={{
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
      </div>

      <div
        className="mx-auto mb-2 md:mb-10 flex justify-end items-center gap-2 text-sm md:text-base"
        style={{ width: gridWidth, maxWidth: "100%" }}
      >
        <button
          onClick={() => navigate({ sort: "abc", page: 1 })}
          className={sortType === "abc" ? "text-white" : "text-white/40 hover:text-white/70 transition"}
        >
          가나다순
        </button>

        <span className="text-white/20">|</span>

        <button
          onClick={() => navigate({ sort: "latest", page: 1 })}
          className={sortType === "latest" ? "text-white" : "text-white/40 hover:text-white/70 transition"}
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

      <div className="mt-12 flex justify-center items-center gap-2">
        <button
          onClick={() => {
            navigate({ page: 1 });
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          disabled={page === 1}
          className="w-9 h-9 md:w-10 md:h-10 flex items-center justify-center rounded-lg border border-white/30 hover:bg-white hover:text-black transition disabled:opacity-30 disabled:pointer-events-none"
        >
          <ChevronsLeft size={18} />
        </button>

        <button
          onClick={() => {
            navigate({ page: Math.max(1, page - 1) });
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          disabled={page === 1}
          className="w-9 h-9 md:w-10 md:h-10 flex items-center justify-center rounded-lg border border-white/30 hover:bg-white hover:text-black transition disabled:opacity-30 disabled:pointer-events-none"
        >
          <ChevronLeft size={18} />
        </button>

        {pageSlots.map((num, i) =>
          num === null ? (
            <div
              key={`empty-${i}`}
              className="w-9 h-9 md:w-10 md:h-10 rounded-lg border border-white/10"
            />
          ) : (
            <button
              key={num}
              onClick={() => {
                navigate({ page: num });
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className={`w-9 h-9 md:w-10 md:h-10 flex items-center justify-center rounded-lg border text-sm md:text-base transition ${
                num === page
                  ? "bg-white text-black border-white"
                  : "border-white/30 hover:bg-white hover:text-black"
              }`}
            >
              {num}
            </button>
          )
        )}

        <button
          onClick={() => {
            navigate({ page: Math.min(totalPages, page + 1) });
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          disabled={page === totalPages}
          className="w-9 h-9 md:w-10 md:h-10 flex items-center justify-center rounded-lg border border-white/30 hover:bg-white hover:text-black transition disabled:opacity-30 disabled:pointer-events-none"
        >
          <ChevronRight size={18} />
        </button>

        <button
          onClick={() => {
            navigate({ page: totalPages });
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          disabled={page === totalPages}
          className="w-9 h-9 md:w-10 md:h-10 flex items-center justify-center rounded-lg border border-white/30 hover:bg-white hover:text-black transition disabled:opacity-30 disabled:pointer-events-none"
        >
          <ChevronsRight size={18} />
        </button>
      </div>
    </main>
    </PasswordGuard>
  );
}
