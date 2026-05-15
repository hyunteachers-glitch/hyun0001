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

  async function editTitle(id: number, currentTitle: string) {
    const newTitle = prompt("새 제목을 입력해줘.", currentTitle);

    if (!newTitle || !newTitle.trim()) return;

    const { error } = await supabase
      .from("webtoons")
      .update({ title: newTitle.trim() })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    getWebtoons();
  }

  async function deleteWebtoon(id: number) {
    const ok = confirm("정말 이 웹툰을 삭제할까?");
    if (!ok) return;

    await supabase
      .from("webtoon_images")
      .delete()
      .eq("webtoon_id", id);

    const { error } = await supabase
      .from("webtoons")
      .delete()
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    getWebtoons();
  }

  return (
    <main className="min-h-screen bg-black text-white px-8 py-10">
      <div className="flex items-center justify-between mb-12">
        <div>
          <h1 className="text-5xl font-bold mb-3">LIBRARY</h1>
          <p className="text-white/50">완성된 웹툰 보관 공간</p>
        </div>

        <div className="flex gap-3">
          <Link
            href="/"
            className="border border-white px-6 py-3 rounded-full hover:bg-white hover:text-black transition"
          >
            HOME
          </Link>

          <Link
            href="/upload"
            className="border border-white px-6 py-3 rounded-full hover:bg-white hover:text-black transition"
          >
            UPLOAD
          </Link>
        </div>
      </div>

      <div
        className="gap-6"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
        }}
      >
        {webtoons.map((toon) => (
          <div
            key={toon.id}
            className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden"
          >
            <Link href={`/library/${toon.id}`}>
              <div className="aspect-[3/4] bg-black cursor-pointer">
                <img
                  src={toon.cover_url}
                  alt=""
                  className="w-full h-full object-cover"
                />
              </div>
            </Link>

            <div className="p-5">
              <Link href={`/library/${toon.id}`}>
                <h2 className="text-2xl font-bold mb-2 hover:underline">
                  {toon.title}
                </h2>
              </Link>

              <p className="text-white/40 mb-5">웹툰 보기</p>

              <div className="flex gap-3">
                <button
                  onClick={() => editTitle(toon.id, toon.title)}
                  className="flex-1 border border-white/40 py-2 rounded-xl hover:bg-white hover:text-black transition"
                >
                  제목 수정
                </button>

                <button
                  onClick={() => deleteWebtoon(toon.id)}
                  className="flex-1 border border-red-500 text-red-400 py-2 rounded-xl hover:bg-red-500 hover:text-white transition"
                >
                  삭제
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}