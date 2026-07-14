import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const ADMIN_EMAIL = "hyunteachers@gmail.com";

function getEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();

    if (!token) {
      return NextResponse.json({ error: "로그인이 필요해." }, { status: 401 });
    }

    const supabaseUrl = getEnv("NEXT_PUBLIC_SUPABASE_URL");
    const anonKey = getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");

    const supabaseAuth = createClient(supabaseUrl, anonKey);
    const { data: userData, error: userError } = await supabaseAuth.auth.getUser(token);

    if (userError || !userData?.user) {
      return NextResponse.json({ error: "로그인이 필요해." }, { status: 401 });
    }

    if (userData.user.email?.toLowerCase() !== ADMIN_EMAIL) {
      return NextResponse.json({ error: "권한이 없어." }, { status: 403 });
    }

    const body = await request.json();
    const newPassword = body?.newPassword;

    if (typeof newPassword !== "string" || !newPassword.trim()) {
      return NextResponse.json({ error: "새 비밀번호를 입력해줘." }, { status: 400 });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { error } = await supabaseAdmin
      .from("site_password")
      .update({
        password: newPassword,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);

    if (error) {
      console.error("update-password error:", error);
      return NextResponse.json(
        { error: "비밀번호 변경 중 오류가 발생했어." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("update-password error:", error);
    return NextResponse.json(
      { error: "비밀번호 변경 중 오류가 발생했어." },
      { status: 500 }
    );
  }
}
