import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-6">
      <div className="absolute top-6 left-6 text-sm text-gray-500">
        private archive
      </div>

      <h1 className="text-7xl font-bold tracking-widest mb-4">
        hyun0001
      </h1>

      <p className="text-gray-400 text-center mb-10 leading-relaxed">
        나만의 웹툰 장면들을
        <br />
        조용히 보관하는 곳
      </p>

      <Link href="/library">
        <button className="border border-white px-8 py-3 rounded-full hover:bg-white hover:text-black transition duration-300">
          ENTER
        </button>
      </Link>

      <div className="absolute bottom-6 text-xs text-gray-600">
        private webtoon archive
      </div>
    </main>
  );
}