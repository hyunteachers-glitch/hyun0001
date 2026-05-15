"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "../../supabase";

type WebtoonImage = {
  id: number;
  image_url: string;
  image_order: number;
};

export default function WebtoonDetailPage() {
  const params = useParams();
  const webtoonId = Number(params.id);

  const [images, setImages] = useState<WebtoonImage[]>([]);

  useEffect(() => {
    if (!webtoonId) return;
    getWebtoonImages();
  }, [webtoonId]);

  async function getWebtoonImages() {
    const { data, error } = await supabase
      .from("webtoon_images")
      .select("*")
      .eq("webtoon_id", webtoonId)
      .order("image_order", { ascending: true });

    if (error) {
      alert(error.message);
      return;
    }

    setImages(data || []);
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="fixed top-0 left-0 right-0 z-50 bg-black/90 border-b border-white/10 px-6 py-4 flex justify-between items-center">
        <Link href="/library" className="text-white/70 hover:text-white">
          ← LIBRARY
        </Link>

        <a href="#top" className="text-white/70 hover:text-white">
          맨 위
        </a>
      </div>

      <div id="top" className="pt-20 pb-20 flex flex-col items-center">
        {images.map((image) => (
          <img
            key={image.id}
            src={image.image_url}
            alt=""
            className="w-full max-w-[720px] block"
          />
        ))}
      </div>
    </main>
  );
}