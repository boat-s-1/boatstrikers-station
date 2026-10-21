// BoatStrikers NEWS の重要度判定・注目記事の選定・同一記事の整理（表示側のみ、純粋関数）。
// DB の priority は収集処理ごとに尺度が違うため使わない。is_featured は弱い補助としてだけ使う。

import { cleanNewsHeadline, stripNewsBoilerplate } from "./newsTaxonomy.js";

// ---- 開催グレード（見出しだけで判定。「SGに行きたい」のような談話中の語は引用を除いて扱う） ----
const SG_RE = /(?:^|[^A-Za-z0-9])SG(?:[^A-Za-z0-9]|$)|グランプリ|チャレンジカップ|ボートレースクラシック|ボートレースオールスター|ボートレースメモリアル|ボートレースダービー|オーシャンカップ|グランドチャンピオン/;
const G1_RE = /(?:^|[^A-Za-z0-9])P?G1(?:[^A-Za-z0-9]|$)|GⅠ|周年記念|地区選手権|ヤングダービー|クイーンズクライマックス|レディースチャンピオン|マスターズチャンピオン/;
const G23_RE = /(?:^|[^A-Za-z0-9])G[23](?:[^A-Za-z0-9]|$)|GⅡ|GⅢ|オールレディース|マスターズリーグ|イースタンヤング|ウエスタンヤング/;

// 「」内の談話は事実の種類の判定に使わない（「優勝したい」等で誤判定しないため）。
function withoutQuotes(text) {
  return String(text || "").replace(/「[^」]*」/g, " ").replace(/『[^』]*』/g, " ");
}

export function detectNewsGrade(headline) {
  const text = withoutQuotes(headline);
  if (SG_RE.test(text)) return "SG";
  if (G1_RE.test(text)) return "G1";
  if (G23_RE.test(text)) return "G2G3";
  return null;
}

const VENUES = "桐生|戸田|江戸川|平和島|多摩川|浜名湖|蒲郡|常滑|津|三国|びわこ|住之江|尼崎|鳴門|丸亀|児島|宮島|徳山|下関|若松|芦屋|福岡|唐津|大村";
const GRADE_TOKEN = { SG: "SG", G1: "G1", PG1: "G1", "GⅠ": "G1", G2: "G2G3", G3: "G2G3", "GⅡ": "G2G3", "GⅢ": "G2G3", 周年: "G1" };

// 見出しの開催場（「／江戸川」「三国G1」など）。わからなければ空文字。
function headlineVenue(item) {
  const match = newsTopicKey(item).match(new RegExp(`^(${VENUES})`));
  return match ? match[1] : "";
}

// グレードの根拠：まず見出し。見出しに無い場合は、要約・本文（定型文と談話を除く）に
// 「見出しと同じ開催場＋グレード」（例: 江戸川・GⅢ、三国G1、三国周年）が明記されているときだけ使う。
// 他場の開催への言及（例: 「三国で行われるプレミアムG1」）や場名の無いグレード語では推測しない。
export function detectNewsGradeEvidence(item) {
  const fromHeadline = detectNewsGrade(cleanNewsHeadline(item?.list_headline || item?.title));
  if (fromHeadline) return { grade: fromHeadline, source: "見出し" };
  const venue = headlineVenue(item);
  if (!venue) return { grade: null, source: "" };
  const text = withoutQuotes(stripNewsBoilerplate(`${item?.summary || ""}\n${item?.article_body || ""}`));
  const match = text.match(new RegExp(`${venue}(?:・|の)?(SG|PG1|G[123]|GⅠ|GⅡ|GⅢ|周年)(?![A-Za-z0-9])`));
  return match ? { grade: GRADE_TOKEN[match[1]], source: `本文「${match[0]}」` } : { grade: null, source: "" };
}

