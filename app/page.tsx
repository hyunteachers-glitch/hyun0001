"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  const router = useRouter();

  const handleEnter = () => {
    if (code === "hyun0001") {
      router.push("/library");
    } else {
      setError("ACCESS DENIED");
    }
  };

  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-6">

      <div className="absolute top-6 left-6 text-sm text-gray-500">
        private archive
      </div>

      <h1 className="text-7xl font-bold tracking-widest mb-4">
        hyun0001
      </h1>

      <p className="text-gray-400 text-center mb-10 leading-relaxed">
        authorized access only
      </p>

      <div className="w-full max-w-sm flex flex-col gap-4">

        <input
          type="password"
          placeholder="ACCESS CODE"
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            setError("");
          }}
          className="bg-black border border-white/20 rounded-full px-6 py-4 text-center outline-none focus:border-white transition"
        />

        <button
          onClick={handleEnter}
          className="border border-white px-8 py-3 rounded-full hover:bg-white hover:text-black transition duration-300"
        >
          ENTER
        </button>

        {error && (
          <p className="text-red-500 text-center text-sm">
            {error}
          </p>
        )}

      </div>

      <div className="absolute bottom-6 text-xs text-gray-600">
        private webtoon archive
      </div>

    </main>
  );
}