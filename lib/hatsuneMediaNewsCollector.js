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
  "女子", "女子戦", "女子レーサー", "レディース", "オールレディース", "ヴィーナス",
  "クイーンズ", "女王", "レディースチャンピオン", "レディースオールスター", "水神祭",
];

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

function isWomenRelated(text) {
  const value = normalizeSpace(text);
  return WOMEN_SIGNALS.some((keyword) => value.includes(keyword));
}

function categoryFromText(text) {
  if (text.includes("水神祭")) return "suijinsai";
  if (/優勝|優出|V\b|Ｖ/.test(text)) return "win";
  if (/A1|A2|B1|B2|昇格|級別/.test(text)) return "grade";
  if (/モーター|エンジン|機力|足/.test(text)) return "motor";
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

async function collectSource(source) {
  const listHtml = await fetchHtml(source.listUrl);
  const links = extractArticleLinks(listHtml, source);
  const candidates = [];

  for (const link of links) {
    try {
      const html = await fetchHtml(link.url);
      const title = extractTitle(html, link.label);
      const plainText = stripHtml(html).slice(0, 24000);
      if (!title || !isWomenRelated(`${title} ${plainText}`)) continue;

      candidates.push({
        title,
        summary: `${source.name}で掲載された女子ボートレース関連ニュースです。初音NEWSでは元記事の内容を転載せず、確認できる事実をもとに注目ポイントを初音の視点で整理します。`,
        category: categoryFromText(`${title} ${plainText}`),
        source_type: "news",
        source_name: source.name,
        source_url: link.url,
        source_key: `media:${source.key}:${link.url}`,
        image_url: null,
        place: null,
        published_at: parsePublishedAt(html),
        is_featured: false,
        priority: 55,
      });

      if (candidates.length >= 8) break;
    } catch {
      // Individual articles can disappear or reject automated requests. Skip and continue.
    }
  }
  return candidates;
}

export async function collectHatsuneMediaNews() {
  const candidates = [];
  const errors = [];

  for (const source of SOURCES) {
    try {
      const rows = await collectSource(source);
      candidates.push(...rows);
    } catch (error) {
      errors.push(`${source.key}: ${error?.message || String(error)}`);
    }
  }

  return { candidates, errors };
}
