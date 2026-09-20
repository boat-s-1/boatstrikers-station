import { createClient } from "@supabase/supabase-js";

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function getPublishedNewspapers({ character, date, course, raceNo, limit = 60 } = {}) {
  const supabase = client();
  if (!supabase) return [];
  let query = supabase.from("bs_newspaper_publications").select("id,slug,race_date,course_name,race_no,character_key,edition,title,summary,image_url,note_url,published_at").eq("status", "published").order("race_date", { ascending: false }).order("published_at", { ascending: false }).limit(limit);
  if (character) query = query.eq("character_key", character);
  if (date) query = query.eq("race_date", date);
  if (course) query = query.eq("course_name", course);
  if (raceNo) query = query.eq("race_no", Number(raceNo));
  const { data, error } = await query;
  if (error) { console.error("新聞一覧取得エラー:", error.message); return []; }
  return data || [];
}

export async function getPublishedNewspaper(slug) {
  const supabase = client();
  if (!supabase) return null;
  const { data, error } = await supabase.from("bs_newspaper_publications").select("*").eq("slug", slug).eq("status", "published").maybeSingle();
  if (error) { console.error("新聞詳細取得エラー:", error.message); return null; }
  return data || null;
}
