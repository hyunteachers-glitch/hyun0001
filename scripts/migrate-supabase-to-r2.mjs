import fs from "fs";
import { createClient } from "@supabase/supabase-js";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

function loadEnv() {
  const text = fs.readFileSync(".env.local", "utf8");

  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const index = trimmed.indexOf("=");
    if (index === -1) continue;

    const key = trimmed.slice(0, index);
    const value = trimmed.slice(index + 1);
    process.env[key] = value;
  }
}

loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL;

const SUPABASE_BUCKET = "webtoon";

if (
  !SUPABASE_URL ||
  !SERVICE_ROLE_KEY ||
  !R2_ACCOUNT_ID ||
  !R2_ACCESS_KEY_ID ||
  !R2_SECRET_ACCESS_KEY ||
  !R2_BUCKET_NAME ||
  !R2_PUBLIC_URL
) {
  throw new Error(".env.local 환경변수가 부족해.");
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

const targets = [
  { table: "images", column: "url" },
  { table: "webtoons", column: "cover_url" },
  { table: "webtoons", column: "main_image_url" },
  { table: "episodes", column: "cover_url" },
  { table: "episode_images", column: "image_url" },
];

function isSupabaseStorageUrl(url) {
  return (
    typeof url === "string" &&
    url.includes("/storage/v1/object/public/") &&
    url.includes(`/${SUPABASE_BUCKET}/`)
  );
}

function getPathFromSupabaseUrl(url) {
  const marker = `/storage/v1/object/public/${SUPABASE_BUCKET}/`;
  return decodeURIComponent(url.split(marker)[1]);
}

async function getAllRows(table, column) {
  const all = [];
  const limit = 1000;

  for (let from = 0; ; from += limit) {
    const to = from + limit - 1;

    const { data, error } = await supabase
      .from(table)
      .select(`id, ${column}`)
      .range(from, to);

    if (error) {
      console.log(`스킵: ${table}.${column} - ${error.message}`);
      return [];
    }

    all.push(...(data || []));

    if (!data || data.length < limit) break;
  }

  return all;
}

async function uploadToR2(oldUrl, key) {
  const response = await fetch(oldUrl);

  if (!response.ok) {
    throw new Error(`다운로드 실패: ${response.status} ${oldUrl}`);
  }

  const contentType =
    response.headers.get("content-type") || "application/octet-stream";

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  await s3.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  );

  return `${R2_PUBLIC_URL}/${key}`;
}

async function main() {
  console.log("Supabase → R2 이전 시작");

  const urlMap = new Map();

  for (const target of targets) {
    const rows = await getAllRows(target.table, target.column);

    for (const row of rows) {
      const oldUrl = row[target.column];

      if (!isSupabaseStorageUrl(oldUrl)) continue;
      if (urlMap.has(oldUrl)) continue;

      const key = getPathFromSupabaseUrl(oldUrl);
      const newUrl = await uploadToR2(oldUrl, key);

      urlMap.set(oldUrl, newUrl);

      console.log(`복사 완료: ${key}`);
    }
  }

  console.log(`복사된 파일 수: ${urlMap.size}`);

  for (const target of targets) {
    const rows = await getAllRows(target.table, target.column);

    for (const row of rows) {
      const oldUrl = row[target.column];
      const newUrl = urlMap.get(oldUrl);

      if (!newUrl) continue;

      const { error } = await supabase
        .from(target.table)
        .update({ [target.column]: newUrl })
        .eq("id", row.id);

      if (error) {
        console.log(`DB 변경 실패: ${target.table}.${target.column} id=${row.id}`);
        console.log(error.message);
      } else {
        console.log(`DB 변경 완료: ${target.table}.${target.column} id=${row.id}`);
      }
    }
  }

  console.log("이전 완료. 사이트에서 이미지 확인 후 Supabase Storage를 정리하면 돼.");
}

main().catch((error) => {
  console.error("이전 실패");
  console.error(error);
  process.exit(1);
});