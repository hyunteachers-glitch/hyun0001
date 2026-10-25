"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, X } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { DB_QUOTA_BYTES, R2_QUOTA_BYTES } from "@/lib/constants";

type UsageResult =
  | { ok: true; usedBytes: number; objectCount?: number; fetchedAt: number }
  | { ok: false };

type StorageUsageResponse = {
  r2: UsageResult;
  db: UsageResult;
};

function formatBytes(bytes: number) {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = Math.max(bytes, 0);
  let unitIndex = 0;

  while (value >= 1000 && unitIndex < units.length - 1) {
    value /= 1000;
    unitIndex += 1;
  }

  const digits = unitIndex === 0 ? 0 : value < 10 ? 2 : 1;
  return `${value.toFixed(digits)} ${units[unitIndex]}`;
}

function formatAgo(fetchedAt: number, now: number) {
  const minutes = Math.floor((now - fetchedAt) / 60000);
  return minutes < 1 ? "방금 전 기준" : `${minutes}분 전 기준`;
}

function barColorClass(percent: number) {
  if (percent >= 95) return "bg-red-500";
  if (percent >= 80) return "bg-orange-500";
  return "bg-white";
}

function UsageCard({
  title,
  quotaBytes,
  note,
  result,
}: {
  title: string;
  quotaBytes: number;
  note: string;
  result: UsageResult | null;
}) {
  return (
    <section className="border border-white/20 rounded-2xl p-4 flex flex-col gap-3">
      <h4 className="font-bold">{title}</h4>

      {result === null ? (
        <p className="text-white/50 text-sm">불러오는 중...</p>
      ) : !result.ok ? (
        <p className="text-red-400 text-sm">불러오지 못했어</p>
      ) : (
        (() => {
          const percent = (result.usedBytes / quotaBytes) * 100;
          const remaining = Math.max(quotaBytes - result.usedBytes, 0);

          return (
            <>
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm">
                  {formatBytes(result.usedBytes)}{" "}
                  <span className="text-white/50">/ {formatBytes(quotaBytes)}</span>
                </p>
                <p className="text-sm tabular-nums">{percent.toFixed(1)}%</p>
              </div>

              <div className="w-full h-2 bg-white/15 rounded-full overflow-hidden">
                <div
                  className={`h-full ${barColorClass(percent)} transition-all duration-300`}
                  style={{ width: `${Math.min(percent, 100)}%` }}
                />
              </div>

              <p className="text-white/60 text-sm">
                남은 용량 {formatBytes(remaining)}
                {result.objectCount !== undefined &&
                  ` · 파일 ${result.objectCount.toLocaleString("ko-KR")}개`}
              </p>
            </>
          );
        })()
      )}

      <p className="text-white/40 text-xs">{note}</p>
    </section>
  );
}

async function fetchStorageUsage(refresh: boolean): Promise<StorageUsageResponse> {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;

  if (!accessToken) {
    throw new Error("no session");
  }

  const res = await fetch(`/api/storage-usage${refresh ? "?refresh=1" : ""}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  return res.json();
}

export default function StorageModal({ onClose }: { onClose: () => void }) {
  const [data, setData] = useState<StorageUsageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback((refresh: boolean) => {
    fetchStorageUsage(refresh)
      .then(setData)
      .catch((error) => {
        console.error("storage usage fetch error:", error);
        setData({ r2: { ok: false }, db: { ok: false } });
      })
      .finally(() => {
        setNow(Date.now());
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    load(false);
  }, [load]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const r2FetchedAt = data?.r2.ok ? data.r2.fetchedAt : null;

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/70 flex items-center justify-center p-5"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="저장공간"
        className="w-full max-w-sm bg-black border border-white/20 rounded-2xl p-6 flex flex-col gap-4"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold">저장공간</h3>

          <button
            onClick={onClose}
            aria-label="닫기"
            title="닫기"
            className="p-1 rounded-full text-white/50 hover:text-white transition"
          >
            <X size={20} />
          </button>
        </div>

        <UsageCard
          title="이미지 저장소 (Cloudflare R2)"
          quotaBytes={R2_QUOTA_BYTES}
          note="R2는 무료 10GB 초과 시 과금돼."
          result={data ? data.r2 : null}
        />

        <UsageCard
          title="데이터베이스 (Supabase)"
          quotaBytes={DB_QUOTA_BYTES}
          note="Supabase 무료 플랜 500MB 기준."
          result={data ? data.db : null}
        />

        <div className="flex items-center justify-between">
          <p className="text-white/50 text-sm">
            {r2FetchedAt ? formatAgo(r2FetchedAt, now) : ""}
          </p>

          <button
            onClick={() => {
              setLoading(true);
              load(true);
            }}
            disabled={loading}
            aria-label="새로고침"
            title="새로고침"
            className="p-2 rounded-full hover:bg-white hover:text-black transition disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-white"
          >
            <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>
    </div>
  );
}
