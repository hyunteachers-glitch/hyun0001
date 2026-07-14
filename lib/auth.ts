import { createClient, type User } from "@supabase/supabase-js";

const ADMIN_EMAIL = "hyunteachers@gmail.com";

function getEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

export async function requireAdmin(request: Request): Promise<User | null> {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (!token) {
    return null;
  }

  const supabaseUrl = getEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  const supabaseAuth = createClient(supabaseUrl, anonKey);
  const { data, error } = await supabaseAuth.auth.getUser(token);

  if (error || !data?.user) {
    return null;
  }

  if (data.user.email?.toLowerCase() !== ADMIN_EMAIL) {
    return null;
  }

  return data.user;
}
