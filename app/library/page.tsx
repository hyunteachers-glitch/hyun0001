"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../supabase";

type WebtoonItem = {
  id: number;
  title: string;
  cover_url: string;
};

export default function LibraryPage() {
  const [webtoons, setWebtoons] = useState<WebtoonItem[]>([]);

  useEffect(() => {
    getWebtoons();
  }, []);

  async function getWebtoons() {
    const { data, error } = await supabase
      .from("webtoons")
      .select("*")
      .order("id", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    setWebtoons(data || []);
  }

  return (
    <main className="min-h-screen bg-black text-white px-8 py-10">

      <div className="flex items-center justify-between mb-12">

        <div>
          <h1 className="text-5xl font-bold mb-3">
            LIBRARY
          </h1>

          <p className="text-white/50">
            완성된 웹툰 보관 공간
          </p>
        </div>

        <Link
          href="/upload"
          className="border border-white px-6 py-3 rounded-full hover:bg-white hover:text-black transition"
        >
          UPLOAD
        </Link>

      </div>

      {webtoons.length === 0 && (
        <p className="text-white/40">
          아직 생성된 웹툰이 없어.
        </p>
      )}

      <div
        className="gap-6"
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(3, minmax(0, 1fr))",
        }}
      >

        {webtoons.map((toon) => (
          <Link
            key={toon.id}
            href={`/library/${toon.id}`}
          >

            <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden hover:scale-[1.02] transition cursor-pointer">

              <div className="aspect-[3/4] bg-black">

                <img
                  src={toon.cover_url}
                  alt=""
                  className="w-full h-full object-cover"
                />

              </div>

              <div className="p-5">

                <h2 className="text-2xl font-bold mb-2">
                  {toon.title}
                </h2>

                <p className="text-white/40">
                  웹툰 보기
                </p>

              </div>

            </div>

          </Link>
        ))}

      </div>

    </main>
  );
}