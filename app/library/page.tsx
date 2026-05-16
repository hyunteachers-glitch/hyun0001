"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../supabase";

type WebtoonItem = {
  id: number;
  title: string;
  cover_url: string;
  deleted: boolean;
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
      .eq("deleted", false)
      .order("id", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    setWebtoons(data || []);
  }

  return (
    <main className="min-h-screen bg-black text-white px-8 py-10">
      <div className="flex justify-between items-center mb-12">
        <div>
          <h1 className="text-5xl font-bold mb-3">LIBRARY</h1>
          <p className="text-white/50">웹툰 보관 공간</p>
        </div>

        <div className="flex gap-2">
          <Link
            href="/"
            className="border border-white px-4 py-2 rounded-full hover:bg-white hover:text-black transition"
          >
            HOME
          </Link>

          <Link
            href="/upload"
            className="border border-white px-4 py-2 rounded-full hover:bg-white hover:text-black transition"
          >
            UPLOAD
          </Link>
        </div>
      </div>

      <div
        className="grid gap-6"
        style={{
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
        }}
      >
        {webtoons.map((toon) => (
          <Link
            key={toon.id}
            href={`/library/${toon.id}`}
            className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden hover:border-white/30 transition"
          >
            <div className="aspect-[3/4] bg-black">
              <img
                src={toon.cover_url}
                alt=""
                className="w-full h-full object-cover"
              />
            </div>

            <div className="p-4">
              <h2 className="text-xl font-bold">{toon.title}</h2>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}