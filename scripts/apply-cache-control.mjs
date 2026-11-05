// 기존 R2 객체에 Cache-Control을 일괄 적용하는 일회성 스크립트.
// 사이트 코드에서 import하지 않으므로 빌드에 포함되지 않음.
//
// 사용법 (프로젝트 루트에서):
//   node scripts/apply-cache-control.mjs           # dry-run: 대상 개수 + 샘플 5개만 출력
//   node scripts/apply-cache-control.mjs --apply   # 실제 적용
//
// 동작: ListObjectsV2로 전체 순회 → HeadObject로 Cache-Control 확인 → 없는 객체만
// 자기 자신으로 CopyObject(MetadataDirective: REPLACE). REPLACE는 메타데이터를 통째로
// 교체하므로 HeadObject에서 읽은 ContentType/사용자 메타데이터/기타 헤더를 그대로 다시 넣음.

import fs from "fs";
import {
  S3Client,
  ListObjectsV2Command,
  HeadObjectCommand,
  CopyObjectCommand,
} from "@aws-sdk/client-s3";

const CACHE_CONTROL = "public, max-age=31536000, immutable";
const CONCURRENCY = 8;
const SAMPLE_SIZE = 5;

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

const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME } = process.env;

if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
  console.error(".env.local에 R2 환경변수가 없습니다.");
  process.exit(1);
}

const APPLY = process.argv.includes("--apply");

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
});

async function listAllKeys() {
  const keys = [];
  let token;
  do {
    const res = await s3.send(
      new ListObjectsV2Command({ Bucket: R2_BUCKET_NAME, ContinuationToken: token })
    );
    for (const obj of res.Contents ?? []) keys.push(obj.Key);
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
  return keys;
}

// 동시 실행 개수를 제한해서 items를 처리
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

function encodeCopySource(key) {
  // CopySource는 "버킷/키" 형식이며 키는 URL 인코딩 필요 (슬래시는 유지)
  return `${R2_BUCKET_NAME}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

async function main() {
  console.log(`모드: ${APPLY ? "APPLY (실제 적용)" : "DRY-RUN"}`);
  console.log(`버킷: ${R2_BUCKET_NAME}`);

  const keys = await listAllKeys();
  console.log(`전체 객체: ${keys.length}개`);

  // 1) HeadObject로 현재 상태 조회
  const targets = []; // { key, head }
  const headFailures = [];
  let alreadySet = 0;

  await runPool(
    keys,
    async (key) => {
      try {
        const head = await s3.send(new HeadObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key }));
        if (head.CacheControl) alreadySet++;
        else targets.push({ key, head });
      } catch (error) {
        headFailures.push({ key, error: `${error.name}: ${error.message}` });
      }
    },
    (done, total) => {
      if (done % 100 === 0 || done === total) process.stdout.write(`\r조회 중 ${done}/${total}`);
    }
  );
  process.stdout.write("\n");

  targets.sort((a, b) => a.key.localeCompare(b.key));

  console.log(`이미 Cache-Control 있음(건너뜀): ${alreadySet}개`);
  console.log(`적용 대상: ${targets.length}개`);
  if (headFailures.length) console.log(`조회 실패: ${headFailures.length}개`);

  if (!APPLY) {
    console.log(`\n샘플 ${Math.min(SAMPLE_SIZE, targets.length)}개:`);
    for (const { key, head } of targets.slice(0, SAMPLE_SIZE)) {
      console.log(
        `  ${key}\n    Content-Type: ${head.ContentType ?? "(없음)"}, Metadata: ${JSON.stringify(head.Metadata ?? {})}`
      );
    }
    for (const f of headFailures) console.log(`  조회 실패: ${f.key} — ${f.error}`);
    console.log("\nDRY-RUN 종료. 실제 적용하려면 --apply 옵션을 붙여 실행하세요.");
    return;
  }

  // 2) 자기 자신으로 CopyObject — 기존 헤더/메타데이터 유지 + Cache-Control 추가
  const failures = [];
  await runPool(
    targets,
    async ({ key, head }) => {
      try {
        await s3.send(
          new CopyObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: key,
            CopySource: encodeCopySource(key),
            CopySourceIfMatch: head.ETag, // 조회 이후 객체가 바뀌었으면 덮어쓰지 않음
            MetadataDirective: "REPLACE",
            CacheControl: CACHE_CONTROL,
            ContentType: head.ContentType,
            ContentDisposition: head.ContentDisposition,
            ContentEncoding: head.ContentEncoding,
            ContentLanguage: head.ContentLanguage,
            Expires: head.Expires,
            Metadata: head.Metadata,
          })
        );
      } catch (error) {
        failures.push({ key, error: `${error.name}: ${error.message}` });
      }
    },
    (done, total) => process.stdout.write(`\r적용 중 ${done}/${total}`)
  );
  process.stdout.write("\n");

  console.log(`성공: ${targets.length - failures.length}개, 실패: ${failures.length}개`);
  for (const f of failures) console.log(`  실패: ${f.key} — ${f.error}`);
  if (failures.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
