// 기존 R2 이미지의 썸네일(thumbs/uploads/{원본 키}.webp)을 일괄 생성하는 스크립트.
// 사이트 코드에서 import하지 않으므로 빌드에 포함되지 않음.
//
// 사용법 (프로젝트 루트에서):
//   node scripts/make-thumbnails.mjs                 # dry-run: 대상 집계 + 샘플 + 예상 시간
//   node scripts/make-thumbnails.mjs --apply         # 실제 생성 (작품 대표 이미지 webtoons.cover_url)
//   node scripts/make-thumbnails.mjs --all           # 대상에 images.url까지 포함 (B 범위)
//   node scripts/make-thumbnails.mjs --all --apply
//
// 동작: Supabase에서 대상 URL 수집(중복 제거) → R2 공개 주소의 uploads/ 아래 키만 남김
// → thumbs/ 를 List해서 이미 있는 썸네일은 건너뜀 → 원본 GetObject → sharp로
// 400×400 가운데 cover 크롭(EXIF 회전 반영) webp q80 → thumbs/... 로 PutObject.
// 원본은 읽기만 함(수정/삭제 없음). 이미 만든 건 건너뛰므로 중단 후 다시 실행하면 이어서 진행.

import fs from "fs";
import { createClient } from "@supabase/supabase-js";
import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";

const CACHE_CONTROL = "public, max-age=31536000, immutable";
const THUMB_SIZE = 400;
const THUMB_QUALITY = 80;
const CONCURRENCY = 8;
const SAMPLE_SIZE = 5;
const PAGE_SIZE = 1000;

function loadEnv() {
  const text = fs.readFileSync(".env.local", "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    process.env[trimmed.slice(0, index)] = trimmed.slice(index + 1);
  }
}

loadEnv();

const {
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET_NAME,
  R2_PUBLIC_URL,
  NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
} = process.env;

if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME || !R2_PUBLIC_URL) {
  console.error(".env.local에 R2 환경변수가 없습니다.");
  process.exit(1);
}
if (!NEXT_PUBLIC_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(".env.local에 Supabase 환경변수(URL / SERVICE_ROLE_KEY)가 없습니다.");
  process.exit(1);
}

const APPLY = process.argv.includes("--apply");
const ALL = process.argv.includes("--all");

const PUBLIC_BASE = R2_PUBLIC_URL.replace(/\/+$/, "");
const ORIGINAL_PREFIX = "uploads/";
const THUMB_PREFIX = "thumbs/";

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
});

// RLS와 무관하게 휴지통 작품까지 읽기 위해 service role 사용 (읽기만 함)
const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function fetchColumn(table, column) {
  const values = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from(table)
      .select(column)
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`${table}.${column} 조회 실패: ${error.message}`);
    for (const row of data ?? []) values.push(row[column]);
    if (!data || data.length < PAGE_SIZE) break;
  }
  return values;
}

