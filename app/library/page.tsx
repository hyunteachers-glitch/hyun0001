import Link from "next/link";

export default function LibraryPage() {
  const webtoons = [
    {
      id: "shadow-room",
      title: "shadow room",
      episode: "12화",
      cover: "/webtoon/shadow-room/cover.jpg",
    },
    {
      id: "silent-night",
      title: "silent night",
      episode: "7화",
      cover: "/webtoon/shadow-room/cover.jpg",
    },
    {
      id: "memory-archive",
      title: "memory archive",
      episode: "21화",
      cover: "/webtoon/shadow-room/cover.jpg",
    },
  ];

  return (
    <main className="min-h-screen bg-black text-white px-8 py-12">
      <h1 className="text-5xl font-bold mb-3">WEBTOON LIBRARY</h1>

      <p className="text-gray-500 mb-10">
        기억해두고 싶은 이야기들을 보관하는 공간
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {webtoons.map((toon) => (
          <Link key={toon.id} href={`/library/${toon.id}`}>
            <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden hover:border-white transition cursor-pointer">
              <img
                src={toon.cover}
                alt={toon.title}
                className="h-80 w-full object-cover"
              />

              <div className="p-6">
                <h2 className="text-2xl font-bold">{toon.title}</h2>

                <p className="text-gray-400 mt-2">
                  최신화 · {toon.episode}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}