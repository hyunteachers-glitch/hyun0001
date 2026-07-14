import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function getEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const password = body?.password;

    if (typeof password !== "string" || !password) {
      return NextResponse.json({ valid: false }, { status: 400 });
    }

    const supabaseUrl = getEnv("NEXT_PUBLIC_SUPABASE_URL");
    const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { data, error } = await supabaseAdmin
      .from("site_password")
      .select("password")
      .eq("id", 1)
      .single();

    if (error || !data) {
      console.error("check-password error:", error);
      return NextResponse.json({ valid: false }, { status: 500 });
    }

    return NextResponse.json({ valid: password === data.password });
  } catch (error) {
    console.error("check-password error:", error);
    return NextResponse.json({ valid: false }, { status: 500 });
  }
}
