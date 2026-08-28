import { createClient } from "@supabase/supabase-js";
import { collectHatsuneMediaNews } from "./hatsuneMediaNewsCollector";

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase管理用環境変数が未設定です。");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function syncHatsuneMediaNews() {
  const supabase = getAdminSupabase();
  const collected = await collectHatsuneMediaNews();
  const candidates = collected.candidates || [];
  if (!candidates.length) {
    return { found: 0, inserted: 0, skipped: 0, errors: collected.errors || [] };
  }

  const keys = candidates.map((x) => x.source_key).filter(Boolean);
  const { data: existing, error: existingError } = await supabase
    .from("hatsune_news")
    .select("source_key")
    .in("source_key", keys);
  if (existingError) throw existingError;

  const existingKeys = new Set((existing || []).map((x) => x.source_key));
  const fresh = candidates.filter((x) => !existingKeys.has(x.source_key));
  if (!fresh.length) {
    return { found: candidates.length, inserted: 0, skipped: candidates.length, errors: collected.errors || [] };
  }

  const payload = fresh.map((item) => ({
    ...item,
    article_body: null,
    article_body_source: "template",
    collected_at: new Date().toISOString(),
    is_published: true,
  }));

  const { data, error } = await supabase
    .from("hatsune_news")
    .insert(payload)
    .select("id,title,source_key,source_name");
  if (error) throw error;

  return {
    found: candidates.length,
    inserted: data?.length || 0,
    skipped: candidates.length - (data?.length || 0),
    errors: collected.errors || [],
    rows: data || [],
  };
}
