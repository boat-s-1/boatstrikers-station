const SOURCES = [
  {
    key: "nikkan",
    name: "日刊スポーツ",
    listUrl: "https://www.nikkansports.com/public_race/boat/news/",
    baseUrl: "https://www.nikkansports.com",
  },
  {
    key: "macour",
    name: "マクール",
    listUrl: "https://sp.macour.jp/news/",
    baseUrl: "https://sp.macour.jp",
  },
];

const WOMEN_SIGNALS = [
  "女子", "女子戦", "女子レーサー", "女子選手", "女子ボート", "レディース",
  "オールレディース", "ヴィーナス", "クイーンズ", "女王",
  "レディースチャンピオン", "レディースオールスター", "レディースvsルーキーズ",
];

// タイトルに「女子」と書かれない選手単独記事の取りこぼしを減らす補助辞書。
// イベント名・本文判定が主で、ここはあくまで補助として使う。
const WOMEN_RACER_SIGNALS = [
  "遠藤エミ", "守屋美穂", "大山千広", "平高奈菜", "寺田千恵", "田口節子",
  "長嶋万記", "細川裕子", "浜田亜理沙", "三浦永理", "倉持莉々", "清水愛海",
  "川野芽唯", "渡邉優美", "西橋奈未", "小野生奈", "藤原菜希", "宇野弥生",
  "堀之内紀代子", "武井莉里佳", "岩崎芳美", "海野ゆかり", "香川素子",
  "日高逸子", "實森美祐", "刑部亜里紗", "勝浦真帆", "高憧四季",
];

const ARTICLE_TIMEOUT_MS = 6000;
const MAX_LINKS_PER_SOURCE = 30;
const MAX_CANDIDATES_PER_SOURCE = 8;
const MAX_ARTICLE_AGE_HOURS = 96;

function normalizeSpace(value) {
  return String(value || "").replace(/[\s\u3000]+/g, " ").trim();
}

function compactName(value) {
  return normalizeSpace(value).replace(/[\s\u3000・]/g, "");
}

function stripHtml(value) {
  return normalizeSpace(String(value || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<aside[\s\S]*?<\/aside>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
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

function hasWomenSignal(text) {
  const value = normalizeSpace(text);
  if (WOMEN_SIGNALS.some((keyword) => value.includes(keyword))) return true;
  const compact = compactName(value);
  return WOMEN_RACER_SIGNALS.some((name) => compact.includes(compactName(name)));
}

function extractMetaDescription(html) {
  const og = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i);
  if (og?.[1]) return stripHtml(og[1]);
  const description = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
  return stripHtml(description?.[1] || "");
}

function extractArticleText(html) {
  const article = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i);
  if (article?.[1]) return stripHtml(article[1]).slice(0, 6000);
  const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
  if (main?.[1]) return stripHtml(main[1]).slice(0, 6000);
  return stripHtml(html).slice(0, 4500);
}

function isWomenRelatedArticle({ title, description, articleText }) {
  const lead = String(articleText || "").slice(0, 2200);
  return hasWomenSignal(`${title || ""} ${description || ""} ${lead}`);
}

function categoryFromArticle({ title, description, articleText }) {
  const headline = normalizeSpace(title);
  const lead = normalizeSpace(`${description || ""} ${String(articleText || "").slice(0, 1800)}`);

  if (headline.includes("水神祭")) return "suijinsai";
  if (/優勝|優出|V\b|Ｖ/.test(headline)) return "win";
  if (/A1|A2|B1|B2|昇格|級別/.test(headline)) return "grade";
  if (/モーター|エンジン|機力|足/.test(headline)) return "motor";

  if (lead.includes("水神祭")) return "suijinsai";
  if (/優勝した|優勝を飾|初優勝|優出を決め|優勝戦進出/.test(lead)) return "win";
  if (/A1|A2|B1|B2|昇格|級別/.test(lead)) return "grade";
  if (/モーター|エンジン|機力/.test(lead)) return "motor";
  return "women";
}

function parsePublishedAt(html) {
  const patterns = [
    /(?:article:published_time|datePublished)["'][^>]*content=["']([^"']+)/i,
    /content=["']([^"']+)["'][^>]*(?:article:published_time|datePublished)/i,
    /"datePublished"\s*:\s*"([^"]+)"/i,
    /(20\d{2})[\/-](\d{1,2})[\/-](\d{1,2})[^0-9]{0,12}(\d{1,2}):(\d{2})/,
    /(20\d{2})[\/-](\d{1,2})[\/-](\d{1,2})/,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (!match) continue;
    if (match[1] && match.length <= 2) {
      const date = new Date(match[1]);
      if (!Number.isNaN(date.getTime())) return date.toISOString();
    }
    if (match[1] && match[2] && match[3]) {
      const hour = match[4] || "12";
      const minute = match[5] || "00";
      const date = new Date(`${match[1]}-${String(match[2]).padStart(2, "0")}-${String(match[3]).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${minute}:00+09:00`);
      if (!Number.isNaN(date.getTime())) return date.toISOString();
    }
  }
  return new Date().toISOString();
}

