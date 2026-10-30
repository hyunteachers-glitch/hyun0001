"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import {
  addKeywordToWebtoon,
  removeKeywordFromWebtoon,
  deleteKeywordIfEmpty,
  getActiveWorkCountForKeyword,
} from "@/lib/queries";
import type { Webtoon, Episode } from "@/lib/types";

// 카테고리 상세 화면의 "작품 추가" 전체 화면 모드.
// 라이브러리와 같은 카드/그리드/검색을 쓰되, 선택된 작품을 맨 위로 올려 보여준다.
// - existingIds: 이미 이 키워드에 연결된 작품 (처음부터 선택 상태, 해제하면 완료 시 연결 해제)
// - 정렬: 새로 선택한 작품(가장 최근 선택이 맨 위) → 선택 유지 중인 기존 작품(라이브러리 최신순) → 나머지
// - onClose 결과: "none"(변경 없음/취소) | "changed" | "deleted"(연결 해제로 키워드가 자동 삭제됨)
export type PickerResult = "none" | "changed" | "deleted";

export default function AddWorksPicker({
  keywordId,
  existingIds,
  isMobile,
  onClose,
}: {
  keywordId: number;
  existingIds: number[];
  isMobile: boolean;
  onClose: (result: PickerResult) => void;
}) {
  const [allWebtoons, setAllWebtoons] = useState<Webtoon[]>([]);
  const [episodeCounts, setEpisodeCounts] = useState<Record<number, number>>({});
  const [searchInput, setSearchInput] = useState("");
  // 새로 선택한 작품 (선택한 순서대로 push)
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  // 기존 연결 작품 중 해제한 것
  const [removedIds, setRemovedIds] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  // Strict Mode 이중 실행/연타로 같은 insert가 두 번 나가지 않게 막는 가드
  const submittingRef = useRef(false);

  useEffect(() => {
    window.scrollTo({ top: 0 });
    load();
  }, []);

  async function load() {
    const { data, error } = await supabase
      .from("webtoons")
      .select("*")
      .eq("deleted", false)
      .order("updated_at", { ascending: false });

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setAllWebtoons(data || []);

    const ids = (data || []).map((toon) => Number(toon.id));
    if (ids.length > 0) getEpisodeCounts(ids);
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

  function toggle(id: number) {
    if (submitting) return;

    const setter = existingIds.includes(id) ? setRemovedIds : setSelectedIds;
    setter((prev) =>
      prev.includes(id) ? prev.filter((prevId) => prevId !== id) : [...prev, id]
    );
  }

  const hasChanges = selectedIds.length > 0 || removedIds.length > 0;

  async function complete() {
    if (!hasChanges) return;

    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setErrorMessage("");

    try {
      // addKeywordToWebtoon은 upsert(ignoreDuplicates)라 이미 연결된 건 중복 추가되지 않는다.
      // 추가를 먼저 해야 "기존 전부 해제 + 새로 추가"인 경우 키워드가 지워지지 않는다.
      for (const id of selectedIds) {
        await addKeywordToWebtoon(id, keywordId);
      }

      if (removedIds.length === 0) {
        onClose("changed");
        return;
      }

      for (const id of removedIds) {
        await removeKeywordFromWebtoon(id, keywordId);
      }

      // deleteKeywordIfEmpty는 남은 작품이 0개일 때만 지우므로, 그 뒤에도 0개면 삭제된 것
      await deleteKeywordIfEmpty(keywordId);
      const remaining = await getActiveWorkCountForKeyword(keywordId);
      onClose(remaining === 0 ? "deleted" : "changed");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : (error as { message?: string })?.message || String(error)
      );
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  const search = searchInput.trim().toLowerCase();
  const matched = search
    ? allWebtoons.filter((toon) => toon.title.toLowerCase().includes(search))
    : allWebtoons;

  const byId = new Map(matched.map((toon) => [toon.id, toon]));
  const keptExistingSet = new Set(existingIds.filter((id) => !removedIds.includes(id)));
  const pinnedSet = new Set([...selectedIds, ...keptExistingSet]);
  const visibleWebtoons = [
    ...[...selectedIds]
      .reverse()
      .map((id) => byId.get(id))
      .filter((toon): toon is Webtoon => !!toon),
    ...matched.filter((toon) => keptExistingSet.has(toon.id)),
    ...matched.filter((toon) => !pinnedSet.has(toon.id)),
  ];

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

  // 컴포넌트가 아니라 함수로 호출 — 선택 토글 때마다 카드가 리마운트되어 썸네일이 깜빡이지 않게
  function renderCard(toon: Webtoon) {
    const selected = pinnedSet.has(toon.id);
    const count = episodeCounts[toon.id] || 0;

    return (
      <div
        key={toon.id}
        onClick={() => toggle(toon.id)}
        style={{
          position: "relative",
          width: cardWidth,
          height: cardHeight,
          minHeight: cardHeight,
          borderRadius: "14px",
          overflow: "hidden",
          border: selected ? "1px solid #22c55e" : "1px solid rgba(255,255,255,0.28)",
          boxShadow: selected ? "0 0 0 1px #22c55e" : undefined,
          background: "rgba(255,255,255,0.02)",
          color: "white",
          cursor: "pointer",
        }}
      >
        <div style={{ width: thumbnailSize, height: thumbnailSize, overflow: "hidden" }}>
          <img
            src={toon.cover_url}
            alt=""
            draggable={false}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        </div>

        {selected && (
          <div
            style={{
              position: "absolute",
              top: isMobile ? "4px" : "8px",
              right: isMobile ? "4px" : "8px",
              fontSize: isMobile ? "14px" : "22px",
              lineHeight: 1,
            }}
          >
            ✅
          </div>
        )}

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
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white px-5 md:px-8 py-10 pb-28">
      <div className="mx-auto mb-6 md:mb-10" style={{ width: gridWidth, maxWidth: "100%" }}>
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

      <div className="flex justify-center">
        <div style={gridStyle}>{visibleWebtoons.map((toon) => renderCard(toon))}</div>
      </div>

      {errorMessage && (
        <p className="fixed bottom-24 right-4 md:right-8 z-40 max-w-xs rounded-xl bg-red-500/90 px-4 py-2 text-sm text-white shadow-lg shadow-black/50">
          {errorMessage}
        </p>
      )}

      <div className="fixed bottom-6 right-4 md:right-8 z-40 flex gap-3">
        <button
          onClick={() => onClose("none")}
          disabled={submitting}
          className={`${buttonClass} shadow-lg shadow-black/50 disabled:opacity-40 disabled:pointer-events-none`}
        >
          취소
        </button>

        <button
          onClick={complete}
          disabled={submitting || !hasChanges}
          className={`${activeButtonClass} shadow-lg shadow-black/50 disabled:opacity-40 disabled:cursor-not-allowed`}
        >
          {submitting ? "추가 중..." : "완료"}
        </button>
      </div>
    </main>
  );
}

const buttonClass =
  "border border-white px-5 py-3 rounded-full bg-black text-white cursor-pointer text-base no-underline hover:bg-white hover:text-black transition";

const activeButtonClass =
  "border border-white px-5 py-3 rounded-full bg-white text-black cursor-pointer text-base transition";
