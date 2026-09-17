"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import PasswordGuard from "../../components/PasswordGuard";
import KeywordBadge from "../../components/KeywordBadge";
import { listKeywords } from "@/lib/queries";
import type { Keyword } from "@/lib/types";

export default function CategoryPage() {
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [loaded, setLoaded] = useState(false);

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

  return (
    <PasswordGuard>
      <main className="min-h-screen bg-black text-white px-5 md:px-8 py-10 flex flex-col">
        <div className="mb-8">
          <Link
            href="/library"
            aria-label="라이브러리로 돌아가기"
            title="라이브러리로 돌아가기"
            className="p-2 rounded-full hover:bg-white hover:text-black transition inline-flex"
          >
            <ArrowLeft size={24} />
          </Link>
        </div>

        <h1 className="text-3xl font-bold text-center mb-10">CATEGORY</h1>

        {loaded && keywords.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-white/40">아직 키워드가 없어.</p>
          </div>
        ) : (
          <div className="flex flex-wrap justify-center gap-3">
            {keywords.map((keyword) => (
              <KeywordBadge key={keyword.id} keyword={keyword} />
            ))}
          </div>
        )}
      </main>
    </PasswordGuard>
  );
}
