import { createClient } from "@supabase/supabase-js";
import { collectHatsuneMediaNews } from "./hatsuneMediaNewsCollector";

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase管理用環境変数が未設定です。");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function repairReviewedMediaRows(supabase, reviewed = []) {
  const valid = reviewed.filter((row) => row.women_related && row.source_key);
  const invalid = reviewed.filter((row) => !row.women_related && row.source_key);

  for (const row of valid) {
    await supabase
      .from("hatsune_news")
      .update({
        category: row.category || "women",
        title: row.title || undefined,
      })
      .eq("source_key", row.source_key)
      .eq("source_type", "news");
  }

  if (invalid.length) {
    const invalidKeys = invalid.map((row) => row.source_key);
    await supabase
      .from("hatsune_news")
      .update({ is_published: false })
      .in("source_key", invalidKeys)
      .eq("source_type", "news");
  }

  return { repaired: valid.length, unpublished: invalid.length };
}

export async function syncHatsuneMediaNews() {
  const supabase = getAdminSupabase();
  const collected = await collectHatsuneMediaNews();
  const candidates = collected.candidates || [];
  const repair = await repairReviewedMediaRows(supabase, collected.reviewed || []);
  const stats = collected.stats || {};

  if (!candidates.length) {
    return {
      found: 0,
      inserted: 0,
      skipped: 0,
      repaired: repair.repaired,
      unpublished: repair.unpublished,
      errors: collected.errors || [],
      stats,
    };
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
    return {
      found: candidates.length,
      inserted: 0,
      skipped: candidates.length,
      repaired: repair.repaired,
      unpublished: repair.unpublished,
      errors: collected.errors || [],
      stats,
    };
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
    repaired: repair.repaired,
    unpublished: repair.unpublished,
    errors: collected.errors || [],
    stats,
    rows: data || [],
  };
}
