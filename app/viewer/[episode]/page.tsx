"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../supabase";

type EpisodeImage = {
  id: number;
  image_url: string;
  image_order: number;
};

export default function ViewerPage() {
  const params = useParams();
  const episodeId = Number(params.episode);

  const [images, setImages] = useState<EpisodeImage[]>([]);

  useEffect(() => {
    if (!episodeId) return;
    getEpisodeImages();
  }, [episodeId]);

  async function getEpisodeImages() {
    const { data, error } = await supabase
      .from("episode_images")
      .select("*")
      .eq("episode_id", episodeId)
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
        <button
          onClick={() => history.back()}
          className="text-white/70 hover:text-white"
        >
          ← BACK
        </button>

        <Link href="/library" className="text-white/70 hover:text-white">
          LIBRARY
        </Link>
      </div>

      <div className="pt-20 pb-20 flex flex-col items-center">
        {images.map((image) => (
          <img
            key={image.id}
            src={image.image_url}
            alt=""
            className="w-full max-w-[720px] block"
          />
        ))}

        {images.length === 0 && (
          <p className="text-white/40 mt-20">이미지가 없어.</p>
        )}
      </div>
    </main>
  );
}