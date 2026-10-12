// BoatStrikers NEWS の表示用カテゴリー・見出し・検索条件をまとめた共通定義。
// DB の値は変更せず、表示時の分類と整形だけを担当する（サーバー／クライアント両方から読み込める純粋関数のみ）。

export const NEWS_TABS = [
  { key: "all", label: "メイン" },
  { key: "bs", label: "BS記事" },
  { key: "women", label: "女子" },
  { key: "grade", label: "SG・G1" },
  { key: "focus", label: "注目レース" },
  { key: "result", label: "今日の結果" },
  { key: "racer", label: "選手情報" },
  { key: "media", label: "メディア", href: "/news/media" },
];

// 一覧バッジ・記事詳細タグで共通に使う短いラベル。
export const NEWS_BUCKET_LABELS = {
  bs: "BS記事",
  women: "女子",
  grade: "SG・G1",
  focus: "注目",
  result: "結果",
  racer: "選手",
  all: "ニュース",
};

const NEWS_BUCKET_KEYS = new Set(NEWS_TABS.filter((tab) => !tab.href).map((tab) => tab.key));

// 既存の ?category= の値をそのまま受け付け、未知の値は「メイン」に戻す。
export function normalizeNewsTab(value) {
  const key = String(value || "");
  return NEWS_BUCKET_KEYS.has(key) ? key : "all";
}

const GRADE_RE = /(?:^|[\s・／/【\[(（])(?:SG|G\s*[123]|GⅠ|GⅡ|GⅢ|GI|GII|GIII)(?:$|[\s・／/】\])）])|(?:^|[^A-Za-z0-9])(?:SG|G[123])(?:[^A-Za-z0-9]|$)|グランプリ|チャレンジカップ|ボートレース(?:クラシック|オールスター|メモリアル|ダービー)|グランドチャンピオン|オーシャンカップ|ヤングダービー|周年記念|周年競走|地区選手権|グレードレース/i;
const PROMOTION_RE = /A1|A2|B1|B2|昇格|昇級|降格|級別/;
const RESULT_RE = /結果を更新|レース結果|払戻|着順|確定|優勝(?:した|を飾|決定|達成)|優出決定|V達成|初優勝|レース後|決着|万舟|高配当/;
const RACER_RE = /水神祭|昇級|A1昇格|A2昇格|級別|インタビュー|トークショー|結婚|引退|復帰|欠場|追加斡旋|斡旋|登録|記録達成|選手特集|レーサー特集|デビュー|連勝|予選\d*位通過|予選トップ|前走地|近況|当地初|通算\d+勝|節目|フライング休み|復帰戦|選手が|レーサーが/;
const WOMEN_RE = /女子戦|女子レーサー|ヴィーナス|オールレディース|レディース|クイーンズ|女子ボート/;
const FOCUS_RE = /明日|翌日|あす|注目レース|高モーター|モーター|機力|展示|2連対率|優勝戦前|開催初日|初日注目|ドリーム戦|予選注目|好枠|絶好枠/;
const GENERIC_COPY_RE = /公開されたボートレース関連ニュースです|元記事を転載せず|記事をBoatStrikers NEWSが確認しました|詳細は出典元の記事をご確認ください/;

function classificationText(item) {
  return `${item?.list_headline || ""} ${item?.title || ""} ${item?.summary || ""} ${item?.category || ""} ${item?.source_name || ""}`;
}

export function classifyNewsBucket(item) {
  const t = classificationText(item);
  const c = String(item?.category || "").toLowerCase();
  const source = String(item?.source_name || "");

  // 具体的なテーマを先に判定する。女子記事でもSG/G1や選手ニュースなら専用タブへ振り分ける。
  // DB の category="grade" は収集時の簡易判定のため、本文側にグレードレースの根拠がある記事だけを SG・G1 とする。
  if (GRADE_RE.test(t)) return "grade";
  if (c === "grade" && PROMOTION_RE.test(t)) return "racer";
  if (["result", "win"].includes(c) || RESULT_RE.test(t)) return "result";
  if (c === "suijinsai" || RACER_RE.test(t)) return "racer";
  if (["motor", "tomorrow"].includes(c) || FOCUS_RE.test(t)) return "focus";
  if (c === "women" || WOMEN_RE.test(t)) return "women";

  if (/BoatStrikers AI編集部|BoatStrikers編集部|BSオリジナル/i.test(source) || /BoatStrikers独自|独自分析|独自記事|AI分析|データ研究/.test(t)) return "bs";
  return "all";
}

export function newsBucketLabel(bucket) {
  return NEWS_BUCKET_LABELS[bucket] || NEWS_BUCKET_LABELS.all;
}

export function isGenericNewsCopy(value) {
  return GENERIC_COPY_RE.test(String(value || ""));
}

export function isMeaningfulEditorialNews(item) {
  const summary = String(item?.summary || "").replace(/\s+/g, " ").trim();
  const body = String(item?.article_body || "").replace(/\s+/g, " ").trim();
  if (isGenericNewsCopy(summary) || isGenericNewsCopy(body)) return false;
  if (String(item?.source_type || "").toLowerCase() === "bs_data" && (summary.length >= 40 || body.length >= 80)) return true;
  return summary.length >= 80 || body.length >= 180;
}

