"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const router = useRouter();

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