"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "./supabase";

export default function HomePage() {
  const [password, setPassword] = useState("");
  const [allowed, setAllowed] = useState(false);
  const [checking, setChecking] = useState(false);

  const [changeMode, setChangeMode] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    checkTodayAccess();
  }, []);

  function todayKey() {
    const now = new Date();
    return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  }

  function checkTodayAccess() {
    const savedDate = localStorage.getItem("hyun0001_access_date");

    if (savedDate === todayKey()) {
      setAllowed(true);
    }
  }

  async function verifyPassword(candidate: string) {
    const res = await fetch("/api/check-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: candidate }),
    });

    if (!res.ok && res.status !== 400) {
      throw new Error("비밀번호 확인 중 오류가 발생했어.");
    }

    const data = await res.json();
    return Boolean(data.valid);
  }

  async function enterSite() {
    if (checking) return;
    setChecking(true);

    try {
      const valid = await verifyPassword(password);

      if (!valid) {
        alert("비밀번호가 틀렸어.");
        return;
      }

      localStorage.setItem("hyun0001_access_date", todayKey());
      setAllowed(true);
      setPassword("");
    } catch (error) {
      alert(error instanceof Error ? error.message : "오류가 발생했어.");
    } finally {
      setChecking(false);
    }
  }

  async function changePassword() {
    try {
      if (!newPassword.trim()) {
        alert("새 비밀번호를 입력해줘.");
        return;
      }

      if (newPassword !== confirmPassword) {
        alert("새 비밀번호가 서로 달라.");
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        alert("로그인이 필요해.");
        return;
      }

      const res = await fetch("/api/update-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ newPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error ?? "비밀번호 변경 중 오류가 발생했어.");
        return;
      }

      alert("비밀번호가 변경됐어.");

      setNewPassword("");
      setConfirmPassword("");
      setChangeMode(false);
    } catch (error) {
      alert(error instanceof Error ? error.message : "오류가 발생했어.");
    }
  }

  if (!allowed) {
    return (
      <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-8 px-6">
        <div className="text-center">
          <p className="text-white/40 mb-4">private webtoon archive</p>

          <h1 className="text-6xl font-bold mb-4">hyun0001</h1>

          <p className="text-white/60">비밀번호를 입력해줘</p>
        </div>

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") enterSite();
          }}
          placeholder="PASSWORD"
          className="w-full max-w-md bg-black border border-white/40 rounded-2xl py-5 px-5 text-center text-xl outline-none"
        />

        <button
          onClick={enterSite}
          disabled={checking}
          className="w-full max-w-md border border-white rounded-2xl py-5 text-2xl hover:bg-white hover:text-black transition disabled:opacity-50"
        >
          ENTER
        </button>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-10 px-6">
      <div className="flex justify-center">
        <img
          src="/logo-horizontal.png"
          alt="hyun0001"
          className="w-[520px] max-w-full"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-4xl">
        <Link
          href="/library"
          className="border border-white rounded-2xl py-3 text-center text-2xl hover:bg-white hover:text-black transition"
        >
          LIBRARY
        </Link>

        <Link
          href="/upload"
          className="border border-white rounded-2xl py-3 text-center text-2xl hover:bg-white hover:text-black transition"
        >
          UPLOAD
        </Link>

        <Link
          href="/login"
          className="border border-white/40 rounded-2xl py-3 text-center text-2xl hover:bg-white hover:text-black transition"
        >
          LOGIN
        </Link>

        <button
          onClick={() => setChangeMode(!changeMode)}
          className="border border-white/40 rounded-2xl py-3 text-center text-2xl hover:bg-white hover:text-black transition"
        >
          비밀번호 수정
        </button>
      </div>

      {changeMode && (
        <div className="w-full max-w-md flex flex-col gap-4">
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="새 비밀번호"
            className="bg-black border border-white/30 rounded-2xl py-4 px-4 text-center outline-none"
          />

          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="새 비밀번호 확인"
            className="bg-black border border-white/30 rounded-2xl py-4 px-4 text-center outline-none"
          />

          <button
            onClick={changePassword}
            className="border border-white rounded-2xl py-4 hover:bg-white hover:text-black transition"
          >
            변경
          </button>
        </div>
      )}
    </main>
  );
}