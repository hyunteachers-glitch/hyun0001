import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-10 px-6">
      <div className="text-center">
        <p className="text-white/40 mb-4">private webtoon archive</p>

        <h1 className="text-7xl font-bold mb-4">
          hyun0001
        </h1>

        <p className="text-white/60 text-xl">
          나만의 웹툰 장면들을 조용히 보관하는 곳
        </p>
      </div>

      <div className="flex flex-col gap-5 w-full max-w-md">
        <Link
          href="/library"
          className="border border-white rounded-2xl py-5 text-center text-2xl hover:bg-white hover:text-black transition"
        >
          LIBRARY
        </Link>

        <Link
          href="/upload"
          className="border border-white rounded-2xl py-5 text-center text-2xl hover:bg-white hover:text-black transition"
        >
          UPLOAD
        </Link>

        <Link
          href="/login"
          className="border border-white/40 rounded-2xl py-5 text-center text-2xl hover:bg-white hover:text-black transition"
        >
          LOGIN
        </Link>
      </div>
    </main>
  );
}