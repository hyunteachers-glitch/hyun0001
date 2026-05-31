"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "./supabase";

export default function HomePage() {
  const [password, setPassword] = useState("");
  const [sitePassword, setSitePassword] = useState("");
  const [allowed, setAllowed] = useState(false);

  const [changeMode, setChangeMode] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    checkTodayAccess();
    getSitePassword();
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

  async function getSitePassword() {
    const { data, error } = await supabase
      .from("site_password")
      .select("password")
      .eq("id", 1)
      .single();

    if (error) {
      alert(error.message);
      return;
    }

    setSitePassword(data.password);
  }

  function enterSite() {
    if (password !== sitePassword) {
      alert("비밀번호가 틀렸어.");
      return;
    }

    localStorage.setItem("hyun0001_access_date", todayKey());
    setAllowed(true);
    setPassword("");
  }

  async function changePassword() {
    if (currentPassword !== sitePassword) {
      alert("현재 비밀번호가 틀렸어.");
      return;
    }

    if (!newPassword.trim()) {
      alert("새 비밀번호를 입력해줘.");
      return;
    }

    if (newPassword !== confirmPassword) {
      alert("새 비밀번호가 서로 달라.");
      return;
    }

    const { error } = await supabase
      .from("site_password")
      .update({
        password: newPassword,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);

    if (error) {
      alert(error.message);
      return;
    }

    alert("비밀번호가 변경됐어.");

    setSitePassword(newPassword);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setChangeMode(false);
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
          className="w-full max-w-md border border-white rounded-2xl py-5 text-2xl hover:bg-white hover:text-black transition"
        >
          ENTER
        </button>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-10 px-6">
      <div className="text-center">
        <p className="text-white/40 mb-4">private webtoon archive</p>

        <div className="flex justify-center mb-4">
  <img
    src="/logo-horizontal.png"
    alt="hyun0001"
    className="w-[420px] max-w-full"
  />
</div>

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

        <button
          onClick={() => setChangeMode(!changeMode)}
          className="border border-white/40 rounded-2xl py-5 text-center text-2xl hover:bg-white hover:text-black transition"
        >
          비밀번호 수정
        </button>
      </div>

      {changeMode && (
        <div className="w-full max-w-md flex flex-col gap-4">
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="현재 비밀번호"
            className="bg-black border border-white/30 rounded-2xl py-4 px-4 text-center outline-none"
          />

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