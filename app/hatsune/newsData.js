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
  win: "🏆 優勝・優出",
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

const HATSUNE_NEWS_IMAGES = {
  news: "/images/hatsune-news/hatsune-news-v1.webp",
  race: "/images/hatsune-news/hatsune-race-v1.webp",
  racer: "/images/hatsune-news/hatsune-racer-v1.webp",
  data: "/images/hatsune-news/hatsune-data-v1.webp",
  tomorrow: "/images/hatsune-news/hatsune-tomorrow-v1.webp",
};

export function normalizeHatsuneNewsCategory(value) {
  const key = String(value || "all");
  if (HATSUNE_NEWS_CATEGORIES.some((item) => item.key === key)) return key;
  return LEGACY_CATEGORY_TO_TAB[key] || "all";
}

export function getHatsuneNewsImage(item) {
  if (item?.image_url) return item.image_url;

  const category = String(item?.category || "").toLowerCase();
  const sourceType = String(item?.source_type || "").toLowerCase();
  const text = `${item?.title || ""} ${item?.summary || ""}`;

  if (category === "tomorrow" || /(明日|翌日|あす)/.test(text)) {
    return HATSUNE_NEWS_IMAGES.tomorrow;
  }

  if (
    sourceType === "bs_data" ||
    category === "motor" ||
    /(モーター|機力|2連対率|展示|データ|勝率)/.test(text)
  ) {
    return HATSUNE_NEWS_IMAGES.data;
  }

  if (
    ["suijinsai", "grade"].includes(category) ||
    /(水神祭|昇格|レーサー|選手|A1|A2|B1|B2)/.test(text)
  ) {
    return HATSUNE_NEWS_IMAGES.racer;
  }

  if (
    ["result", "women", "win"].includes(category) ||
    /(開幕|優勝戦|準優|レース|シリーズ|結果)/.test(text)
  ) {
    return HATSUNE_NEWS_IMAGES.race;
  }

  return HATSUNE_NEWS_IMAGES.news;
}

const HATSUNE_NEWS_SELECT = `
  id,
  title,
  summary,
  article_body,
  category,
  source_type,
  source_name,
  source_url,
  image_url,
  place,
  published_at,
  is_featured,
  priority
`;

export async function getHatsuneNews({ limit = 20, category = "all" } = {}) {
  if (!supabase) return [];

  try {
    const normalizedCategory = normalizeHatsuneNewsCategory(category);
    let query = supabase
      .from("hatsune_news")
      .select(HATSUNE_NEWS_SELECT)
      .eq("is_published", true)
      .order("published_at", { ascending: false, nullsFirst: false })
      .order("is_featured", { ascending: false })
      .order("priority", { ascending: false })
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
      console.warn("初音NEWS取得:", error.message);
      return [];
    }

    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.warn("初音NEWS取得:", error?.message || error);
    return [];
  }
}

export async function getHatsuneNewsById(id) {
  if (!supabase || !id) return null;

  try {
    const { data, error } = await supabase
      .from("hatsune_news")
      .select(HATSUNE_NEWS_SELECT)
      .eq("id", id)
      .eq("is_published", true)
      .maybeSingle();

    if (error) {
      console.warn("初音NEWS詳細取得:", error.message);
      return null;
    }

    return data || null;
  } catch (error) {
    console.warn("初音NEWS詳細取得:", error?.message || error);
    return null;
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
