import { createClient } from "@supabase/supabase-js";

export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase環境変数が未設定です");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function assertAdmin(request) {
  const expected = process.env.BSC_AI_ADMIN_KEY;
  const received = request.headers.get("x-bsc-ai-key");
  if (!expected) throw new Error("BSC_AI_ADMIN_KEYが未設定です");
  if (!received || received !== expected) {
    const error = new Error("認証に失敗しました");
    error.status = 401;
    throw error;
  }
}
