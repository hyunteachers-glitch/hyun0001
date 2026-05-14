export default function LibraryPage() {
  const webtoons = [
    {
      title: "shadow room",
      episode: "12화",
    },
    {
      title: "silent night",
      episode: "7화",
    },
    {
      title: "memory archive",
      episode: "21화",
    },
  ];

  return (
    <main className="min-h-screen bg-black text-white p-10">
      
      <div className="mb-12">
        <h1 className="text-5xl font-bold mb-3">
          WEBTOON LIBRARY
        </h1>

        <p className="text-gray-500">
          기억해두고 싶은 이야기들을 보관하는 공간
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {webtoons.map((toon, index) => (
          <div
            key={index}
            className="border border-white/10 rounded-3xl overflow-hidden hover:border-white transition duration-300 bg-white/5"
          >

            <div className="h-80 bg-gradient-to-b from-gray-800 to-black"></div>

            <div className="p-6">
              <h2 className="text-2xl font-semibold mb-2">
                {toon.title}
              </h2>

              <p className="text-gray-400">
                최신화 · {toon.episode}
              </p>
            </div>

          </div>
        ))}
      </div>

    </main>
  );
}