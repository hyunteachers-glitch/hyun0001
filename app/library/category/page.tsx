"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import PasswordGuard from "../../components/PasswordGuard";
import KeywordBadge from "../../components/KeywordBadge";
import { listKeywords } from "@/lib/queries";
import type { Keyword } from "@/lib/types";

const CHOSEONG_LIST = [
  "ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ",
  "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ",
] as const;

const CHOSEONG_TO_GROUP: Record<string, string> = {
  "ㄱ": "ㄱ", "ㄲ": "ㄱ",
  "ㄴ": "ㄴ",
  "ㄷ": "ㄷ", "ㄸ": "ㄷ",
  "ㄹ": "ㄹ",
  "ㅁ": "ㅁ",
  "ㅂ": "ㅂ", "ㅃ": "ㅂ",
  "ㅅ": "ㅅ", "ㅆ": "ㅅ",
  "ㅇ": "ㅇ",
  "ㅈ": "ㅈ", "ㅉ": "ㅈ",
  "ㅊ": "ㅊ",
  "ㅋ": "ㅋ",
  "ㅌ": "ㅌ",
  "ㅍ": "ㅍ",
  "ㅎ": "ㅎ",
};

const KOREAN_GROUP_ORDER = ["ㄱ", "ㄴ", "ㄷ", "ㄹ", "ㅁ", "ㅂ", "ㅅ", "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];
const SECTION_ORDER = [...KOREAN_GROUP_ORDER, "A-Z", "0-9", "기타"];

function getChoseong(char: string): string | null {
  const code = char.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return null;

  const choseongIndex = Math.floor((code - 0xac00) / (21 * 28));
  return CHOSEONG_LIST[choseongIndex];
}

function getGroupKey(name: string): string {
  const first = name.trim().charAt(0);
  if (!first) return "기타";

  const choseong = getChoseong(first);
  if (choseong) return CHOSEONG_TO_GROUP[choseong];

  if (/[A-Za-z]/.test(first)) return "A-Z";
  if (/[0-9]/.test(first)) return "0-9";

  return "기타";
}

const backButtonClass =
  "px-4 py-2 rounded-full hover:bg-white hover:text-black transition whitespace-nowrap text-sm md:text-base";

export default function CategoryPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-black text-white flex items-center justify-center">
          loading...
        </main>
      }
    >
      <CategoryPageInner />
    </Suspense>
  );
}

function CategoryPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [loaded, setLoaded] = useState(false);

  const fromParam = searchParams.get("from");
  const isFromLibrary = Boolean(
    fromParam && fromParam.startsWith("/library") && !fromParam.startsWith("/library/category")
  );

  useEffect(() => {
    getKeywords();
  }, []);

  async function getKeywords() {
    try {
      const data = await listKeywords();
      setKeywords(data);
    } catch (error) {
      alert(error instanceof Error ? error.message : String(error));
    } finally {
      setLoaded(true);
    }
  }

  const groupedKeywords = useMemo(() => {
    const buckets = new Map<string, Keyword[]>();

    for (const keyword of keywords) {
      const key = getGroupKey(keyword.name);
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(keyword);
    }

    return SECTION_ORDER.map((key) => ({
      key,
      items: (buckets.get(key) || []).slice().sort((a, b) => {
        if (key === "0-9") {
          const diff = parseInt(a.name, 10) - parseInt(b.name, 10);
          return diff !== 0 ? diff : a.name.localeCompare(b.name);
        }

        if (key === "A-Z") {
          return a.name.localeCompare(b.name, "en", { sensitivity: "base" });
        }

        return a.name.localeCompare(b.name, "ko");
      }),
    })).filter((section) => section.items.length > 0);
  }, [keywords]);

  return (
    <PasswordGuard>
      <main className="min-h-screen bg-black text-white px-5 md:px-8 py-10 flex flex-col">
        <div className="mb-10 grid grid-cols-3 items-center">
          <div className="justify-self-start">
            {isFromLibrary ? (
              <Link href={fromParam as string} className={backButtonClass}>
                ← LIBRARY
              </Link>
            ) : (
              <button onClick={() => router.back()} className={backButtonClass}>
                ← BACK
              </button>
            )}
          </div>

          <h1 className="text-3xl font-bold text-center">CATEGORY</h1>

          <div aria-hidden="true" />
        </div>

        {loaded && keywords.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-white/40">아직 키워드가 없어.</p>
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-white/10">
            {groupedKeywords.map((section) => (
              <div key={section.key} className="flex items-start gap-4 py-6 first:pt-0">
                <div className="flex items-center gap-3 shrink-0">
                  <h2 className="text-white text-sm font-bold w-12 text-center whitespace-nowrap">
                    {section.key}
                  </h2>
                  <span className="w-px h-4 bg-white/15" />
                </div>

                <div className="flex flex-wrap gap-3">
                  {section.items.map((keyword) => (
                    <KeywordBadge
                      key={keyword.id}
                      keyword={keyword}
                      className="leading-relaxed text-white hover:text-white/70 transition"
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </PasswordGuard>
  );
}
