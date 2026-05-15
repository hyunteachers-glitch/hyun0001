"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../supabase";

type ImageItem = {
  id: number;
  url: string;
};

export default function LibraryPage() {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    getImages();
  }, []);

  async function getImages() {
    const { data, error } = await supabase
      .from("images")
      .select("*")
      .order("id", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    setImages(data || []);
  }

  async function deleteImage(id: number, url: string) {
    const confirmDelete = confirm("정말 삭제할까?");
    if (!confirmDelete) return;

    const filePath = url.split("/webtoon/")[1];

    const { error: storageError } = await supabase.storage
      .from("webtoon")
      .remove([filePath]);

    if (storageError) {
      alert("Storage 삭제 실패: " + storageError.message);
      return;
    }

    const { error: dbError } = await supabase
      .from("images")
      .delete()
      .eq("id", id);

    if (dbError) {
      alert("DB 삭제 실패: " + dbError.message);
      return;
    }

    getImages();
  }

  return (
    <main className="min-h-screen bg-black text-white px-8 py-10">
      <h1 className="text-5xl font-bold mb-8">
        WEBTOON LIBRARY
      </h1>

      <Link
        href="/upload"
        className="border border-white px-6 py-3 rounded-full inline-block mb-10 hover:bg-white hover:text-black transition"
      >
        업로드 하기
      </Link>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {images.map((item) => (
          <div
            key={item.id}
            className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden"
          >
            <button
              onClick={() => setSelectedImage(item.url)}
              className="w-full"
            >
              <img
                src={item.url}
                alt=""
                className="w-full h-64 object-cover hover:scale-105 transition duration-300"
              />
            </button>

            <button
              onClick={() => deleteImage(item.id, item.url)}
              className="w-full py-3 text-red-400 border-t border-white/10 hover:bg-red-500 hover:text-white transition"
            >
              삭제
            </button>
          </div>
        ))}
      </div>

      {selectedImage && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-6">
          <button
            onClick={() => setSelectedImage(null)}
            className="absolute top-6 right-6 border border-white px-5 py-2 rounded-full hover:bg-white hover:text-black transition"
          >
            닫기
          </button>

          <img
            src={selectedImage}
            alt=""
            className="max-w-full max-h-full object-contain rounded-2xl"
          />
        </div>
      )}
    </main>
  );
}