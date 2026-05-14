import Link from "next/link";

export default async function ViewerPage({
  params,
}: {
  params: Promise<{ episode: string }>;
}) {
  const { episode } = await params;

  const currentEpisode = Number(episode);

  return (
    <main className="bg-black min-h-screen flex flex-col items-center">
      <div className="w-full max-w-3xl">
        <div className="sticky top-0 z-50 bg-black/80 backdrop-blur border-b border-white/10 p-4 flex items-center justify-between text-white">
          <Link
            href={`/viewer/${currentEpisode - 1}`}
            className={`${
              currentEpisode === 1 ? "pointer-events-none opacity-30" : ""
            }`}
          >
            ← 이전화
          </Link>

          <div className="font-semibold">{currentEpisode}화</div>

          <Link href={`/viewer/${currentEpisode + 1}`}>다음화 →</Link>
        </div>

        <img src={`/webtoon/shadow-room/${episode}/1.jpg`} className="w-full" />
        <img src={`/webtoon/shadow-room/${episode}/2.jpg`} className="w-full" />
        <img src={`/webtoon/shadow-room/${episode}/3.jpg`} className="w-full" />

        <div className="py-12 flex justify-center">
          <a
            href="#top"
            className="border border-white/20 text-white px-6 py-3 rounded-full hover:bg-white hover:text-black transition"
          >
            맨 위로
          </a>
        </div>
      </div>
    </main>
  );
}