"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../supabase";

type ImageItem = {
  id: number;
  url: string;
};

export default function UploadPage() {
  const [uploading, setUploading] = useState(false);
  const [images, setImages] = useState<ImageItem[]>([]);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [createMode, setCreateMode] = useState(false);
  const [deleteMode, setDeleteMode] = useState(false);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [title, setTitle] = useState("");

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

  function toggleImage(url: string) {
    if (selectedImages.includes(url)) {
      setSelectedImages(selectedImages.filter((item) => item !== url));
    } else {
      setSelectedImages([...selectedImages, url]);
    }
  }

  function handleImageClick(item: ImageItem) {
    if (createMode) {
      toggleImage(item.url);
      return;
    }

    if (deleteMode) {
      deleteImage(item.id, item.url);
      return;
    }

    setPreviewImage(item.url);
  }

  async function createWebtoon() {
    if (!title.trim()) {
      alert("웹툰 제목을 입력해줘.");
      return;
    }

    if (selectedImages.length === 0) {
      alert("이미지를 선택해줘.");
      return;
    }

    const { data: webtoonData, error: webtoonError } = await supabase
      .from("webtoons")
      .insert([
        {
          title: title.trim(),
          cover_url: selectedImages[0],
        },
      ])
      .select()
      .single();

    if (webtoonError) {
      alert(webtoonError.message);
      return;
    }

    const imageRows = selectedImages.map((url, index) => ({
      webtoon_id: webtoonData.id,
      image_url: url,
      image_order: index,
    }));

    const { error: imageError } = await supabase
      .from("webtoon_images")
      .insert(imageRows);

    if (imageError) {
      alert(imageError.message);
      return;
    }

    alert("웹툰 생성 완료!");

    setTitle("");
    setSelectedImages([]);
    setCreateMode(false);
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "black",
        color: "white",
        padding: "32px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "32px",
        }}
      >
        <div>
          <h1 style={{ fontSize: "42px", fontWeight: "bold" }}>
            UPLOAD
          </h1>

          <p style={{ color: "rgba(255,255,255,0.5)" }}>
            업로드한 이미지를 관리하는 공간
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <Link href="/" style={buttonStyle}>
            HOME
          </Link>

          <label style={buttonStyle}>
            이미지 업로드

            <input
              type="file"
              onChange={handleUpload}
              style={{ display: "none" }}
            />
          </label>

          <button
            onClick={() => {
              setCreateMode(!createMode);
              setDeleteMode(false);
              setSelectedImages([]);
            }}
            style={
              createMode
                ? activeButtonStyle
                : buttonStyle
            }
          >
            {createMode
              ? "생성 종료"
              : "생성"}
          </button>

          <button
            onClick={() => {
              setDeleteMode(!deleteMode);
              setCreateMode(false);
              setSelectedImages([]);
            }}
            style={
              deleteMode
                ? deleteActiveStyle
                : deleteButtonStyle
            }
          >
            {deleteMode
              ? "삭제 종료"
              : "삭제"}
          </button>
        </div>
      </div>

      {uploading && <p>업로드 중...</p>}

      {createMode && (
        <div
          style={{
            marginBottom: "24px",
            display: "flex",
            gap: "10px",
            maxWidth: "720px",
          }}
        >
          <input
            type="text"
            placeholder="웹툰 제목"
            value={title}
            onChange={(e) =>
              setTitle(e.target.value)
            }
            style={inputStyle}
          />

          <button
            onClick={createWebtoon}
            style={buttonStyle}
          >
            웹툰 생성하기
          </button>
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(8, 120px)",
          gap: "12px",
          overflowX: "auto",
          alignItems: "start",
        }}
      >
        {images.map((item) => {
          const selected =
            selectedImages.includes(item.url);

          const order =
            selectedImages.indexOf(item.url) + 1;

          return (
            <button
              key={item.id}
              onClick={() =>
                handleImageClick(item)
              }
              style={{
                position: "relative",
                width: "120px",
                height: "120px",
                border: selected
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

              {createMode && selected && (
                <div style={numberStyle}>
                  {order}
                </div>
              )}

              {deleteMode && (
                <div style={deleteOverlayStyle}>
                  ×
                </div>
              )}
            </button>
          );
        })}
      </div>

      {previewImage && (
        <div style={previewOverlayStyle}>
          <button
            onClick={() =>
              setPreviewImage(null)
            }
            style={closeButtonStyle}
          >
            닫기
          </button>

          <img
            src={previewImage}
            alt=""
            style={{
              maxWidth: "90vw",
              maxHeight: "90vh",
              objectFit: "contain",
            }}
          />
        </div>
      )}
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
  flex: 1,
  border: "1px solid rgba(255,255,255,0.25)",
  borderRadius: "16px",
  padding: "14px 18px",
  background: "black",
  color: "white",
  fontSize: "16px",
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

const previewOverlayStyle = {
  position: "fixed" as const,
  inset: 0,
  background: "rgba(0,0,0,0.92)",
  zIndex: 9999,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "24px",
};

const closeButtonStyle = {
  position: "absolute" as const,
  top: "24px",
  right: "24px",
  border: "1px solid white",
  borderRadius: "999px",
  padding: "10px 20px",
  background: "black",
  color: "white",
  cursor: "pointer",
};