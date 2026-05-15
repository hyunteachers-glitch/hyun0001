"use client";

import { useState } from "react";
import { supabase } from "../supabase";

export default function UploadPage() {
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
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

    const publicUrlData = supabase.storage
      .from("webtoon")
      .getPublicUrl(filePath);

    console.log(publicUrlData);

    const publicUrl = publicUrlData.data.publicUrl;

    console.log(publicUrl);

    const { error: dbError } = await supabase
      .from("images")
      .insert([{ url: publicUrl }]);

    if (dbError) {
      alert(dbError.message);
    } else {
      alert("업로드 성공! 라이브러리에 저장됐어.");
    }

    setUploading(false);
  };

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="flex flex-col gap-6 items-center">

        <h1 className="text-4xl font-bold">
          UPLOAD
        </h1>

        <input
          type="file"
          onChange={handleUpload}
          className="border border-white p-4 rounded-xl"
        />

        {uploading && <p>업로드 중...</p>}

      </div>
    </main>
  );
}