async function listKeys(prefix) {
  const objects = new Map(); // key -> size
  let token;
  do {
    const res = await s3.send(
      new ListObjectsV2Command({ Bucket: R2_BUCKET_NAME, Prefix: prefix, ContinuationToken: token })
    );
    for (const obj of res.Contents ?? []) objects.set(obj.Key, obj.Size ?? 0);
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
  return objects;
}

// 공개 URL → 원본 객체 키. uploads/ 아래가 아니면 null.
// 업로드 시 publicUrl은 키를 인코딩 없이 이어붙여 만들지만, 혹시 퍼센트 인코딩된 URL이
// 저장돼 있어도 같은 객체를 가리키도록 디코딩해서 실제 키로 맞춘다.
function urlToOriginalKey(url) {
  if (typeof url !== "string" || !url.startsWith(`${PUBLIC_BASE}/${ORIGINAL_PREFIX}`)) return null;
  const raw = url.slice(PUBLIC_BASE.length + 1);
  if (raw === ORIGINAL_PREFIX || raw.endsWith("/") || /[?#]/.test(raw)) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function toThumbKey(originalKey) {
  return `${THUMB_PREFIX}${originalKey}.webp`;
}

// lib/thumbnail.ts의 getThumbUrl과 키 규칙이 일치하는지 샘플로 검증.
// Node 24는 .ts를 타입 제거 후 그대로 import할 수 있음(이 파일은 type import만 있음).
async function verifyAgainstGetThumbUrl(samples) {
  const { getThumbUrl } = await import("../lib/thumbnail.ts");
  const mismatches = [];
  for (const { url, thumbKey } of samples) {
    const fromLib = getThumbUrl(url);
    let libKey = fromLib.startsWith(`${PUBLIC_BASE}/`) ? fromLib.slice(PUBLIC_BASE.length + 1) : null;
    try {
      if (libKey) libKey = decodeURIComponent(libKey);
    } catch {}
    if (libKey !== thumbKey) mismatches.push({ url, expected: thumbKey, fromLib });
  }
  return mismatches;
}

async function runPool(items, worker, onDone) {
  let next = 0;
  let done = 0;
  async function lane() {
    while (next < items.length) {
      const item = items[next++];
      await worker(item);
      done++;
      onDone?.(done, items.length);
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, lane));
}

async function loadSharp() {
  try {
    return (await import("sharp")).default;
  } catch {
    console.error("sharp를 찾을 수 없습니다. 먼저 `npm i -D sharp`로 설치하세요.");
    process.exit(1);
  }
}

async function makeThumbnail(sharp, originalKey) {
  const obj = await s3.send(new GetObjectCommand({ Bucket: R2_BUCKET_NAME, Key: originalKey }));
  const input = Buffer.from(await obj.Body.transformToByteArray());
  const output = await sharp(input, { failOn: "none" })
    .rotate() // EXIF Orientation 반영
    .resize(THUMB_SIZE, THUMB_SIZE, { fit: "cover", position: "centre" })
    .webp({ quality: THUMB_QUALITY })
    .toBuffer();
  return { inputBytes: input.length, output };
}

async function main() {
  console.log(`모드: ${APPLY ? "APPLY (실제 생성)" : "DRY-RUN"} / 범위: ${ALL ? "--all (cover_url + images.url)" : "A (webtoons.cover_url)"}`);
  console.log(`버킷: ${R2_BUCKET_NAME}`);

  // 1) 대상 URL 수집 — webtoons는 deleted 여부 상관없이 전부(휴지통 포함)
  const coverUrls = await fetchColumn("webtoons", "cover_url");
  const urls = [...coverUrls];
  console.log(`작품(휴지통 포함): ${coverUrls.length}개, cover_url 있음: ${coverUrls.filter(Boolean).length}개`);
  if (ALL) {
    const imageUrls = await fetchColumn("images", "url");
    console.log(`images: ${imageUrls.length}개`);
    urls.push(...imageUrls);
  }

  const uniqueUrls = [...new Set(urls.filter((u) => typeof u === "string" && u))];
  console.log(`중복 제거한 URL: ${uniqueUrls.length}개`);

  const candidates = []; // { url, key, thumbKey }
  const skippedFormat = [];
  const seenKeys = new Set();
  for (const url of uniqueUrls) {
    const key = urlToOriginalKey(url);
    if (!key) {
      skippedFormat.push(url);
      continue;
    }
    if (seenKeys.has(key)) continue; // 인코딩만 다른 같은 객체
    seenKeys.add(key);
    candidates.push({ url, key, thumbKey: toThumbKey(key) });
  }
  console.log(`uploads/ 아래 키: ${candidates.length}개, 다른 형식이라 건너뜀: ${skippedFormat.length}개`);

  // 2) 키 규칙 검증
  // 실제 대상에 한글/특수문자 키가 없어도 규칙을 확인할 수 있게 합성 샘플도 함께 검증
  const syntheticSamples = [
    "uploads/1700000000000-00000000-0000-0000-0000-000000000000-한글_파일(1).jpg",
    "uploads/1700000000000-00000000-0000-0000-0000-000000000000-a.b-c_d.png",
  ].flatMap((key) => [
    { url: `${PUBLIC_BASE}/${key}`, key, thumbKey: toThumbKey(key) },
    // 퍼센트 인코딩된 형태로 저장된 경우도 같은 썸네일 키가 나와야 함
    {
      url: `${PUBLIC_BASE}/${key.split("/").map(encodeURIComponent).join("/")}`,
      key,
      thumbKey: toThumbKey(key),
    },
  ]);
  for (const s of syntheticSamples) {
    if (urlToOriginalKey(s.url) !== s.key) {
      console.error(`URL → 키 변환 오류: ${s.url} → ${urlToOriginalKey(s.url)} (기대: ${s.key})`);
      process.exit(1);
    }
  }
  const verifySamples = [
    ...candidates.slice(0, SAMPLE_SIZE),
    ...candidates.filter((c) => /[^\x20-\x7e]/.test(c.key)).slice(0, SAMPLE_SIZE), // 한글 등 비ASCII 키
    ...syntheticSamples,
  ];
  const mismatches = await verifyAgainstGetThumbUrl(verifySamples);
  if (mismatches.length) {
    console.error("\ngetThumbUrl 규칙과 키가 일치하지 않습니다. 중단합니다.");
    for (const m of mismatches) console.error(`  ${m.url}\n    스크립트: ${m.expected}\n    lib:      ${m.fromLib}`);
    process.exit(1);
  }
  console.log(`getThumbUrl 키 규칙 검증: 샘플 ${verifySamples.length}개 일치`);

  // 3) 기존 썸네일 / 원본 존재 여부
  const [thumbs, originals] = await Promise.all([listKeys(THUMB_PREFIX), listKeys(ORIGINAL_PREFIX)]);
  const already = candidates.filter((c) => thumbs.has(c.thumbKey));
  const missingOriginal = candidates.filter((c) => !thumbs.has(c.thumbKey) && !originals.has(c.key));
  const targets = candidates.filter((c) => !thumbs.has(c.thumbKey) && originals.has(c.key));
  const totalBytes = targets.reduce((sum, c) => sum + (originals.get(c.key) ?? 0), 0);

  console.log(`이미 썸네일 있음(건너뜀): ${already.length}개`);
  console.log(`원본이 R2에 없음(건너뜀): ${missingOriginal.length}개`);
  console.log(`새로 만들 대상: ${targets.length}개 (원본 합계 ${(totalBytes / 1024 / 1024).toFixed(1)}MB)`);

  if (!APPLY) {
    console.log(`\n샘플 ${Math.min(SAMPLE_SIZE, targets.length)}개:`);
    for (const c of targets.slice(0, SAMPLE_SIZE)) {
      console.log(`  원본:   ${c.key}\n  썸네일: ${c.thumbKey}`);
    }
    const nonAscii = targets.filter((c) => /[^\x20-\x7e]/.test(c.key));
    console.log(`비ASCII(한글 등) 키 대상: ${nonAscii.length}개`);
    for (const c of nonAscii.slice(0, 2)) console.log(`  ${c.key}`);
    if (skippedFormat.length) {
      console.log(`\n다른 형식이라 건너뛴 URL (최대 5개):`);
      for (const u of skippedFormat.slice(0, 5)) console.log(`  ${u}`);
    }
    for (const c of missingOriginal.slice(0, 5)) console.log(`  원본 없음: ${c.key}`);

    // 예상 시간 측정 — 처음 몇 개를 실제로 다운로드+변환만 해봄(업로드 없음)
    if (targets.length) {
      const sharp = await loadSharp();
      const bench = targets.slice(0, Math.min(3, targets.length));
      const started = Date.now();
      let benchOk = 0;
      for (const c of bench) {
        try {
          const { inputBytes, output } = await makeThumbnail(sharp, c.key);
          benchOk++;
          console.log(`  측정: ${c.key} ${(inputBytes / 1024).toFixed(0)}KB → ${(output.length / 1024).toFixed(1)}KB`);
        } catch (error) {
          console.log(`  측정 실패: ${c.key} — ${error.name}: ${error.message}`);
        }
      }
      if (benchOk) {
        const perItemMs = (Date.now() - started) / bench.length;
        const estSec = (perItemMs * targets.length) / CONCURRENCY / 1000;
        console.log(
          `1개당 약 ${(perItemMs / 1000).toFixed(2)}초(순차 기준) → 동시 ${CONCURRENCY}개로 예상 약 ${Math.ceil(estSec)}초 (업로드 시간 포함 시 조금 더)`
        );
      }
    }

    console.log("\nDRY-RUN 종료. 실제 생성하려면 --apply 옵션을 붙여 실행하세요.");
    return;
  }

  // 4) 생성 + 업로드 (thumbs/ 에만 씀, 원본은 읽기만)
  const sharp = await loadSharp();
  const failures = [];
  await runPool(
    targets,
    async (c) => {
      try {
        const { output } = await makeThumbnail(sharp, c.key);
        if (!c.thumbKey.startsWith(THUMB_PREFIX)) throw new Error("썸네일 키가 thumbs/ 아래가 아님");
        await s3.send(
          new PutObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: c.thumbKey,
            Body: output,
            ContentType: "image/webp",
            CacheControl: CACHE_CONTROL,
          })
        );
      } catch (error) {
        failures.push({ key: c.key, error: `${error.name}: ${error.message}` });
      }
    },
    (done, total) => process.stdout.write(`\r생성 중 ${done}/${total}`)
  );
  process.stdout.write("\n");

  console.log(`성공: ${targets.length - failures.length}개, 실패: ${failures.length}개`);
  for (const f of failures) console.log(`  실패: ${f.key} — ${f.error}`);
  if (failures.length) {
    console.log("다시 실행하면 이미 만든 썸네일은 건너뛰고 실패한 것만 다시 시도합니다.");
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
