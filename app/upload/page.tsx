"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../supabase";

type ImageItem = {
  id: number;
  url: string;
};

export default function UploadPage() {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [mode, setMode] = useState<"gallery" | "work" | "delete">("gallery");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [coverUrl, setCoverUrl] = useState("");

  useEffect(() => {
    getImages();
  }, []);

  async function getImages() {
    const { data, error } = await supabase
      .from("images")
      .select("*")
      .order("id", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    setImages(data || []);
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);

    const filePath = `uploads/${Date.now()}-${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("webtoon")
      .upload(filePath, file);

    if (uploadError) {
      alert(uploadError.message);
      setUploading(false);
      return;
    }

    const publicUrl = supabase.storage
      .from("webtoon")
      .getPublicUrl(filePath).data.publicUrl;

    const { error: dbError } = await supabase
      .from("images")
      .insert([{ url: publicUrl }]);

    if (dbError) {
      alert(dbError.message);
    } else {
      getImages();
    }

    setUploading(false);
  }

  async function deleteImage(id: number, url: string) {
    const ok = confirm("정말 삭제할까?");
    if (!ok) return;

    const filePath = url.split("/webtoon/")[1];

    await supabase.storage.from("webtoon").remove([filePath]);
    await supabase.from("images").delete().eq("id", id);

    getImages();
  }

  async function createWork() {
    if (!title.trim()) {
      alert("작품 이름을 입력해줘.");
      return;
    }

    if (!coverUrl) {
      alert("썸네일 사진을 선택해줘.");
      return;
    }

    const { error } = await supabase.from("webtoons").insert([
      {
        title: title.trim(),
        description: description.trim(),
        cover_url: coverUrl,
        deleted: false,
      },
    ]);

    if (error) {
      alert(error.message);
      return;
    }

    alert("작품 생성 완료!");

    setTitle("");
    setDescription("");
    setCoverUrl("");
    setMode("gallery");
  }

  return (
    <main style={{ minHeight: "100vh", background: "black", color: "white", padding: "32px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "28px" }}>
        <div>
          <h1 style={{ fontSize: "42px", fontWeight: "bold" }}>UPLOAD</h1>
          <p style={{ color: "rgba(255,255,255,0.5)" }}>이미지 업로드 / 작품 생성 / 삭제 관리</p>
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <Link href="/" style={buttonStyle}>HOME</Link>
          <Link href="/library" style={buttonStyle}>LIBRARY</Link>

          <label style={buttonStyle}>
            이미지 업로드
            <input type="file" onChange={handleUpload} style={{ display: "none" }} />
          </label>

          <button onClick={() => setMode("work")} style={mode === "work" ? activeButtonStyle : buttonStyle}>
            작품 생성
          </button>

          <button onClick={() => setMode("delete")} style={mode === "delete" ? deleteActiveStyle : deleteButtonStyle}>
            삭제
          </button>
        </div>
      </div>

      {uploading && <p>업로드 중...</p>}

      {mode === "work" && (
        <div style={{ marginBottom: "28px", maxWidth: "720px", display: "flex", flexDirection: "column", gap: "12px" }}>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="작품 이름"
            style={inputStyle}
          />

          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="작품 설명"
            style={{ ...inputStyle, minHeight: "100px", resize: "vertical" }}
          />

          <button onClick={createWork} style={buttonStyle}>
            작품 만들기
          </button>

          <p style={{ color: "rgba(255,255,255,0.5)" }}>
            아래 이미지 중 하나를 클릭하면 썸네일로 선택돼.
          </p>
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(8, 120px)",
          gap: "12px",
          overflowX: "auto",
        }}
      >
        {images.map((item) => {
          const isCover = coverUrl === item.url;

          return (
            <button
              key={item.id}
              onClick={() => {
                if (mode === "work") setCoverUrl(item.url);
                if (mode === "delete") deleteImage(item.id, item.url);
              }}
              style={{
                position: "relative",
                width: "120px",
                height: "120px",
                border: isCover ? "3px solid white" : "1px solid rgba(255,255,255,0.2)",
                borderRadius: "10px",
                overflow: "hidden",
                padding: 0,
                background: "black",
                cursor: "pointer",
              }}
            >
              <img
                src={item.url}
                alt=""
                style={{
                  width: "120px",
                  height: "120px",
                  objectFit: "cover",
                  display: "block",
                }}
              />

              {isCover && <div style={badgeStyle}>썸네일</div>}
              {mode === "delete" && <div style={deleteOverlayStyle}>×</div>}
            </button>
          );
        })}
      </div>
    </main>
  );
}

const buttonStyle = {
  border: "1px solid white",
  borderRadius: "999px",
  padding: "14px 24px",
  background: "black",
  color: "white",
  cursor: "pointer",
  fontSize: "16px",
  textDecoration: "none",
};

const activeButtonStyle = {
  ...buttonStyle,
  background: "white",
  color: "black",
};

const deleteButtonStyle = {
  ...buttonStyle,
  border: "1px solid red",
  color: "red",
};

const deleteActiveStyle = {
  ...deleteButtonStyle,
  background: "red",
  color: "white",
};

const inputStyle = {
  border: "1px solid rgba(255,255,255,0.25)",
  borderRadius: "16px",
  padding: "14px 18px",
  background: "black",
  color: "white",
  fontSize: "16px",
};

const badgeStyle = {
  position: "absolute" as const,
  left: "6px",
  bottom: "6px",
  background: "white",
  color: "black",
  fontSize: "11px",
  fontWeight: "bold",
  padding: "4px 6px",
  borderRadius: "6px",
};

const deleteOverlayStyle = {
  position: "absolute" as const,
  inset: 0,
  background: "rgba(0,0,0,0.55)",
  color: "white",
  fontSize: "40px",
  fontWeight: "bold",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};