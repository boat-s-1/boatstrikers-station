// NEWS 一覧の組み立て（純粋関数）。DB 取得は app/news/newsQueries.js、ここでは並び・件数・ページ分けだけを扱う。
// タブ件数・一覧・検索・ページ送りはすべて buildNewsIndex() の結果（同一記事を1件にまとめた後）から数える。

import {
  NEWS_TABS,
  assignNewsCharacter,
  describeNewsCharacterReason,
  isMeaningfulEditorialNews,
  isWomenNews,
  matchesNewsTab,
  toNewsIndexEntry,
} from "./newsTaxonomy.js";
import {
  NEWS_KEY_THRESHOLD,
  groupDuplicateNews,
  newsEventName,
  newsTopicKey,
  scoreNewsImportance,
  selectNewsHighlights,
} from "./newsImportance.js";

export const NEWS_PAGE_SIZE = 20;

function byNewest(a, b) {
  return new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0) || Number(b.id) - Number(a.id);
}

// rows: 公開記事（新しい順）。同じ記事（同一の正規化済み出典URL）は代表1件にまとめる。記事データ自体は変更しない。
export function buildNewsIndex(rows) {
  const groups = groupDuplicateNews(rows.filter(isMeaningfulEditorialNews));
  return groups
    .map(({ representative, members }) => {
      // 同じ記事の別収集分に category=women があれば、女子関連として扱う（category=women は必ず対象）。
      const womenCategory = members.some((m) => String(m.category || "").toLowerCase() === "women");
      const view = womenCategory && String(representative.category || "").toLowerCase() !== "women" ? { ...representative, category: "women" } : representative;
      const entry = toNewsIndexEntry(view);
      if (!entry.women && members.some(isWomenNews)) {
        const assignment = assignNewsCharacter({ ...view, category: "women" });
        entry.women = true;
        entry.character = assignment?.key || null;
        entry.characterReason = describeNewsCharacterReason(assignment);
      }
      const importance = scoreNewsImportance(representative);
      return {
        ...entry,
        importance: importance.score,
        eventType: importance.type,
        grade: importance.grade,
        isKey: importance.score >= NEWS_KEY_THRESHOLD,
        topicKey: newsTopicKey(representative),
        eventName: newsEventName(representative),
        memberIds: members.map((m) => m.id),
      };
    })
    .sort(byNewest);
}

export function matchesNewsSearch(entry, searchIds) {
  return !searchIds || entry.memberIds.some((id) => searchIds.has(String(id)));
}

// 一覧1ページ分の選定。featured（TOP）は一覧から除き、それ以外を NEWS_PAGE_SIZE 件ずつに分ける。
export function selectNewsListing(entries, { category = "all", character = "", event = "", searchIds = null, page = 1, now = Date.now(), highlightCount = 0, pageSize = NEWS_PAGE_SIZE } = {}) {
  const base = entries.filter((entry) => matchesNewsSearch(entry, searchIds));
  const tabCounts = Object.fromEntries(NEWS_TABS.filter((tab) => !tab.href).map((tab) => [tab.key, base.filter((entry) => matchesNewsTab(entry, tab.key)).length]));

  let pool = base.filter((entry) => matchesNewsTab(entry, category));
  if (character) pool = pool.filter((entry) => entry.character === character);
  if (event) pool = pool.filter((entry) => entry.eventName === event);

  const highlights = selectNewsHighlights(pool, { now, count: Math.max(1, highlightCount) });
  const featured = highlights[0] || pool[0] || null;
  const keyEntries = highlightCount > 1 ? highlights.slice(1) : [];
  const rest = featured ? pool.filter((entry) => entry.id !== featured.id) : pool;
  const totalPages = Math.max(1, Math.ceil(rest.length / pageSize));
  const pageEntries = rest.slice((page - 1) * pageSize, page * pageSize);

  return { featured, keyEntries, pageEntries, total: pool.length, listTotal: rest.length, totalPages, hasMore: page < totalPages, tabCounts };
}

// 開催別の記事一覧への導線。直近 days 日に記事がある開催だけを、全期間の件数（?event= の一覧件数と同じ）付きで返す。
export function listNewsEvents(entries, { now = Date.now(), days = 7, limit = 4 } = {}) {
  const since = now - days * 86400000;
  const events = new Map();
  for (const entry of entries) {
    if (!entry.eventName) continue;
    const current = events.get(entry.eventName) || { name: entry.eventName, grade: entry.grade, count: 0, latest: null };
    current.count += 1;
    if (!current.latest || byNewest(entry, current.latest) < 0) current.latest = entry;
    events.set(entry.eventName, current);
  }
  return [...events.values()]
    .filter((event) => new Date(event.latest.publishedAt || 0).getTime() >= since)
    .sort((a, b) => byNewest(a.latest, b.latest))
    .slice(0, limit);
}
