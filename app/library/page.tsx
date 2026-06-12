"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { supabase } from "../supabase";
import PasswordGuard from "../components/PasswordGuard";

type WebtoonItem = {
  id: number;
  title: string;
  cover_url: string;
  description?: string | null;
  deleted: boolean;
  updated_at: string | null;
  created_at?: string | null;
};

type EpisodeRow = {
  webtoon_id: number;
};

type ImageItem = {
  id: number;
  url: string;
};

export default function LibraryPage() {
  const router = useRouter();
  const [webtoons, setWebtoons] = useState<WebtoonItem[]>([]);
  const [trashWebtoons, setTrashWebtoons] = useState<WebtoonItem[]>([]);
  const [images, setImages] = useState<ImageItem[]>([]);
  const [episodeCounts, setEpisodeCounts] = useState<Record<number, number>>({});

  const [search, setSearch] = useState("");
  const [sortType, setSortType] = useState<"latest" | "abc">("latest");
  const [page, setPage] = useState(1);
  const [totalWebtoonCount, setTotalWebtoonCount] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [showTrash, setShowTrash] = useState(false);

  const [editMode, setEditMode] = useState(false);
  const [editingWebtoonId, setEditingWebtoonId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editCoverUrl, setEditCoverUrl] = useState("");

  const itemsPerPage = isMobile ? 28 : 60;

  useEffect(() => {
    getTrashWebtoons();
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

    console.log("1. 현재 페이지 작품 ids:", ids);
    console.log(
       "2. ids 타입:",
       ids.map((id) => typeof id)
    );

     if (ids.length === 0) {
      setEpisodeCounts({});
     } else {
      getEpisodeCounts(ids);
     }
  }

  async function getTrashWebtoons() {
    const { data, error } = await supabase
      .from("webtoons")
      .select("*")
      .eq("deleted", true)
      .order("updated_at", { ascending: false });

    if (error) return alert(error.message);
    setTrashWebtoons(data || []);
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
      .in("webtoon_id", webtoonIds);

    if (error) {
      console.error("getEpisodeCounts error:", error);
      return;
    }

    const counts: Record<number, number> = {};
    (data as EpisodeRow[]).forEach((episode) => {
      counts[episode.webtoon_id] = (counts[episode.webtoon_id] || 0) + 1;
    });

    console.log("episodes raw:", data);
    console.log("counts:", counts);
    setEpisodeCounts(counts);
  }

  function startEditWebtoon(toon: WebtoonItem) {
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

  async function restoreWebtoon(id: number) {
    const { error } = await supabase
      .from("webtoons")
      .update({ deleted: false, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) return alert(error.message);

    getWebtoons();
    getTrashWebtoons();
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
  }

  function getTime(toon: WebtoonItem) {
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

  const gridStyle = {
    display: "grid",
    gridTemplateColumns: isMobile ? "repeat(4, 88px)" : "repeat(6, 190px)",
    gap: isMobile ? "12px" : "20px",
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

  function Card({ toon, trash = false }: { toon: WebtoonItem; trash?: boolean }) {
    const selected = editingWebtoonId === toon.id;

    const cardInner = (
      <div
        onClick={(e) => {
          if (editMode && !trash) {
            e.preventDefault();
            startEditWebtoon(toon);
          }
        }}
        style={{
          position: "relative",
          width: cardWidth,
          height: trash ? "auto" : cardHeight,
          minHeight: cardHeight,
          borderRadius: "14px",
          overflow: "hidden",
          border: selected
            ? "2px solid rgb(239,68,68)"
            : trash
            ? "1px solid rgba(239,68,68,0.65)"
            : "1px solid rgba(255,255,255,0.28)",
          background: selected ? "rgba(239,68,68,0.12)" : "rgba(255,255,255,0.02)",
          color: "white",
          cursor: editMode && !trash ? "pointer" : "default",
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

        {trash && (
          <div style={{ padding: isMobile ? "6px" : "9px", paddingTop: 0 }} className="flex flex-col gap-1">
            <button onClick={() => restoreWebtoon(toon.id)} className="border border-white/30 text-white text-[10px] md:text-xs py-1 rounded-lg hover:bg-white hover:text-black transition">
              복구
            </button>

            <button onClick={() => permanentDeleteWebtoon(toon.id)} className="border border-red-500 text-red-400 text-[10px] md:text-xs py-1 rounded-lg hover:bg-red-500 hover:text-white transition">
              영구삭제
            </button>
          </div>
        )}
      </div>
    );

    if (trash || editMode) return cardInner;

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
    className="mb-3"
  />
</Link>
          <p className="text-white/50">웹툰 보관 공간</p>
        </div>

        <div className="flex gap-2 flex-wrap justify-end">
          <Link href="/" className="border border-white px-4 py-2 rounded-full hover:bg-white hover:text-black transition">
            HOME
          </Link>

          <Link href="/upload" className="border border-white px-4 py-2 rounded-full hover:bg-white hover:text-black transition">
            UPLOAD
          </Link>

          <button
            onClick={() => {
              setEditMode(!editMode);
              setEditingWebtoonId(null);
              setEditTitle("");
              setEditDescription("");
              setEditCoverUrl("");
            }}
            className={
              editMode
                ? "border border-white px-4 py-2 rounded-full bg-white text-black transition"
                : "border border-white px-4 py-2 rounded-full hover:bg-white hover:text-black transition"
            }
          >
            작품 수정
          </button>
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

        <button onClick={() => setSortType("abc")} className={`px-4 py-3 rounded-full border transition ${sortType === "abc" ? "bg-white text-black border-white" : "border-white/20 text-white hover:bg-white hover:text-black"}`}>
          가나다순
        </button>

        <button onClick={() => setSortType("latest")} className={`px-4 py-3 rounded-full border transition ${sortType === "latest" ? "bg-white text-black border-white" : "border-white/20 text-white hover:bg-white hover:text-black"}`}>
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

      <section className="mt-20 border-t border-white/10 pt-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-3xl font-bold">TRASH</h2>
            <p className="text-white/40 mt-2">삭제된 작품 보관 공간</p>
          </div>

          <button onClick={() => setShowTrash(!showTrash)} className="border border-red-500 text-red-400 px-4 py-2 rounded-full hover:bg-red-500 hover:text-white transition">
            {showTrash ? "휴지통 닫기" : "휴지통 보기"}
          </button>
        </div>

        {showTrash && (
          <>
            {trashWebtoons.length === 0 && <p className="text-white/40">휴지통이 비어 있어.</p>}

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
    </PasswordGuard>
  );
}