// R2 객체의 Cache-Control / Content-Type / 메타데이터를 HeadObject로 확인하는 스크립트.
// 사이트 코드에서 import하지 않으므로 빌드에 포함되지 않음.
//
// 사용법 (프로젝트 루트에서):
//   node scripts/check-cache-control.mjs <키 또는 공개 URL> [...]
//   node scripts/check-cache-control.mjs --latest 5     # 가장 최근 업로드 5개 확인
//   node scripts/check-cache-control.mjs --cors         # 버킷 CORS 설정 출력

import fs from "fs";
import {
  S3Client,
  HeadObjectCommand,
  ListObjectsV2Command,
  GetBucketCorsCommand,
} from "@aws-sdk/client-s3";

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

const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL } =
  process.env;

if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
  console.error(".env.local에 R2 환경변수가 없습니다.");
  process.exit(1);
}

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
});

function toKey(input) {
  if (R2_PUBLIC_URL && input.startsWith(R2_PUBLIC_URL)) {
    return decodeURIComponent(input.slice(R2_PUBLIC_URL.length).replace(/^\/+/, ""));
  }
  if (/^https?:\/\//.test(input)) {
    return decodeURIComponent(new URL(input).pathname.replace(/^\/+/, ""));
  }
  return input;
}

async function head(key) {
  try {
    const res = await s3.send(new HeadObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key }));
    console.log(`\n${key}`);
    console.log(`  Cache-Control: ${res.CacheControl ?? "(없음)"}`);
    console.log(`  Content-Type:  ${res.ContentType ?? "(없음)"}`);
    console.log(`  Size:          ${res.ContentLength}`);
    console.log(`  LastModified:  ${res.LastModified?.toISOString()}`);
    console.log(`  Metadata:      ${JSON.stringify(res.Metadata ?? {})}`);
  } catch (error) {
    console.log(`\n${key}\n  실패: ${error.name} ${error.message}`);
  }
}

async function latest(n) {
  const all = [];
  let token;
  do {
    const res = await s3.send(
      new ListObjectsV2Command({ Bucket: R2_BUCKET_NAME, Prefix: "uploads/", ContinuationToken: token })
    );
    all.push(...(res.Contents ?? []));
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
  all.sort((a, b) => b.LastModified - a.LastModified);
  for (const obj of all.slice(0, n)) await head(obj.Key);
}

async function main() {
  const args = process.argv.slice(2);

  if (args[0] === "--cors") {
    try {
      const res = await s3.send(new GetBucketCorsCommand({ Bucket: R2_BUCKET_NAME }));
      console.log(JSON.stringify(res.CORSRules, null, 2));
    } catch (error) {
      console.log(`CORS 조회 실패: ${error.name} ${error.message}`);
    }
    return;
  }

  if (args[0] === "--latest") {
    await latest(Number(args[1]) || 5);
    return;
  }

  if (args.length === 0) {
    console.log("사용법: node scripts/check-cache-control.mjs <키|URL> | --latest N | --cors");
    process.exit(1);
  }

  for (const arg of args) await head(toKey(arg));
}

main();