// ---- 出来事の種類 ----
// 優勝決定：完了の表現だけに一致させる（後続文字の制限で「Ｖへ」「Ｖ狙う」「Ｖ目指して」「優勝ならず」「Ｖ逸」「Ｖ機」「優勝機」は一致しない）。
const WIN_RE = /(?:Ｖ|V)(?:$|[\s　、，。！!]|を飾|達成|もぎ取|奪取)|度目(?:の)?(?:Ｖ|V|優勝)(?!へ|を狙|狙|ならず|を目指|目指|に向)|(?:今年|地元|当地|デビュー)?初優勝(?!へ|を狙|狙|したい|を目指|目指|に向|ならず)|優勝を(?:飾|決め|果た)|優勝した|制覇/;
// 優勝戦進出が確定している記事（優勝戦の枠番・優出・優勝戦での談話・優勝戦の結果）。
const FINAL_RE = /(?<!準)優勝戦(?!進出を|を狙|を目指)|(?<!前節|前回|前走|準|連続)優出(?!を狙|狙|へ|を目指|目指|中|率|回数)|ポールポジション|ファイナル|優勝ならず|Ｖならず|Vならず/;
// 要約で確認できる優勝戦進出（準優の勝利、優勝戦の枠番、優出の決定）。
const FINAL_SUMMARY_RE = /優勝戦(?:の)?[1-6１-６]枠|準優(?:勝戦)?[^。]{0,25}(?:逃げ切|まくり切|差し切|快勝|完勝|1着|１着)|優出(?:を)?(?:決め|果た)|優出一番乗り/;
// 予選・準優の段階の談話や展望（「優出狙う」「準優に向けて」「勝負駆け」など）。優勝戦進出とは区別する。
const QUALIFYING_RE = /準優|予選|勝負駆け|得点率|優出(?:を)?(?:狙|目指)|優出へ|優勝戦(?:進出)?を(?:狙|目指)/;
const INCIDENT_RE = /フライング|返還|転覆|落水|失格|妨害|事故/;
const MILESTONE_RE = /水神祭|初勝利(?!目指|へ|を狙|狙|ならず)|引退|通算\d+勝|\d+勝目|初優出(?!を目指|目指|へ|を狙|狙)|デビュー戦|記録達成|節目/;
const COLUMN_RE = /コラム|企画|来社PR|PR|売り上げ|売上|トークショー|セレモニー|イベント/;

const MAX_PAYOUT_RE = /最高([\d,]+)円/;

function parseYen(text) {
  const match = String(text || "").match(MAX_PAYOUT_RE);
  return match ? Number(match[1].replace(/,/g, "")) : 0;
}

// 事故・返還は「数値などの具体的な事実が見出し・要約にある」記事だけを事故ニュースとして扱う。
function isVerifiedIncident(headline, summary) {
  const h = withoutQuotes(headline);
  if (!INCIDENT_RE.test(h)) return false;
  const facts = `${h} ${summary}`;
  return /\d[\d,.]*\s*(?:％|%|円|R|艇|人)/.test(facts) && INCIDENT_RE.test(summary || h);
}

export function detectNewsEvent(item) {
  const headline = cleanNewsHeadline(item?.list_headline || item?.title);
  const fullTitle = cleanNewsHeadline(item?.title);
  const text = withoutQuotes(`${headline} ${fullTitle}`);
  const summary = stripNewsBoilerplate(item?.summary);
  const isBs = String(item?.source_type || "").toLowerCase() === "bs_data";

  if (isBs) {
    if (/結果まとめ/.test(fullTitle) || /結果｜万舟/.test(headline)) return { type: "digest", maxPayout: parseYen(`${headline} ${summary}`) };
    if (/結果を更新/.test(fullTitle)) return { type: /優勝戦/.test(fullTitle) ? "final_result" : "race_result" };
    if (/高モーター|2連対率/.test(fullTitle)) return { type: "bs_motor" };
    if (/^明日の/.test(fullTitle)) return { type: /未確認|確認できていません|まだ確認|未掲載/.test(`${summary} ${item?.article_body || ""}`) ? "bs_tomorrow_pending" : "bs_tomorrow" };
    return { type: "bs_other" };
  }
  if (isVerifiedIncident(`${headline} ${fullTitle}`, summary)) return { type: "incident" };
  // 要約が「優勝戦1枠を確保」「優勝戦に臨む」等の展望なら、見出しの言い回しに関わらず優勝決定にしない。
  const previewSummary = /優勝戦(?:の)?[1１]枠|優勝戦に臨|優勝戦へ|優勝を目指/.test(summary) && !/優勝した|優勝を飾|制覇|逃げ切って優勝|Ｖ達成/.test(summary);
  if (WIN_RE.test(text) && !previewSummary) return { type: "win" };
  if (previewSummary) return { type: "final" };
  if (MILESTONE_RE.test(text)) return { type: "milestone" };
  if (FINAL_RE.test(text) || FINAL_SUMMARY_RE.test(withoutQuotes(summary))) return { type: "final" };
  if (QUALIFYING_RE.test(text)) return { type: "qualifying" };
  if (COLUMN_RE.test(text)) return { type: "column" };
  return { type: "talk" };
}

