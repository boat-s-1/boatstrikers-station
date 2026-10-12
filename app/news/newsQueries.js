import { unstable_cache } from "next/cache";
import { supabase } from "../bsc2/lib/supabaseClient";
import { getHatsuneNews } from "../hatsune/newsData";
import {
  NEWS_CHARACTERS,
  NEWS_TABS,
  buildNewsSearchQuery,
  isMeaningfulEditorialNews,
  isWithinNewsHours,
  matchesNewsTab,
  newsDayKey,
  parseNewsSearchTerms,
  selectFeaturedNews,
  toNewsIndexEntry,
  toNewsListItem,
} from "../../lib/newsTaxonomy";

// NEWS 一覧専用の読み取り処理。hatsune_news への書き込みや、既存の取得関数（newsData.js）の変更は行わない。

export const NEWS_PAGE_SIZE = 20;
export const NEWS_SECTION_SIZE = 6;
const INDEX_CHUNK_SIZE = 1000;
const INDEX_MAX_CHUNKS = 50;
const INDEX_REVALIDATE_SECONDS = 120;
const SEARCH_MAX_RESULTS = 2000;

const INDEX_SELECT = "id,title,list_headline,summary,article_body,category,source_type,source_name,published_at,is_featured,priority";
const LIST_SELECT = "id,title,list_headline,summary,category,source_type,source_name,place,published_at,is_featured,priority";

function publishedNewsQuery(select) {
  return supabase
    .from("hatsune_news")
    .select(select)
    .eq("is_published", true)
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("is_featured", { ascending: false })
    .order("priority", { ascending: false })
    .order("id", { ascending: false });
}

// 全公開記事の軽量インデックス（id・日時・表示カテゴリーなど）。本文は分類にだけ使い、キャッシュには残さない。
async function loadNewsIndex() {
  if (!supabase) return [];
  const entries = [];
  let from = 0;
  for (let chunk = 0; chunk < INDEX_MAX_CHUNKS; chunk += 1) {
    const { data, error } = await publishedNewsQuery(INDEX_SELECT).range(from, from + INDEX_CHUNK_SIZE - 1);
    // 例外にしてキャッシュさせない（一時的な失敗で空の一覧を保持しないため）。
    if (error) throw new Error(error.message);
    const rows = Array.isArray(data) ? data : [];
    if (!rows.length) break;
    for (const row of rows) {
      if (isMeaningfulEditorialNews(row)) entries.push(toNewsIndexEntry(row));
    }
    from += rows.length;
  }
  return entries;
}

const getCachedNewsIndex = unstable_cache(loadNewsIndex, ["boatstrikers-news-index-v2"], {
  revalidate: INDEX_REVALIDATE_SECONDS,
  tags: ["boatstrikers-news-index"],
});

async function getNewsIndex() {
  try {
    return { entries: await getCachedNewsIndex(), degraded: false };
  } catch (error) {
    console.warn("NEWSインデックス取得:", error?.message || error);
    // 失敗時は従来どおり直近100件だけで表示を続ける。
    const rows = await getHatsuneNews({ limit: 100, category: "all" });
    return { entries: rows.filter(isMeaningfulEditorialNews).map(toNewsIndexEntry), degraded: true };
  }
}

async function searchNewsIds(q) {
  const terms = parseNewsSearchTerms(q);
  // 記号だけの検索語は従来どおり「該当なし」にする。
  if (!terms.length || !supabase) return { ids: new Set(), failed: false };
  const { data, error } = await supabase
    .from("hatsune_news")
    .select("id")
    .eq("is_published", true)
    .or(buildNewsSearchQuery(terms))
    .order("published_at", { ascending: false, nullsFirst: false })
    .range(0, SEARCH_MAX_RESULTS - 1);
  if (error) {
    console.warn("NEWS検索:", error.message);
    return { ids: new Set(), failed: true };
  }
  return { ids: new Set((data || []).map((row) => String(row.id))), failed: false };
}

async function fetchNewsRowsByIds(ids) {
  const unique = [...new Set(ids.map(String))];
  if (!unique.length || !supabase) return new Map();
  const { data, error } = await supabase.from("hatsune_news").select(LIST_SELECT).eq("is_published", true).in("id", unique);
  if (error) {
    console.warn("NEWS記事取得:", error.message);
    return new Map();
  }
  return new Map((data || []).map((row) => [String(row.id), row]));
}