// 出典サイトが付ける定型の前後置きだけを取り除く。記事固有の語句は削らない。
const HEADLINE_PREFIXES = [/^【ボートレース】\s*/, /^NEW\s+ニュース\s+/];
const HEADLINE_SUFFIXES = [
  /\s*-\s*ボート\s*[:：]\s*日刊スポーツ\s*$/,
  /\s*[|｜]\s*ボートレース（競艇）\s*【マクール】\s*$/,
  /\s*\[\d{1,2}:\d{2}\]\s*$/,
];
const MIN_HEADLINE_LENGTH = 8;

export function cleanNewsHeadline(value) {
  const original = String(value || "").replace(/\s+/g, " ").trim();
  let text = original;
  for (const re of HEADLINE_PREFIXES) text = text.replace(re, "");
  let previous;
  do {
    previous = text;
    for (const re of HEADLINE_SUFFIXES) text = text.replace(re, "");
  } while (text !== previous);
  text = text.trim();
  return text.length >= MIN_HEADLINE_LENGTH ? text : original;
}

export function newsHeadline(item) {
  return cleanNewsHeadline(item?.list_headline || item?.title) || "ニュース";
}

export function newsAgeHours(publishedAt, now = Date.now()) {
  const p = new Date(publishedAt || 0).getTime();
  return p ? Math.max(0, (now - p) / 3600000) : 9999;
}

// 一覧の「注目」選定。index エントリ（publishedAt / bucket / featured / priority / hasListHeadline）を受け取る。
export function newsFeaturedScore(entry, now = Date.now()) {
  const age = newsAgeHours(entry.publishedAt, now);
  const recency = age <= 6 ? 60 : age <= 12 ? 52 : age <= 24 ? 44 : age <= 36 ? 34 : age <= 48 ? 24 : age <= 72 ? 12 : 0;
  const typeWeight = { bs: 18, grade: 16, focus: 14, women: 12, racer: 9, result: 7, all: 5 }[entry.bucket] || 0;
  const manualFeatured = entry.featured && age <= 72 ? 28 : 0;
  const priority = Math.max(0, Math.min(10, Number(entry.priority || 0))) * 3;
  const headlineBonus = entry.hasListHeadline ? 4 : 0;
  return recency + typeWeight + manualFeatured + priority + headlineBonus;
}

export function selectFeaturedNews(entries, now = Date.now()) {
  if (!entries.length) return null;
  const within36h = entries.filter((entry) => newsAgeHours(entry.publishedAt, now) <= 36);
  const pool = within36h.length ? within36h : entries.filter((entry) => newsAgeHours(entry.publishedAt, now) <= 72);
  const candidates = pool.length ? pool : entries.slice(0, 10);
  return [...candidates].sort((a, b) => newsFeaturedScore(b, now) - newsFeaturedScore(a, now) || new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0))[0] || null;
}

export function toNewsIndexEntry(row) {
  return {
    id: row.id,
    publishedAt: row.published_at || null,
    bucket: classifyNewsBucket(row),
    featured: !!row.is_featured,
    priority: Number(row.priority || 0),
    hasListHeadline: !!row.list_headline,
  };
}

// 一覧の1行に必要な値だけを持つ表示用オブジェクト（API レスポンスにもそのまま使う）。
export function toNewsListItem(row) {
  return {
    id: row.id,
    headline: newsHeadline(row),
    summary: String(row.summary || "").trim(),
    publishedAt: row.published_at || null,
    bucket: classifyNewsBucket(row),
  };
}

// 検索語は空白区切りで AND 検索。PostgREST のフィルター構文で意味を持つ記号は取り除く。
export const NEWS_SEARCH_COLUMNS = ["title", "list_headline", "summary", "article_body", "source_name", "place"];
const MAX_SEARCH_TERMS = 5;
const MAX_TERM_LENGTH = 40;

export function parseNewsSearchTerms(q) {
  const terms = String(q || "")
    .split(/[\s\u3000]+/)
    .map((term) => term.replace(/[,().:"'\\%*_]/g, "").slice(0, MAX_TERM_LENGTH))
    .filter(Boolean);
  return [...new Set(terms)].slice(0, MAX_SEARCH_TERMS);
}

export function buildNewsSearchFilter(term) {
  return NEWS_SEARCH_COLUMNS.map((column) => `${column}.ilike.*${term}*`).join(",");
}

// supabase-js の .or() に渡す条件。複数語は and(or(...),or(...)) の入れ子で「すべての語を含む」にする。
export function buildNewsSearchQuery(terms) {
  if (!terms.length) return "";
  if (terms.length === 1) return buildNewsSearchFilter(terms[0]);
  return `and(${terms.map((term) => `or(${buildNewsSearchFilter(term)})`).join(",")})`;
}

const JST_DATE = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric" });

export function formatNewsShortDate(value) {
  const d = new Date(value);
  if (!value || Number.isNaN(d.getTime())) return "";
  return JST_DATE.format(d);
}

export function isNewNews(publishedAt, now = Date.now()) {
  const p = new Date(publishedAt || 0).getTime();
  return !!p && now - p < 86400000;
}
