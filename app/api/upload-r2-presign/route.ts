import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getEnv } from "@/lib/env";

export const runtime = "nodejs";

const PRESIGN_EXPIRES_SECONDS = 300; // 5분 — 이 안에 클라이언트가 R2로 직접 PUT을 마쳐야 함

function safeFileName(name: string) {
  return name.replace(/\s+/g, "_").replace(/[^\w.\-가-힣]/g, "");
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin(request);

    if (!admin) {
      return NextResponse.json(
        { error: "로그인한 관리자만 업로드할 수 있어." },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => null);
    const fileName = typeof body?.fileName === "string" ? body.fileName : "";

    if (!fileName) {
      return NextResponse.json({ error: "파일명이 없습니다." }, { status: 400 });
    }

    const accountId = getEnv("R2_ACCOUNT_ID");
    const accessKeyId = getEnv("R2_ACCESS_KEY_ID");
    const secretAccessKey = getEnv("R2_SECRET_ACCESS_KEY");
    const bucketName = getEnv("R2_BUCKET_NAME");
    const publicUrl = getEnv("R2_PUBLIC_URL");

    const s3 = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });

    const key = `uploads/${Date.now()}-${crypto.randomUUID()}-${safeFileName(fileName)}`;

    // ContentType은 일부러 서명에 포함하지 않음 — 클라이언트가 실제 PUT에서 보내는
    // Content-Type 헤더가 이 signed URL의 서명값과 정확히 일치해야 하는 취약한 결합을
    // 피하기 위함. Bucket/Key만 서명하고, 실제 객체의 Content-Type은 클라이언트가
    // PUT 요청 헤더로 자유롭게 지정해도 그대로 저장됨.
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    const uploadUrl = await getSignedUrl(s3, command, {
      expiresIn: PRESIGN_EXPIRES_SECONDS,
    });

    return NextResponse.json({
      uploadUrl,
      publicUrl: `${publicUrl}/${key}`,
    });
  } catch (error) {
    console.error("R2 presign error:", error);

    const message =
      error instanceof Error ? error.message : "presigned URL 발급 중 오류가 발생했습니다.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
