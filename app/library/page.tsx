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
  const [trashMode, setTrashMode] = useState(false);

  useEffect(() => {
    getWebtoons();
  }, [trashMode]);

  async function getWebtoons() {
    const { data, error } = await supabase
      .from("webtoons")
      .select("*")
      .eq("deleted", trashMode)
      .order("id", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    setWebtoons(data || []);
  }

  async function editTitle(id: number, currentTitle: string) {
    const newTitle = prompt("새 제목 입력", currentTitle);

    if (!newTitle) return;

    const { error } = await supabase
      .from("webtoons")
      .update({
        title: newTitle,
      })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    getWebtoons();
  }

  async function moveToTrash(id: number) {
    const ok = confirm("휴지통으로 이동할까?");

    if (!ok) return;

    const { error } = await supabase
      .from("webtoons")
      .update({
        deleted: true,
      })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    getWebtoons();
  }

  async function restoreWebtoon(id: number) {
    const { error } = await supabase
      .from("webtoons")
      .update({
        deleted: false,
      })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    getWebtoons();
  }

  async function permanentDelete(id: number) {
    const ok = confirm("정말 영구 삭제할까?");

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

      <div className="flex items-start justify-between gap-4 mb-12 flex-wrap">

        <div>
          <h1 className="text-5xl font-bold mb-3">
            {trashMode ? "TRASH" : "LIBRARY"}
          </h1>

          <p className="text-white/50">
            {trashMode
              ? "삭제된 웹툰 보관 공간"
              : "완성된 웹툰 보관 공간"}
          </p>
        </div>

        <div className="flex gap-2 justify-end shrink-0">

          <Link
            href="/"
            className="border border-white px-3 py-2 text-sm rounded-full hover:bg-white hover:text-black transition"
          >
            HOME
          </Link>

          <Link
            href="/upload"
            className="border border-white px-3 py-2 text-sm rounded-full hover:bg-white hover:text-black transition"
          >
            UPLOAD
          </Link>

          <button
            onClick={() => setTrashMode(!trashMode)}
            className="border border-red-500 text-red-400 px-3 py-2 text-sm rounded-full hover:bg-red-500 hover:text-white transition"
          >
            {trashMode ? "LIBRARY" : "휴지통"}
          </button>

        </div>

      </div>

      {webtoons.length === 0 && (
        <p className="text-white/40">
          {trashMode
            ? "휴지통이 비어 있어."
            : "아직 웹툰이 없어."}
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

              <p className="text-white/40 mb-5">
                웹툰 보기
              </p>

              {!trashMode ? (

                <div className="flex gap-3">

                  <button
                    onClick={() =>
                      editTitle(toon.id, toon.title)
                    }
                    className="flex-1 border border-white/30 py-2 rounded-xl hover:bg-white hover:text-black transition"
                  >
                    제목 수정
                  </button>

                  <button
                    onClick={() =>
                      moveToTrash(toon.id)
                    }
                    className="flex-1 border border-red-500 text-red-400 py-2 rounded-xl hover:bg-red-500 hover:text-white transition"
                  >
                    삭제
                  </button>

                </div>

              ) : (

                <div className="flex gap-3">

                  <button
                    onClick={() =>
                      restoreWebtoon(toon.id)
                    }
                    className="flex-1 border border-white/30 py-2 rounded-xl hover:bg-white hover:text-black transition"
                  >
                    복구
                  </button>

                  <button
                    onClick={() =>
                      permanentDelete(toon.id)
                    }
                    className="flex-1 border border-red-500 text-red-400 py-2 rounded-xl hover:bg-red-500 hover:text-white transition"
                  >
                    영구 삭제
                  </button>

                </div>

              )}

            </div>

          </div>
        ))}

      </div>

    </main>
  );
}