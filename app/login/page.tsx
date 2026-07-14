"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../supabase";
import { useSession } from "@/lib/useSession";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const router = useRouter();
  const { session, loading } = useSession();

  const handleSignup = async () => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      alert(error.message);
    } else {
      alert("회원가입 성공!");
    }
  };

  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert(error.message);
    } else {
      alert("로그인 성공!");
      router.push("/");
    }
  };

  if (loading) {
    return null;
  }

  if (session) {
    return (
      <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-6 px-6">
        <p className="text-xl">이미 로그인되어 있습니다.</p>
        <p className="text-white/60">{session.user.email}</p>

        <Link
          href="/"
          className="border border-white px-6 py-4 rounded-full hover:bg-white hover:text-black transition"
        >
          홈으로 가기
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-6">

      <div className="w-full max-w-sm flex flex-col gap-4">

        <h1 className="text-4xl font-bold text-center mb-6">
          LOGIN
        </h1>

        <input
          type="email"
          placeholder="EMAIL"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="bg-black border border-white/30 rounded-full px-6 py-4 text-center outline-none focus:border-white"
        />

        <input
          type="password"
          placeholder="PASSWORD"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="bg-black border border-white/30 rounded-full px-6 py-4 text-center outline-none focus:border-white"
        />

        <button
          onClick={handleLogin}
          className="border border-white px-6 py-4 rounded-full hover:bg-white hover:text-black transition"
        >
          LOGIN
        </button>

        <button
          onClick={handleSignup}
          className="border border-white/30 px-6 py-4 rounded-full hover:bg-white hover:text-black transition"
        >
          SIGN UP
        </button>

      </div>

    </main>
  );
}