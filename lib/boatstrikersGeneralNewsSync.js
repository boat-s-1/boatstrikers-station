import { createClient } from "@supabase/supabase-js";

const SOURCES = [
  { key: "nikkan", name: "日刊スポーツ", listUrl: "https://www.nikkansports.com/public_race/boat/news/", baseUrl: "https://www.nikkansports.com" },
  { key: "macour", name: "マクール", listUrl: "https://sp.macour.jp/news/", baseUrl: "https://sp.macour.jp" },
  { key: "boatrace", name: "BOAT RACE オフィシャルウェブサイト", listUrl: "https://www.boatrace.jp/owpc/pc/site/news/", baseUrl: "https://www.boatrace.jp" },
];

const WOMEN_RE = /女子|女子戦|女子レーサー|女子選手|女子ボート|レディース|オールレディース|ヴィーナス|クイーンズ|女王|レディースチャンピオン|レディースオールスター/;
const GRADE_RE = /(^|[^A-Z0-9])SG([^A-Z0-9]|$)|(^|[^A-Z0-9])G[123]([^A-Z0-9]|$)|GI|GⅠ|GⅡ|GⅢ|グランプリ|周年記念|ボートレースメモリアル|ダービー|チャレンジカップ|オールスター|グランドチャンピオン|クラシック|オーシャンカップ|ヤングダービー|マスターズチャンピオン|クイーンズクライマックス/;
const RESULT_RE = /結果|払戻|着順|優勝|優出|高配当|万舟|決まり手|V達成|初優勝|制覇/;
const RACER_RE = /デビュー|初勝利|復帰|欠場|引退|登録|昇格|降格|A1|A2|B1|B2|級別|記録|連勝|勝率|近況|前検|コメント|インタビュー|選手|レーサー|予選1位|予選トップ/;
const FOCUS_RE = /注目|モーター|機力|展示|前検|初日|優勝戦|準優|ドリーム|得点率|予選/;
const FETCH_TIMEOUT_MS = 3500;
const MAX_LINKS_PER_SOURCE = 24;
const MAX_INSERT_PER_RUN = 16;

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase管理用環境変数が未設定です。");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function normalizeSpace(value) {
  return String(value || "").replace(/[\s\u3000]+/g, " ").trim();
}

function stripHtml(value) {
  return normalizeSpace(String(value || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">"));
}

function absoluteUrl(href, baseUrl) {
  try {
    return new URL(String(href || "").replace(/&amp;/g, "&"), baseUrl).toString();
  } catch {
    return null;
  }
}

async function fetchHtml(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; BoatStrikers/1.0; +https://www.boat-strike.online/)",
      "Accept-Language": "ja,en-US;q=0.8,en;q=0.6",
      Accept: "text/html,application/xhtml+xml",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`${response.status}`);
  return response.text();
}

function metaContent(html, key) {
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${key}["']`, "i"),
  ];
  for (const re of patterns) {
    const match = String(html || "").match(re);
    if (match?.[1]) return stripHtml(match[1]);
  }
  return "";
}

function extractArticleSummary(html) {
  const candidates = [
    metaContent(html, "og:description"),
    metaContent(html, "description"),
    metaContent(html, "twitter:description"),
  ].map(normalizeSpace).filter(Boolean);
  const value = candidates.find((text) => text.length >= 40) || "";
  if (!value) return "";
  return value.length > 420 ? `${value.slice(0, 417)}…` : value;
}

function validArticleUrl(source, url) {
  if (source.key === "nikkan") return /nikkansports\.com\/public_race\/news\/20\d{6,}/.test(url);
  if (source.key === "macour") return /sp\.macour\.jp\/news\//.test(url) && url !== source.listUrl && !/[?&](?:category|tag)=/i.test(url);
  if (source.key === "boatrace") return /boatrace\.jp\/owpc\/pc\/site\/news\/20\d{2}\/\d{2}\/\d+\/?/.test(url);
  return false;
}

function classifyTitle(title) {
  const value = normalizeSpace(title);
  if (GRADE_RE.test(value)) return "grade";
  if (RESULT_RE.test(value)) return "result";
  if (RACER_RE.test(value) || FOCUS_RE.test(value)) return "topic";
  return null;
}

function priorityFor(title, category) {
  if (category === "grade") return 80;
  if (category === "result") return 65;
  if (RACER_RE.test(title)) return 55;
  return 45;
}

