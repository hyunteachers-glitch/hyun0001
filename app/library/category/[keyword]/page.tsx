"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Plus, PencilLine, Check, X } from "lucide-react";
import PasswordGuard from "../../../components/PasswordGuard";
import { supabase } from "@/lib/supabase/client";
import { getKeywordByName, getWebtoonsByKeyword, renameKeyword } from "@/lib/queries";
import { useSession } from "@/lib/useSession";
import { ADMIN_EMAIL } from "@/lib/constants";
import type { Keyword, Webtoon, Episode } from "@/lib/types";
import AddWorksPicker, { type PickerResult } from "./AddWorksPicker";

const backButtonClass =
  "px-4 py-2 rounded-full hover:bg-white hover:text-black transition whitespace-nowrap text-sm md:text-base";

const iconButtonClass =
  "p-2 rounded-full hover:bg-white hover:text-black transition";

const addButtonClass =
  "w-9 h-7 flex items-center justify-center rounded-md border border-white hover:bg-white hover:text-black transition";

export default function CategoryKeywordPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-black text-white flex items-center justify-center">
          loading...
        </main>
      }
    >
      <CategoryKeywordPageInner />
    </Suspense>
  );
}

function CategoryKeywordPageInner() {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const rawKeyword = Array.isArray(params.keyword) ? params.keyword[0] : params.keyword;
  const keywordName = decodeURIComponent(rawKeyword || "");

  const fromParam = searchParams.get("from");
  const isValidFrom = Boolean(fromParam && fromParam.startsWith("/library"));
  const backHref = isValidFrom ? (fromParam as string) : "/library/category";
  const backLabel = isValidFrom && fromParam !== "/library/category" ? "BACK" : "CATEGORY";

  const [keyword, setKeyword] = useState<Keyword | null>(null);
  const [webtoons, setWebtoons] = useState<Webtoon[]>([]);
  const [episodeCounts, setEpisodeCounts] = useState<Record<number, number>>({});
  const [isMobile, setIsMobile] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [nameError, setNameError] = useState("");
  const [savingName, setSavingName] = useState(false);

  const { session } = useSession();
  const isAdmin = session?.user.email?.toLowerCase() === ADMIN_EMAIL;

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

  const gridWidth = gridColumns * cardWidth + (gridColumns - 1) * gridGap;

  function startEditName() {
    setNameInput(keyword?.name ?? keywordName);
    setNameError("");
    setEditingName(true);
  }

  function cancelEditName() {
    setEditingName(false);
    setNameError("");
  }

  async function saveName() {
    if (!keyword || savingName) return;

    const trimmed = nameInput.trim().replace(/^#+/, "").trim();
    if (!trimmed) {
      setNameError("카테고리 이름을 입력해줘.");
      return;
    }

    if (trimmed === keyword.name) {
      cancelEditName();
      return;
    }

    setSavingName(true);
    setNameError("");

    try {
      const updated = await renameKeyword(keyword.id, trimmed);
      setKeyword(updated);
      setEditingName(false);

      // URL이 키워드명 기반이라 새 이름으로 교체 → 새로고침해도 유지 (from 등 쿼리는 그대로)
      const qs = searchParams.toString();
      const nextPath = `/library/category/${encodeURIComponent(updated.name)}`;
      router.replace(qs ? `${nextPath}?${qs}` : nextPath);
    } catch (error) {
      setNameError(
        error instanceof Error
          ? error.message
          : (error as { message?: string })?.message || String(error)
      );
    } finally {
      setSavingName(false);
    }
  }

  function handlePickerClose(result: PickerResult) {
    setShowPicker(false);

    if (result === "deleted") {
      router.replace("/library/category");
    } else if (result === "changed") {
      load();
    }
  }

  function goToDetail(id: number) {
    const from = encodeURIComponent(pathname);
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
            className="line-clamp-1"
            title={toon.title}
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

  if (showPicker && keyword) {
    return (
      <PasswordGuard>
        <AddWorksPicker
          keywordId={keyword.id}
          existingIds={webtoons.map((toon) => toon.id)}
          isMobile={isMobile}
          onClose={handlePickerClose}
        />
      </PasswordGuard>
    );
  }

  return (
    <PasswordGuard>
      <main className="min-h-screen bg-black text-white px-5 md:px-8 py-10 flex flex-col">
        <div className="mb-8">
          <Link href={backHref} className={backButtonClass}>
            ← {backLabel}
          </Link>
        </div>

        {/* 그리드와 같은 폭의 줄 — 버튼 그룹 오른쪽 끝을 가장 오른쪽 카드의 우측선에 맞추고, 제목은 가운데 유지 */}
        <div className="flex justify-center mb-10">
          <div
            className="relative flex flex-col items-center"
            style={{ width: gridWidth, flexShrink: 0 }}
          >
            <div className="w-full flex items-center justify-center min-h-10 px-24">
              {editingName ? (
                <input
                  autoFocus
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.nativeEvent.isComposing) return;
                    if (e.key === "Enter") saveName();
                    if (e.key === "Escape") cancelEditName();
                  }}
                  disabled={savingName}
                  className="w-full max-w-md bg-black border border-white/40 rounded-xl px-4 py-1 text-3xl font-bold text-center outline-none"
                />
              ) : (
                <h1 className="text-3xl font-bold text-center break-all">#{keywordName}</h1>
              )}
            </div>

            {isAdmin && keyword && (
              <div className="absolute right-0 top-0 h-10 flex items-center gap-1">
                {editingName ? (
                  <>
                    <button
                      onClick={saveName}
                      disabled={savingName}
                      aria-label="이름 저장"
                      title="저장"
                      className={`${iconButtonClass} disabled:opacity-40`}
                    >
                      <Check size={22} />
                    </button>
                    <button
                      onClick={cancelEditName}
                      disabled={savingName}
                      aria-label="이름 수정 취소"
                      title="취소"
                      className={`${iconButtonClass} disabled:opacity-40`}
                    >
                      <X size={22} />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={startEditName}
                      aria-label="카테고리 이름 수정"
                      title="이름 수정"
                      className={iconButtonClass}
                    >
                      <PencilLine size={22} />
                    </button>
                    <button
                      onClick={() => setShowPicker(true)}
                      aria-label="작품 추가"
                      title="작품 추가"
                      className={addButtonClass}
                    >
                      <Plus size={18} />
                    </button>
                  </>
                )}
              </div>
            )}

            {nameError && <p className="mt-2 text-sm text-red-400">{nameError}</p>}
          </div>
        </div>

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
