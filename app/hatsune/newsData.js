import { supabase } from "../bsc2/lib/supabaseClient";

export const HATSUNE_NEWS_CATEGORIES = [
  { key: "all", label: "すべて" },
  { key: "race", label: "レース" },
  { key: "racer", label: "レーサー" },
  { key: "data", label: "データ" },
  { key: "tomorrow", label: "明日の注目" },
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

const LEGACY_CATEGORY_TO_TAB = {
  result: "race",
  women: "race",
  win: "race",
  suijinsai: "racer",
  grade: "racer",
  motor: "data",
  tomorrow: "tomorrow",
};

export function normalizeHatsuneNewsCategory(value) {
  const key = String(value || "all");
  if (HATSUNE_NEWS_CATEGORIES.some((item) => item.key === key)) return key;
  return LEGACY_CATEGORY_TO_TAB[key] || "all";
}

export async function getHatsuneNews({ limit = 20, category = "all" } = {}) {
  if (!supabase) return [];

  try {
    const normalizedCategory = normalizeHatsuneNewsCategory(category);
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

    if (normalizedCategory === "race") {
      query = query.in("category", ["result", "women", "win"]);
    } else if (normalizedCategory === "racer") {
      query = query.in("category", ["suijinsai", "grade"]);
    } else if (normalizedCategory === "data") {
      query = query.or("category.eq.motor,source_type.eq.bs_data");
    } else if (normalizedCategory === "tomorrow") {
      query = query.eq("category", "tomorrow");
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