function extractCandidates(html, source) {
  const rows = [];
  const seen = new Set();
  const anchorRegex = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = anchorRegex.exec(html))) {
    const url = absoluteUrl(match[1], source.baseUrl);
    const label = stripHtml(match[2]);
    if (!url || !label || label.length < 8 || seen.has(url) || !validArticleUrl(source, url)) continue;
    seen.add(url);

    const category = classifyTitle(label);
    if (!category) continue;
    if (WOMEN_RE.test(label)) continue;

    rows.push({
      title: label,
      summary: "",
      category,
      source_type: source.key === "boatrace" ? "official" : "news",
      source_name: source.name,
      source_url: url,
      source_key: `general:${source.key}:${url}`,
      image_url: null,
      place: null,
      published_at: new Date().toISOString(),
      is_featured: category === "grade",
      priority: priorityFor(label, category),
      collected_at: new Date().toISOString(),
      is_published: true,
    });

    if (rows.length >= MAX_LINKS_PER_SOURCE) break;
  }

  return rows;
}

async function enrichCandidate(item) {
  try {
    const html = await fetchHtml(item.source_url);
    const summary = extractArticleSummary(html);
    return summary ? { ...item, summary } : item;
  } catch {
    return item;
  }
}

async function repairExistingGeneralRows(supabase) {
  const { data, error } = await supabase
    .from("hatsune_news")
    .select("id,title,category,source_key,is_featured,priority,summary,article_body_source")
    .like("source_key", "general:%")
    .eq("is_published", true)
    .order("published_at", { ascending: false })
    .limit(250);
  if (error) throw error;

  let repaired = 0;
  for (const row of data || []) {
    const category = classifyTitle(row.title);
    if (!category) continue;
    const isFeatured = category === "grade";
    const priority = priorityFor(row.title, category);
    const genericSummary = /公開されたボートレース関連ニュースです|元記事を転載せず/.test(String(row.summary || ""));
    const legacyManual = row.article_body_source === "manual";
    const patch = {};
    if (row.category !== category) patch.category = category;
    if (Boolean(row.is_featured) !== isFeatured) patch.is_featured = isFeatured;
    if (Number(row.priority || 0) !== priority) patch.priority = priority;
    if (genericSummary) patch.summary = "";
    if (legacyManual) {
      patch.article_body = null;
      patch.article_body_source = null;
    }
    if (!Object.keys(patch).length) continue;

    const { error: updateError } = await supabase.from("hatsune_news").update(patch).eq("id", row.id);
    if (!updateError) repaired += 1;
  }
  return repaired;
}

export async function syncBoatstrikersGeneralNews() {
  const supabase = getAdminSupabase();
  let repaired = 0;
  try {
    repaired = await repairExistingGeneralRows(supabase);
  } catch (error) {
    console.warn("general news repair skipped", error?.message || error);
  }

  const settled = await Promise.allSettled(SOURCES.map(async (source) => {
    const html = await fetchHtml(source.listUrl);
    return { source: source.key, rows: extractCandidates(html, source) };
  }));

  const candidates = [];
  const errors = [];
  const stats = {};

  for (let i = 0; i < settled.length; i += 1) {
    const source = SOURCES[i];
    const result = settled[i];
    if (result.status === "fulfilled") {
      const rows = result.value.rows || [];
      candidates.push(...rows);
      stats[source.key] = { found: rows.length };
    } else {
      const message = result.reason?.message || String(result.reason);
      errors.push(`${source.key}: ${message}`);
      stats[source.key] = { found: 0, error: message };
    }
  }

  const unique = [];
  const seenTitles = new Set();
  for (const item of candidates) {
    const titleKey = normalizeSpace(item.title);
    if (seenTitles.has(titleKey)) continue;
    seenTitles.add(titleKey);
    unique.push(item);
    if (unique.length >= MAX_INSERT_PER_RUN) break;
  }

  if (!unique.length) return { found: 0, inserted: 0, skipped: 0, repaired, errors, stats };

  const keys = unique.map((x) => x.source_key);
  const titles = unique.map((x) => x.title);
  const [{ data: byKey, error: keyError }, { data: byTitle, error: titleError }] = await Promise.all([
    supabase.from("hatsune_news").select("source_key").in("source_key", keys),
    supabase.from("hatsune_news").select("title").in("title", titles),
  ]);
  if (keyError) throw keyError;
  if (titleError) throw titleError;

  const existingKeys = new Set((byKey || []).map((x) => x.source_key));
  const existingTitles = new Set((byTitle || []).map((x) => normalizeSpace(x.title)));
  const fresh = unique.filter((x) => !existingKeys.has(x.source_key) && !existingTitles.has(normalizeSpace(x.title)));

  if (!fresh.length) return { found: unique.length, inserted: 0, skipped: unique.length, repaired, errors, stats };

  const enriched = await Promise.all(fresh.map(enrichCandidate));
  const { data, error } = await supabase
    .from("hatsune_news")
    .insert(enriched)
    .select("id,title,category,source_name,source_key");
  if (error) throw error;

  return {
    found: unique.length,
    inserted: data?.length || 0,
    skipped: unique.length - (data?.length || 0),
    repaired,
    errors,
    stats,
    rows: data || [],
  };
}
