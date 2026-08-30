import { createClient } from "@supabase/supabase-js";

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function getMediaEditorial(videoId) {
  const client = getClient();
  if (!client || !videoId) return null;
  const { data } = await client
    .from("media_editorials")
    .select("video_id,place,official_title,official_url,short_headline,intro,highlights,editor_note,model,generated_at")
    .eq("video_id", videoId)
    .maybeSingle();
  return data || null;
}

export async function getMediaEditorialMap(videoIds) {
  const ids = Array.from(new Set((videoIds || []).filter(Boolean)));
  if (!ids.length) return {};
  const client = getClient();
  if (!client) return {};
  const { data } = await client
    .from("media_editorials")
    .select("video_id,short_headline,intro,highlights,editor_note,model,generated_at")
    .in("video_id", ids);
  return Object.fromEntries((data || []).map((row) => [row.video_id, row]));
}

export async function saveMediaEditorial(item, editorial) {
  const client = getClient();
  if (!client) throw new Error("Supabase接続情報がありません。");
  const payload = {
    video_id: item.videoId,
    place: item.place,
    official_title: item.title,
    official_url: item.url,
    short_headline: editorial.short_headline,
    intro: editorial.intro,
    highlights: editorial.highlights,
    editor_note: editorial.editor_note,
    model: editorial.model,
    generated_at: editorial.generated_at,
    updated_at: new Date().toISOString(),
  };
  const { error } = await client.from("media_editorials").upsert(payload, { onConflict: "video_id" });
  if (error) throw error;
}
