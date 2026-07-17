import { createClient } from "@supabase/supabase-js";

export function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export function assertAiAdmin(request) {
  const key = request.headers.get("x-bsc-ai-key");

  if (key !== process.env.BSC_AI_ADMIN_KEY) {
    throw new Error("Unauthorized");
  }
}
