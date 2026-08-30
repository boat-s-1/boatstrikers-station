import { createClient } from "@supabase/supabase-js";
import { generateMediaEditorial } from "./mediaEditorialAi";
import { saveMediaEditorial } from "./mediaEditorialData";

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function generateMissingMediaEditorials({ limit = 3, scanLimit = 24 } = {}) {
  const client = getClient();
  if (!client) throw new Error("Supabase接続情報がありません。");
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY が未設定です。");

  const { data: videos, error: videoError } = await client
    .from("bs_media_videos")
    .select("video_id,place_code,place_name,title,video_url,published_at,women_related,official_description")
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(Math.min(Math.max(Number(scanLimit) || 24, 1), 100));

  if (videoError) throw videoError;
  if (!videos?.length) return { scanned: 0, missing: 0, processed: 0, generated: 0, errors: [] };

  const ids = videos.map((row) => row.video_id).filter(Boolean);
  const { data: existing, error: editorialError } = await client
    .from("media_editorials")
    .select("video_id")
    .in("video_id", ids);

  if (editorialError) throw editorialError;

  const existingIds = new Set((existing || []).map((row) => row.video_id));
  const missing = videos.filter((row) => !existingIds.has(row.video_id));
  const targets = missing.slice(0, Math.min(Math.max(Number(limit) || 3, 1), 6));
  const results = [];

  for (const row of targets) {
    const item = {
      videoId: row.video_id,
      place: row.place_name,
      placeCode: row.place_code,
      title: row.title || "公式YouTube更新",
      url: row.video_url,
      publishedAt: row.published_at,
      womenRelated: Boolean(row.women_related),
      description: row.official_description || "",
    };

    try {
      const editorial = await generateMediaEditorial(item);
      await saveMediaEditorial(item, editorial);
      results.push({ videoId: item.videoId, place: item.place, generated: true });
    } catch (error) {
      results.push({ videoId: item.videoId, place: item.place, generated: false, error: error?.message || String(error) });
    }
  }

  return {
    scanned: videos.length,
    missing: missing.length,
    processed: targets.length,
    generated: results.filter((x) => x.generated).length,
    errors: results.filter((x) => !x.generated),
    results,
  };
}
