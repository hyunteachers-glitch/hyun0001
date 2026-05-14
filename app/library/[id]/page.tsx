import Link from "next/link";

export default function WebtoonDetailPage() {
  const episodes = [
    { number: 1, title: "1화" },
    { number: 2, title: "2화" },
    { number: 3, title: "3화" },
  ];

  return (
    <main className="min-h-screen bg-black text-white px-8 py-12">

      <Link
        href="/library"
        className="text-gray-500 hover:text-white"
      >
        ← 돌아가기
      </Link>

      <div className="mt-10 mb-12">

        <div className="w-full h-80 bg-white/5 rounded-3xl mb-8"></div>

        <h1 className="text-5xl font-bold mb-3">
          shadow room
        </h1>

        <p className="text-gray-500">
          어두운 방 안에 남겨진 장면들을 따라가는 이야기
        </p>

      </div>

      <h2 className="text-2xl font-bold mb-5">
        회차 목록
      </h2>

      <div className="space-y-3">
        {episodes.map((ep) => (
          <Link
            key={ep.number}
            href={`/viewer/${ep.number}`}
          >
            <div className="border border-white/10 rounded-2xl p-5 hover:border-white transition cursor-pointer">
              {ep.title}
            </div>
          </Link>
        ))}
      </div>

    </main>
  );
}