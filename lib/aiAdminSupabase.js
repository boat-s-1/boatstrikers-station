import { createClient } from "@supabase/supabase-js";

export function getAiAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL または SUPABASE_SERVICE_ROLE_KEY が未設定です"
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function assertAiAdminRequest(request) {
  const expected = process.env.BSC_AI_ADMIN_KEY;
  const received = request.headers.get("x-bsc-ai-key");

  if (!expected) {
    const error = new Error("BSC_AI_ADMIN_KEY が未設定です");
    error.status = 500;
    throw error;
  }

  if (!received || received !== expected) {
    const error = new Error("認証に失敗しました");
    error.status = 401;
    throw error;
  }
}
