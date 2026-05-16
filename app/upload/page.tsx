"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../supabase";

type ImageItem = {
  id: number;
  url: string;
};

type WebtoonItem = {
  id: number;
  title: string;
  cover_url: string;
};

export default function UploadPage() {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [webtoons, setWebtoons] = useState<WebtoonItem[]>([]);
  const [uploading, setUploading] = useState(false);

  const [mode, setMode] = useState<"gallery" | "work" | "episode" | "delete">("gallery");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [coverUrl, setCoverUrl] = useState("");

  const [episodeTitle, setEpisodeTitle] = useState("");
  const [selectedWebtoonId, setSelectedWebtoonId] = useState("");
  const [selectedImages, setSelectedImages] = useState<string[]>([]);

  useEffect(() => {
    getImages();
    getWebtoons();
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

  async function getWebtoons() {
    const { data, error } = await supabase
      .from("webtoons")
      .select("*")
      .eq("deleted", false)
      .order("id", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    setWebtoons(data || []);
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
    getWebtoons();
  }

  function toggleEpisodeImage(url: string) {
    if (selectedImages.includes(url)) {
      setSelectedImages(selectedImages.filter((item) => item !== url));
    } else {
      setSelectedImages([...selectedImages, url]);
    }
  }

  async function createEpisode() {
    if (!selectedWebtoonId) {
      alert("작품을 선택해줘.");
      return;
    }

    if (!episodeTitle.trim()) {
      alert("에피소드 제목을 입력해줘.");
      return;
    }

    if (selectedImages.length === 0) {
      alert("에피소드 이미지를 선택해줘.");
      return;
    }

    const { data: existingEpisodes, error: countError } = await supabase
      .from("episodes")
      .select("*")
      .eq("webtoon_id", Number(selectedWebtoonId));

    if (countError) {
      alert(countError.message);
      return;
    }

    const nextEpisodeNo = (existingEpisodes?.length || 0) + 1;

    const { data: episodeData, error: episodeError } = await supabase
      .from("episodes")
      .insert([
        {
          webtoon_id: Number(selectedWebtoonId),
          title: episodeTitle.trim(),
          episode_no: nextEpisodeNo,
          cover_url: selectedImages[0],
          deleted: false,
        },
      ])
      .select()
      .single();

    if (episodeError) {
      alert(episodeError.message);
      return;
    }

    const imageRows = selectedImages.map((url, index) => ({
      episode_id: episodeData.id,
      image_url: url,
      image_order: index,
    }));

    const { error: imageError } = await supabase
      .from("episode_images")
      .insert(imageRows);

    if (imageError) {
      alert(imageError.message);
      return;
    }

    alert("에피소드 생성 완료!");

    setEpisodeTitle("");
    setSelectedWebtoonId("");
    setSelectedImages([]);
    setMode("gallery");
  }

  return (
    <main style={{ minHeight: "100vh", background: "black", color: "white", padding: "32px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "28px" }}>
        <div>
          <h1 style={{ fontSize: "42px", fontWeight: "bold" }}>UPLOAD</h1>
          <p style={{ color: "rgba(255,255,255,0.5)" }}>
            이미지 업로드 / 작품 생성 / 에피소드 생성 / 삭제
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <Link href="/" style={buttonStyle}>HOME</Link>
          <Link href="/library" style={buttonStyle}>LIBRARY</Link>

          <label style={buttonStyle}>
            이미지 업로드
            <input type="file" onChange={handleUpload} style={{ display: "none" }} />
          </label>

          <button onClick={() => setMode("work")} style={mode === "work" ? activeButtonStyle : buttonStyle}>
            작품 생성
          </button>

          <button onClick={() => setMode("episode")} style={mode === "episode" ? activeButtonStyle : buttonStyle}>
            에피소드 생성
          </button>

          <button onClick={() => setMode("delete")} style={mode === "delete" ? deleteActiveStyle : deleteButtonStyle}>
            삭제
          </button>
        </div>
      </div>

      {uploading && <p>업로드 중...</p>}

      {mode === "work" && (
        <div style={formBoxStyle}>
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

      {mode === "episode" && (
        <div style={formBoxStyle}>
          <select
            value={selectedWebtoonId}
            onChange={(e) => setSelectedWebtoonId(e.target.value)}
            style={inputStyle}
          >
            <option value="">작품 선택</option>
            {webtoons.map((toon) => (
              <option key={toon.id} value={toon.id}>
                {toon.title}
              </option>
            ))}
          </select>

          <input
            value={episodeTitle}
            onChange={(e) => setEpisodeTitle(e.target.value)}
            placeholder="에피소드 제목"
            style={inputStyle}
          />

          <button onClick={createEpisode} style={buttonStyle}>
            에피소드 만들기
          </button>

          <p style={{ color: "rgba(255,255,255,0.5)" }}>
            아래 이미지를 순서대로 선택하면 에피소드 컷으로 저장돼.
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
          const selected = selectedImages.includes(item.url);
          const order = selectedImages.indexOf(item.url) + 1;

          return (
            <button
              key={item.id}
              onClick={() => {
                if (mode === "work") setCoverUrl(item.url);
                if (mode === "episode") toggleEpisodeImage(item.url);
                if (mode === "delete") deleteImage(item.id, item.url);
              }}
              style={{
                position: "relative",
                width: "120px",
                height: "120px",
                border:
                  isCover || selected
                    ? "3px solid red"
                    : "1px solid rgba(255,255,255,0.2)",
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

              {isCover && mode === "work" && <div style={badgeStyle}>썸네일</div>}

              {selected && mode === "episode" && (
                <div style={numberStyle}>{order}</div>
              )}

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

const formBoxStyle = {
  marginBottom: "28px",
  maxWidth: "720px",
  display: "flex",
  flexDirection: "column" as const,
  gap: "12px",
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

const numberStyle = {
  position: "absolute" as const,
  top: "6px",
  right: "6px",
  width: "26px",
  height: "26px",
  background: "red",
  color: "white",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: "bold",
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