import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getDbUsage, getR2Usage } from "@/lib/storageUsage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const admin = await requireAdmin(request);

  if (!admin) {
    return NextResponse.json(
      { error: "로그인한 관리자만 볼 수 있어." },
      { status: 401 }
    );
  }

  const refresh = new URL(request.url).searchParams.get("refresh") === "1";

  // 한쪽이 실패해도 다른 쪽은 그대로 응답. 에러 상세(엔드포인트 등)는 서버 로그에만 남김.
  const [r2Result, dbResult] = await Promise.allSettled([
    getR2Usage({ refresh }),
    getDbUsage(),
  ]);

  if (r2Result.status === "rejected") {
    console.error("R2 usage error:", r2Result.reason);
  }

  if (dbResult.status === "rejected") {
    console.error("DB usage error:", dbResult.reason);
  }

  return NextResponse.json(
    {
      r2: r2Result.status === "fulfilled" ? { ok: true, ...r2Result.value } : { ok: false },
      db: dbResult.status === "fulfilled" ? { ok: true, ...dbResult.value } : { ok: false },
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
