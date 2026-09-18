"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import PasswordGuard from "../../components/PasswordGuard";
import KeywordBadge from "../../components/KeywordBadge";
import { listKeywords } from "@/lib/queries";
import { groupKeywords } from "@/lib/keywordSort";
import type { Keyword } from "@/lib/types";

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
  const searchParams = useSearchParams();

  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [loaded, setLoaded] = useState(false);

  const fromParam = searchParams.get("from");
  const isFromLibrary = Boolean(
    fromParam && fromParam.startsWith("/library") && !fromParam.startsWith("/library/category")
  );
  const backHref = isFromLibrary ? (fromParam as string) : "/library";

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

  const groupedKeywords = useMemo(() => groupKeywords(keywords), [keywords]);

  return (
    <PasswordGuard>
      <main className="min-h-screen bg-black text-white px-5 md:px-8 py-10 flex flex-col">
        <div className="mb-10 grid grid-cols-3 items-center">
          <div className="justify-self-start">
            <Link href={backHref} className={backButtonClass}>
              ← LIBRARY
            </Link>
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
                      from="/library/category"
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
