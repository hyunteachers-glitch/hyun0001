import type { User } from "@supabase/supabase-js";
import { ADMIN_EMAIL } from "@/lib/constants";
import { createAnonServerClient } from "@/lib/supabase/server";

export async function requireAdmin(request: Request): Promise<User | null> {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (!token) {
    return null;
  }

  const supabaseAuth = createAnonServerClient();
  const { data, error } = await supabaseAuth.auth.getUser(token);

  if (error || !data?.user) {
    return null;
  }

  if (data.user.email?.toLowerCase() !== ADMIN_EMAIL) {
    return null;
  }

  return data.user;
}
