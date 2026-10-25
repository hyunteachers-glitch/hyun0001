import { ListObjectsV2Command } from "@aws-sdk/client-s3";
import { revalidateTag, unstable_cache } from "next/cache";
import { getEnv } from "@/lib/env";
import { createR2Client } from "@/lib/r2";
import { createServiceClient } from "@/lib/supabase/server";

// 서버 전용 — R2 자격증명과 service role 키를 사용함. 클라이언트 컴포넌트에서 import 금지.

export type R2Usage = {
  usedBytes: number;
  objectCount: number;
  fetchedAt: number;
};

export type DbUsage = {
  usedBytes: number;
  fetchedAt: number;
};

const R2_USAGE_TAG = "r2-usage";
const R2_CACHE_SECONDS = 600; // 10분 — ListObjects(Class A) 호출 절약
const R2_REFRESH_MIN_INTERVAL_MS = 60 * 1000; // 새로고침 연타 방지

// 버킷 전체를 1000개씩 페이지네이션하며 크기와 개수만 합산. 객체 키는 반환하지 않음.
async function computeR2Usage(): Promise<R2Usage> {
  const s3 = createR2Client();
  const bucketName = getEnv("R2_BUCKET_NAME");

  let usedBytes = 0;
  let objectCount = 0;
  let continuationToken: string | undefined;

  do {
    const result = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucketName,
        ContinuationToken: continuationToken,
        MaxKeys: 1000,
      })
    );

    for (const object of result.Contents ?? []) {
      usedBytes += object.Size ?? 0;
      objectCount += 1;
    }

    continuationToken = result.IsTruncated ? result.NextContinuationToken : undefined;
  } while (continuationToken);

  return { usedBytes, objectCount, fetchedAt: Date.now() };
}

const getCachedR2Usage = unstable_cache(computeR2Usage, ["r2-usage"], {
  revalidate: R2_CACHE_SECONDS,
  tags: [R2_USAGE_TAG],
});

export async function getR2Usage({ refresh = false } = {}): Promise<R2Usage> {
  const cached = await getCachedR2Usage();

  if (!refresh || Date.now() - cached.fetchedAt < R2_REFRESH_MIN_INTERVAL_MS) {
    return cached;
  }

  // expire: 0 — stale 값을 돌려주지 않고 다음 호출에서 바로 다시 계산하게 함
  revalidateTag(R2_USAGE_TAG, { expire: 0 });
  return getCachedR2Usage();
}

export async function getDbUsage(): Promise<DbUsage> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc("get_database_size");

  if (error) {
    throw error;
  }

  const usedBytes = Number(data);

  if (!Number.isFinite(usedBytes)) {
    throw new Error("get_database_size returned a non-numeric value");
  }

  return { usedBytes, fetchedAt: Date.now() };
}
