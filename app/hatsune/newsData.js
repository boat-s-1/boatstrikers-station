import { supabase } from "../bsc2/lib/supabaseClient";

export const HATSUNE_NEWS_CATEGORIES = [
  { key: "all", label: "すべて" },
  { key: "result", label: "今日の結果" },
  { key: "women", label: "女子戦" },
  { key: "suijinsai", label: "水神祭" },
  { key: "win", label: "優勝" },
  { key: "grade", label: "昇格" },
  { key: "motor", label: "モーター" },
  { key: "tomorrow", label: "明日" },
];

export const HATSUNE_NEWS_LABELS = {
  result: "🏁 結果",
  women: "🌸 女子戦",
  suijinsai: "💧 水神祭",
  win: "🏆 優勝",
  grade: "⬆️ 昇格",
  motor: "⚙️ モーター",
  tomorrow: "📅 明日",
  topic: "🔥 注目",
};

export async function getHatsuneNews({ limit = 20, category = "all" } = {}) {
  if (!supabase) return [];

  try {
    let query = supabase
      .from("hatsune_news")
      .select(`
        id,
        title,
        summary,
        category,
        source_type,
        source_name,
        source_url,
        image_url,
        place,
        published_at,
        is_featured,
        priority
      `)
      .eq("is_published", true)
      .order("is_featured", { ascending: false })
      .order("priority", { ascending: false })
      .order("published_at", { ascending: false })
      .limit(limit);

    if (category && category !== "all") {
      query = query.eq("category", category);
    }

    const { data, error } = await query;

    if (error) {
      // テーブル作成前でも初音ページ自体は壊さない。
      console.warn("初音NEWS取得:", error.message);
      return [];
    }

    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.warn("初音NEWS取得:", error?.message || error);
    return [];
  }
}

export function formatHatsuneNewsDate(value) {
  if (!value) return "";

  try {
    return new Intl.DateTimeFormat("ja-JP", {
      timeZone: "Asia/Tokyo",
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return "";
  }
}