function pickItems(entries, rowsById) {
  return entries
    .map((entry) => {
      const row = rowsById.get(String(entry.id));
      return row ? toNewsListItem(row, entry) : null;
    })
    .filter(Boolean);
}

export function parseNewsPage(value) {
  const page = Number.parseInt(String(value || "1"), 10);
  return Number.isFinite(page) && page >= 1 ? Math.min(page, 10000) : 1;
}

export const NEWS_SECTIONS = [
  { key: "women", title: "女子戦・女子レーサー", character: "hatsune", href: { category: "women" }, match: (entry) => entry.women },
  { key: "kiina", title: "万舟・高配当・波乱", character: "kiina", href: { category: "all", character: "kiina" }, match: (entry) => entry.character === "kiina" },
  { key: "focus", title: "注目レース", character: null, href: { category: "focus" }, match: (entry) => entry.bucket === "focus" },
  { key: "result", title: "結果", character: null, href: { category: "result" }, match: (entry) => entry.bucket === "result" },
];

// 一覧ページ・「もっと見る」API 共通の取得処理。
// タブ件数・一覧・検索・ページ送りはすべて同じ index と matchesNewsTab で絞り込むため件数が一致する。
export async function getNewsListing({ category = "all", character = "", q = "", page = 1, includeSections = false } = {}) {
  const now = Date.now();
  const { entries, degraded } = await getNewsIndex();

  const search = String(q || "").trim() ? await searchNewsIds(q) : null;
  const base = search ? entries.filter((entry) => search.ids.has(String(entry.id))) : entries;
  const tabCounts = Object.fromEntries(NEWS_TABS.filter((tab) => !tab.href).map((tab) => [tab.key, base.filter((entry) => matchesNewsTab(entry, tab.key)).length]));

  let pool = base.filter((entry) => matchesNewsTab(entry, category));
  if (character) pool = pool.filter((entry) => entry.character === character);

  const featuredEntry = selectFeaturedNews(pool, now);
  const rest = featuredEntry ? pool.filter((entry) => entry.id !== featuredEntry.id) : pool;
  const totalPages = Math.max(1, Math.ceil(rest.length / NEWS_PAGE_SIZE));
  const pageEntries = rest.slice((page - 1) * NEWS_PAGE_SIZE, page * NEWS_PAGE_SIZE);

  const sectionEntries = {};
  if (includeSections) {
    for (const section of NEWS_SECTIONS) sectionEntries[section.key] = entries.filter(section.match).slice(0, NEWS_SECTION_SIZE);
  }

  const wantedIds = [
    ...(page === 1 && featuredEntry ? [featuredEntry.id] : []),
    ...pageEntries.map((entry) => entry.id),
    ...Object.values(sectionEntries).flat().map((entry) => entry.id),
  ];
  const rowsById = await fetchNewsRowsByIds(wantedIds);

  const sections = {};
  for (const [key, list] of Object.entries(sectionEntries)) sections[key] = pickItems(list, rowsById);
  const featured = page === 1 && featuredEntry ? pickItems([featuredEntry], rowsById)[0] || null : null;

  // 「直近24時間」の本数と担当キャラ別の本数（絞り込みに関係なく全公開記事が対象）。
  const recent = entries.filter((entry) => isWithinNewsHours(entry.publishedAt, 24, now));
  const recentByCharacter = Object.fromEntries(Object.keys(NEWS_CHARACTERS).map((key) => [key, recent.filter((entry) => entry.character === key).length]));

  return {
    total: pool.length,
    page,
    totalPages,
    hasMore: page < totalPages,
    featured,
    items: pickItems(pageEntries, rowsById),
    lastDayKey: pageEntries.length ? newsDayKey(pageEntries[pageEntries.length - 1].publishedAt) : "",
    sections,
    tabCounts,
    allTotal: entries.length,
    recentTotal: recent.length,
    recentByCharacter,
    updatedAt: entries[0]?.publishedAt || null,
    degraded,
    searchFailed: !!search?.failed,
  };
}
