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
  "レディースチャンピオン", "レディースオールスター",
];

function normalizeSpace(value) {
  return String(value || "").replace(/[\s\u3000]+/g, " ").trim();
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
  return WOMEN_SIGNALS.some((keyword) => value.includes(keyword));
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
  return "";
}

function isWomenRelatedArticle({ title, description, articleText }) {
  const lead = String(articleText || "").slice(0, 1800);
  return hasWomenSignal(`${title || ""} ${description || ""} ${lead}`);
}

function categoryFromArticle({ title, description, articleText }) {
  const headline = normalizeSpace(title);
  const lead = normalizeSpace(`${description || ""} ${String(articleText || "").slice(0, 1600)}`);

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
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      const date = new Date(match[1]);
      if (!Number.isNaN(date.getTime())) return date.toISOString();
    }
  }
  return new Date().toISOString();
}

function extractTitle(html, fallback = "") {
  const og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);
  if (og?.[1]) return stripHtml(og[1]).replace(/\s*[-｜|]\s*(日刊スポーツ|マクール).*$/u, "").trim();
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return stripHtml(title?.[1] || fallback).replace(/\s*[-｜|]\s*(日刊スポーツ|マクール).*$/u, "").trim();
}

async function fetchHtml(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; BoatStrikers/1.0; +https://www.boat-strike.online/)",
      "Accept-Language": "ja,en-US;q=0.8,en;q=0.6",
      Accept: "text/html,application/xhtml+xml",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(12000),
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

    const valid = source.key === "nikkan"
      ? /nikkansports\.com\/public_race\/news\/20\d{6,}/.test(url)
      : /sp\.macour\.jp\/news\//.test(url) && url !== source.listUrl;
    if (!valid) continue;

    seen.add(url);
    links.push({ url, label });
    if (links.length >= 30) break;
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
  const candidates = [];
  const reviewed = [];

  for (const link of links) {
    try {
      const inspected = await inspectHatsuneMediaArticle(link.url, source.name);
      const sourceKey = `media:${source.key}:${link.url}`;
      reviewed.push({
        source_key: sourceKey,
        source_name: source.name,
        source_url: link.url,
        title: inspected.title || link.label,
        women_related: inspected.womenRelated,
        category: inspected.category,
      });
      if (!inspected.womenRelated) continue;

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

      if (candidates.length >= 8) break;
    } catch {
      // Individual articles can disappear or reject automated requests. Skip and continue.
    }
  }
  return { candidates, reviewed };
}

export async function collectHatsuneMediaNews() {
  const candidates = [];
  const reviewed = [];
  const errors = [];

  for (const source of SOURCES) {
    try {
      const rows = await collectSource(source);
      candidates.push(...rows.candidates);
      reviewed.push(...rows.reviewed);
    } catch (error) {
      errors.push(`${source.key}: ${error?.message || String(error)}`);
    }
  }

  return { candidates, reviewed, errors };
}