function extractTitle(html, fallback = "") {
  const og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);
  if (og?.[1]) return stripHtml(og[1]).replace(/\s*[-｜|]\s*(日刊スポーツ|マクール|BOAT RACE).*$/u, "").trim();
  const h1 = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1?.[1]) return stripHtml(h1[1]);
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return stripHtml(title?.[1] || fallback).replace(/\s*[-｜|]\s*(日刊スポーツ|マクール|BOAT RACE).*$/u, "").trim();
}

function isRecent(iso) {
  const time = new Date(iso || 0).getTime();
  if (!Number.isFinite(time) || !time) return true;
  const ageHours = (Date.now() - time) / 3600000;
  return ageHours <= MAX_ARTICLE_AGE_HOURS && ageHours > -24;
}

async function fetchHtml(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; BoatStrikers/1.0; +https://www.boat-strike.online/)",
      "Accept-Language": "ja,en-US;q=0.8,en;q=0.6",
      Accept: "text/html,application/xhtml+xml",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(ARTICLE_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`${response.status}`);
  return response.text();
}

function extractArticleLinks(html, source) {
  const links = [];
  const seen = new Set();
  const anchorRegex = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = anchorRegex.exec(html))) {
    const url = absoluteUrl(match[1], source.baseUrl);
    const label = stripHtml(match[2]);
    if (!url || !label || seen.has(url)) continue;

    let valid = false;
    if (source.key === "nikkan") valid = /nikkansports\.com\/public_race\/news\/20\d{6,}/.test(url);
    if (source.key === "macour") valid = /sp\.macour\.jp\/news\//.test(url) && url !== source.listUrl;
    if (!valid) continue;

    seen.add(url);
    links.push({ url, label });
    if (links.length >= MAX_LINKS_PER_SOURCE) break;
  }
  return links;
}

export async function inspectHatsuneMediaArticle(url, sourceName = "") {
  const html = await fetchHtml(url);
  const title = extractTitle(html);
  const description = extractMetaDescription(html);
  const articleText = extractArticleText(html);
  const womenRelated = Boolean(title) && isWomenRelatedArticle({ title, description, articleText });

  return {
    title,
    description,
    articleText,
    womenRelated,
    category: womenRelated ? categoryFromArticle({ title, description, articleText }) : null,
    published_at: parsePublishedAt(html),
    source_name: sourceName,
  };
}

async function collectSource(source) {
  const listHtml = await fetchHtml(source.listUrl);
  const links = extractArticleLinks(listHtml, source);

  const settled = await Promise.allSettled(
    links.map(async (link) => {
      const inspected = await inspectHatsuneMediaArticle(link.url, source.name);
      const sourceKey = `media:${source.key}:${link.url}`;
      return { link, inspected, sourceKey };
    }),
  );

  const reviewed = [];
  const candidates = [];
  const errors = [];

  for (const result of settled) {
    if (result.status !== "fulfilled") {
      errors.push(result.reason?.message || String(result.reason));
      continue;
    }
    const { link, inspected, sourceKey } = result.value;

    reviewed.push({
      source_key: sourceKey,
      source_name: source.name,
      source_url: link.url,
      title: inspected.title || link.label,
      women_related: inspected.womenRelated,
      category: inspected.category,
    });

    if (!inspected.womenRelated || !isRecent(inspected.published_at) || candidates.length >= MAX_CANDIDATES_PER_SOURCE) continue;

    candidates.push({
      title: inspected.title || link.label,
      summary: `${source.name}で掲載された女子ボートレース関連ニュースです。初音NEWSでは元記事の内容を転載せず、確認できる事実をもとに注目ポイントを初音の視点で整理します。`,
      category: inspected.category || "women",
      source_type: "news",
      source_name: source.name,
      source_url: link.url,
      source_key: sourceKey,
      image_url: null,
      place: null,
      published_at: inspected.published_at,
      is_featured: false,
      priority: 55,
    });
  }

  return { candidates, reviewed, errors, scanned: links.length };
}

export async function collectHatsuneMediaNews() {
  const candidates = [];
  const reviewed = [];
  const errors = [];
  const stats = {};

  const settled = await Promise.allSettled(SOURCES.map((source) => collectSource(source)));
  settled.forEach((result, index) => {
    const source = SOURCES[index];
    if (result.status === "fulfilled") {
      candidates.push(...result.value.candidates);
      reviewed.push(...result.value.reviewed);
      errors.push(...(result.value.errors || []).map((message) => `${source.key}:article:${message}`));
      stats[source.key] = {
        scanned: result.value.scanned || 0,
        reviewed: result.value.reviewed?.length || 0,
        candidates: result.value.candidates?.length || 0,
      };
    } else {
      errors.push(`${source.key}: ${result.reason?.message || String(result.reason)}`);
      stats[source.key] = { scanned: 0, reviewed: 0, candidates: 0, failed: true };
    }
  });

  return { candidates, reviewed, errors, stats };
}
