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

      <div className="flex justify-center">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(8, 120px)",
            gap: "14px",
          }}
        >
          {webtoons.map((toon) => (
            <Link
              key={toon.id}
              href={`/library/${toon.id}`}
              style={{
                width: "120px",
                textDecoration: "none",
                color: "white",
              }}
            >
              <div
                style={{
                  width: "120px",
                  height: "160px",
                  borderRadius: "10px",
                  overflow: "hidden",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.12)",
                }}
              >
                <img
                  src={toon.cover_url}
                  alt=""
                  style={{
                    width: "120px",
                    height: "160px",
                    objectFit: "cover",
                    display: "block",
                  }}
                />
              </div>

              <h2
                style={{
                  fontSize: "14px",
                  fontWeight: "bold",
                  marginTop: "8px",
                  lineHeight: "1.3",
                  wordBreak: "keep-all",
                }}
              >
                {toon.title}
              </h2>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}