import { createClient } from "@supabase/supabase-js";

export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    const error = new Error("Supabase環境変数が未設定です");
    error.status = 500;
    throw error;
  }

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function assertAiAdmin(request) {
  const expected = process.env.BSC_AI_ADMIN_KEY;
  const received = request.headers.get("x-bsc-ai-key");

  if (!expected) {
    const error = new Error("BSC_AI_ADMIN_KEYが未設定です");
    error.status = 500;
    throw error;
  }

  if (!received || received !== expected) {
    const error = new Error("認証に失敗しました");
    error.status = 401;
    throw error;
  }
}
