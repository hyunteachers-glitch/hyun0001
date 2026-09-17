"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Home, Plus, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import PasswordGuard from "../components/PasswordGuard";
import type { Webtoon, Episode, ImageItem } from "@/lib/types";

export default function LibraryPage() {
  const router = useRouter();
  const [webtoons, setWebtoons] = useState<Webtoon[]>([]);
  const [images, setImages] = useState<ImageItem[]>([]);
  const [episodeCounts, setEpisodeCounts] = useState<Record<number, number>>({});

  const [search, setSearch] = useState("");
  const [sortType, setSortType] = useState<"latest" | "abc">("latest");
  const [page, setPage] = useState(1);
  const [totalWebtoonCount, setTotalWebtoonCount] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  const [editMode, setEditMode] = useState(false);
  const [editingWebtoonId, setEditingWebtoonId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editCoverUrl, setEditCoverUrl] = useState("");

  const itemsPerPage = isMobile ? 28 : 60;

  useEffect(() => {
    getImages();

    function checkMobile() {
      setIsMobile(window.innerWidth < 768);
    }

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    getWebtoons();
    }, [page, itemsPerPage, search, sortType]);

  useEffect(() => {
    setPage(1);
  }, [search, sortType, isMobile]);

  function normalizeTitle(value: string) {
    return value.trim().toLowerCase();
  }

  async function getWebtoons() {
    const from = (page - 1) * itemsPerPage;
    const to = page * itemsPerPage - 1;

    let query = supabase
    .from("webtoons")
    .select("*", { count: "exact" })
    .eq("deleted", false);

     if (search.trim()) {
      query = query.ilike("title", `%${search.trim()}%`);
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

  async function getImages() {
    const { data, error } = await supabase
      .from("images")
      .select("*")
      .order("id", { ascending: false });

    if (error) return alert(error.message);
    setImages(data || []);
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

  function startEditWebtoon(toon: Webtoon) {
    setEditingWebtoonId(toon.id);
    setEditTitle(toon.title);
    setEditDescription(toon.description || "");
    setEditCoverUrl(toon.cover_url || "");
  }

  async function completeEditWebtoon() {
    if (!editingWebtoonId) return alert("수정할 작품을 선택해줘.");
    if (!editTitle.trim()) return alert("제목을 입력해줘.");
    if (!editCoverUrl) return alert("썸네일 사진을 선택해줘.");

    const duplicate = webtoons.some(
      (toon) =>
        toon.id !== editingWebtoonId &&
        normalizeTitle(toon.title) === normalizeTitle(editTitle)
    );

    if (duplicate) {
      alert("이미 같은 제목의 작품이 있어.");
      return;
    }

    const { error } = await supabase
      .from("webtoons")
      .update({
        title: editTitle.trim(),
        description: editDescription.trim(),
        cover_url: editCoverUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", editingWebtoonId);

    if (error) return alert(error.message);

    alert("작품 수정 완료!");
    setEditMode(false);
    setEditingWebtoonId(null);
    setEditTitle("");
    setEditDescription("");
    setEditCoverUrl("");
    getWebtoons();
  }

  function cancelEditWebtoon() {
    setEditMode(false);
    setEditingWebtoonId(null);
    setEditTitle("");
    setEditDescription("");
    setEditCoverUrl("");
  }

  function getTime(toon: Webtoon) {
    return new Date(toon.updated_at || toon.created_at || 0).getTime();
  }

  function startsWithNumber(title: string) {
    return /^[0-9]/.test(title.trim());
  }

  const filteredWebtoons = webtoons;

  const totalPages = Math.max(1, Math.ceil(totalWebtoonCount / itemsPerPage));

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
    const selected = editingWebtoonId === toon.id;

    const cardInner = (
      <div
        onClick={(e) => {
          if (editMode) {
            e.preventDefault();
            startEditWebtoon(toon);
          }
        }}
        style={{
          position: "relative",
          width: cardWidth,
          height: cardHeight,
          minHeight: cardHeight,
          borderRadius: "14px",
          overflow: "hidden",
          border: selected
            ? "2px solid rgb(239,68,68)"
            : "1px solid rgba(255,255,255,0.28)",
          background: selected ? "rgba(239,68,68,0.12)" : "rgba(255,255,255,0.02)",
          color: "white",
          cursor: editMode ? "pointer" : "default",
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

    if (editMode) return cardInner;

    return (
       <div
       onClick={() => {
         router.push(`/library/${toon.id}`);
         }}
         style={{
          textDecoration: "none",
          color: "white",
          cursor: "pointer",
          }}
          >
            {cardInner}
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
            href="/upload"
            aria-label="업로드"
            title="업로드"
            className="p-2 rounded-full hover:bg-white hover:text-black transition"
          >
            <Plus size={24} />
          </Link>

          <button
            onClick={() => {
              setEditMode(!editMode);
              setEditingWebtoonId(null);
              setEditTitle("");
              setEditDescription("");
              setEditCoverUrl("");
            }}
            aria-label="작품 수정"
            title="작품 수정"
            className={
              editMode
                ? "p-2 rounded-full bg-white text-black transition"
                : "p-2 rounded-full hover:bg-white hover:text-black transition"
            }
          >
            <Pencil size={24} />
          </button>

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

      {editMode && (
        <section className="mb-10 border border-white/15 rounded-3xl p-5 bg-white/[0.02]">
          <h2 className="text-2xl font-bold mb-4">작품 수정</h2>

          <div className="flex flex-col gap-3 max-w-[720px]">
            <input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="작품 제목"
              className="border border-white/25 rounded-2xl px-4 py-3 bg-black text-white outline-none"
            />

            <textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="작품 설명"
              className="border border-white/25 rounded-2xl px-4 py-3 bg-black text-white outline-none min-h-[100px] resize-y"
            />

            {editCoverUrl && (
              <img
                src={editCoverUrl}
                alt=""
                className="w-[110px] h-[110px] object-cover rounded-xl border border-white/20"
              />
            )}

            <div className="flex gap-3 flex-wrap">
              <button onClick={completeEditWebtoon} className="border border-white px-5 py-3 rounded-full hover:bg-white hover:text-black transition">
                완료
              </button>

              <button onClick={cancelEditWebtoon} className="border border-white/30 px-5 py-3 rounded-full hover:bg-white hover:text-black transition">
                취소
              </button>
            </div>

            <p className="text-white/45 text-sm">
              수정할 작품을 먼저 클릭하고, 아래 갤러리에서 썸네일 사진을 선택해줘.
            </p>
          </div>

          <div className="grid grid-cols-3 md:grid-cols-10 gap-2 md:gap-3 mt-6">
            {images.map((image) => (
              <button
                key={image.id}
                onClick={() => setEditCoverUrl(image.url)}
                className={`relative aspect-square overflow-hidden rounded-xl border ${
                  editCoverUrl === image.url ? "border-red-500 border-2" : "border-white/15"
                }`}
              >
                <img src={image.url} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="mx-auto mb-2 md:mb-4" style={{ width: gridWidth, maxWidth: "100%" }}>
        <input
          type="text"
          placeholder="작품 검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
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
          onClick={() => setSortType("abc")}
          className={sortType === "abc" ? "text-white" : "text-white/40 hover:text-white/70 transition"}
        >
          가나다순
        </button>

        <span className="text-white/20">|</span>

        <button
          onClick={() => setSortType("latest")}
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

      <div className="mt-12 flex justify-center items-center gap-3">
        <button onClick={() => setPage((prev) => Math.max(1, prev - 1))} disabled={page === 1} className="border border-white/30 px-4 py-2 rounded-full disabled:opacity-30 hover:bg-white hover:text-black transition">
          ←
        </button>

        <span className="text-white/70">
          {page} / {totalPages}
        </span>

        <button onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))} disabled={page === totalPages} className="border border-white/30 px-4 py-2 rounded-full disabled:opacity-30 hover:bg-white hover:text-black transition">
          →
        </button>
      </div>
    </main>
    </PasswordGuard>
  );
}