const EVENT_BASE = {
  win: 60, incident: 55, final_result: 50, milestone: 40, final: 38, digest: 35, qualifying: 20,
  bs_motor: 18, bs_tomorrow: 15, talk: 15, race_result: 12, column: 12, bs_other: 10, bs_tomorrow_pending: 5,
};
// グレードは単独では最重要にしない。出来事の種類ごとに加点の効き方を変える。
const GRADE_BONUS = { SG: 25, G1: 15, G2G3: 6 };
const GRADE_FACTOR = { win: 1, incident: 1, final_result: 1, final: 1, milestone: 0.6, qualifying: 0.5, talk: 0.5, column: 0.3 };

export const NEWS_KEY_THRESHOLD = 55; // 一覧で控えめに強調する重要記事の下限

export const NEWS_EVENT_LABELS = {
  win: "優勝", incident: "事故・返還", final_result: "優勝戦結果", milestone: "節目", digest: "結果まとめ", final: "優勝戦進出", qualifying: "予選・準優",
  bs_motor: "モーター", bs_tomorrow: "明日の注目", bs_tomorrow_pending: "明日の注目", talk: "談話・展望", race_result: "レース結果", column: "企画・話題", bs_other: "データ",
};

// 記事そのものの重要度（新しさを含まない）。
export function scoreNewsImportance(item) {
  const event = detectNewsEvent(item);
  const { grade, source: gradeSource } = detectNewsGradeEvidence(item);
  let score = EVENT_BASE[event.type] ?? 10;
  if (grade) score += GRADE_BONUS[grade] * (GRADE_FACTOR[event.type] ?? 0.5);
  if (event.type === "digest" && event.maxPayout >= 100000) score += 10;
  if (item?.is_featured) score += 3;
  return { score: Math.round(score), type: event.type, grade, gradeSource };
}

// ---- 話題のまとめ（同じ開催・同じ日次企画が注目枠を独占しないため） ----
// 見出し末尾の「／三国G1」「/江戸川・GⅢオールレディース」などを開催名として使う。
export function newsTopicKey(item) {
  const headline = cleanNewsHeadline(item?.title);
  const venue = headline.match(/(?:[／/」]|\s)([^\s／/」]{1,24})$/);
  if (venue && venue[1].length <= 16) return venue[1].replace(/ボート$/, "");
  if (String(item?.source_type || "").toLowerCase() === "bs_data") {
    if (/結果まとめ/.test(headline)) return "bs:digest";
    if (/^明日の/.test(headline)) return "bs:tomorrow";
    return `bs:${item?.place || headline.slice(0, 4)}`;
  }
  return `id:${item?.id}`;
}

// 開催名（グレード付きの話題だけ）。開催別の記事一覧への導線に使う。
export function newsEventName(item) {
  const key = newsTopicKey(item);
  if (key.startsWith("id:") || key.startsWith("bs:")) return "";
  return detectNewsGrade(key) ? key : "";
}

// 新しさ：36時間を過ぎた記事は減点し、数日前の大きなニュースが TOP に居座らないようにする。
function recencyBonus(ageHours) {
  if (ageHours <= 12) return 20;
  if (ageHours <= 24) return 15;
  if (ageHours <= 36) return 8;
  if (ageHours <= 48) return -5;
  return -15;
}

function ageHoursOf(entry, now) {
  const p = new Date(entry.publishedAt || 0).getTime();
  return p ? Math.max(0, (now - p) / 3600000) : Infinity;
}

export const NEWS_HIGHLIGHT_MIN = 30; // 「主なニュース」に入れる重要度の下限（TOP は下限なし）

// TOP と「主なニュース」を選ぶ。entries は index エントリ（importance / eventType / topicKey / publishedAt を持つ）。
// 同じ話題は1件まで、同じ種類は2件まで、日次まとめは1件まで。
export function selectNewsHighlights(entries, { now = Date.now(), count = 4, windowHours = 72 } = {}) {
  const ranked = entries
    .map((entry) => ({ entry, age: ageHoursOf(entry, now) }))
    .filter(({ age }) => age <= windowHours)
    .map(({ entry, age }) => ({ entry, rank: (entry.importance || 0) + recencyBonus(age) }))
    .sort((a, b) => b.rank - a.rank || new Date(b.entry.publishedAt || 0) - new Date(a.entry.publishedAt || 0));
  const picked = [];
  const topics = new Set();
  const types = new Map();
  for (const { entry } of ranked) {
    if (picked.length >= count) break;
    if (picked.length > 0 && (entry.importance || 0) < NEWS_HIGHLIGHT_MIN) continue;
    if (topics.has(entry.topicKey)) continue;
    const used = types.get(entry.eventType) || 0;
    if (used >= (entry.eventType === "digest" ? 1 : 2)) continue;
    picked.push(entry);
    topics.add(entry.topicKey);
    types.set(entry.eventType, used + 1);
  }
  return picked;
}

// ---- 同一記事（同じ出典URL）の整理 ----
// 記事を一意に指すことが確認できる URL 形式だけを対象にする。出走表や汎用ページの URL は別記事が共有しているため対象外。
const ARTICLE_URL_PATTERNS = [
  /^https:\/\/www\.nikkansports\.com\/public_race\/news\/\d{12,}\.html$/,
  /^https:\/\/sp\.macour\.jp\/news\/\d+$/,
  /^https:\/\/www\.boatrace\.jp\/owpc\/pc\/site\/news\/\d{4}\/\d{2}\/\d+$/,
];

// 正規化：スキーム・ホストの小文字化、http→https、フラグメント・末尾スラッシュ・utm_* の除去のみ。他のクエリは残す。
export function normalizeNewsSourceUrl(value) {
  let url;
  try {
    url = new URL(String(value || "").trim());
  } catch {
    return "";
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return "";
  url.protocol = "https:";
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) if (/^utm_/i.test(key)) url.searchParams.delete(key);
  const path = url.pathname.replace(/\/+$/, "");
  const query = url.searchParams.toString();
  return `https://${url.host.toLowerCase()}${path}${query ? `?${query}` : ""}`;
}

function comparableHeadline(item) {
  return cleanNewsHeadline(item?.title).normalize("NFKC").replace(/\s+/g, "");
}

// 同一記事として束ねるキー。束ねない記事は空文字。
export function newsDuplicateKey(item) {
  if (String(item?.source_type || "").toLowerCase() === "bs_data") return "";
  const url = normalizeNewsSourceUrl(item?.source_url);
  if (!url || !ARTICLE_URL_PATTERNS.some((re) => re.test(url))) return "";
  return url;
}

// 代表記事の選び方：定型文を除いた本文が長いもの → 要約が長いもの → 短い見出しがあるもの → 新しい id。
export function newsRichness(item) {
  const body = stripNewsBoilerplate(item?.article_body).replace(/\s+/g, "");
  const summary = stripNewsBoilerplate(item?.summary).replace(/\s+/g, "");
  return body.length * 4 + summary.length * 2 + (item?.list_headline ? 50 : 0);
}

// rows を同一記事ごとにまとめる。戻り値は { representative, members } の配列（入力の並び順を保つ）。
export function groupDuplicateNews(rows) {
  const groups = [];
  const byKey = new Map();
  for (const row of rows) {
    const key = newsDuplicateKey(row);
    if (!key) {
      groups.push({ representative: row, members: [row] });
      continue;
    }
    const group = byKey.get(key);
    // 同じ URL でも見出しが違う場合は、収集時の取り違えの可能性があるため束ねない。
    if (group && comparableHeadline(group.members[0]) !== comparableHeadline(row)) {
      groups.push({ representative: row, members: [row] });
      continue;
    }
    if (!group) {
      const created = { representative: row, members: [row] };
      byKey.set(key, created);
      groups.push(created);
      continue;
    }
    group.members.push(row);
    const better = newsRichness(row) > newsRichness(group.representative) || (newsRichness(row) === newsRichness(group.representative) && Number(row.id) > Number(group.representative.id));
    if (better) group.representative = row;
  }
  return groups;
}
