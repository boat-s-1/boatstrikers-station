// 自動下書きの本文に出てくる数値を、元データ（ファクトシート）と「項目と数値の組み合わせ」で照合する。
// 照合できない数値が1つでもあれば不合格（安全に検証できない場合も不合格）。
//
// 判定の考え方
// - 「84.2%」のような数値は、同じ文の直前にその項目名（例：イン逃げ率）があり、値も一致するときだけ合格。
// - 艇ごとのデータ（例：2号艇 当地勝率7.40）は、項目名・値に加えて、最も近い「N号艇」が一致すること。
// - 日付・レース番号・艇番・買い目・金額・点数は、それぞれの決まった書き方で元データと一致すること。
// - それ以外の数値（時刻・回数・別レースの番号など）は検証できないので不合格。

const KANJI_DIGITS = ["〇", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
const SENTENCE_BREAK = /[。！？!?\n]/;
const LABEL_WINDOW = 24;
const BOAT_FOLLOW_WINDOW = 12;

// 数字を含む用語（2連率・3連単・1着・1マーク など）は、項目名として扱うため数字を漢数字に置き換える。
const TERM_PATTERNS = [
  /([1-6])[・、,〜~]([1-6])着/g,
  /([1-3])連(対)?率/g,
  /([23])連(単|複)/g,
  /([1-6])着/g,
  /([12])マーク/g,
  /([1-6])コース/g,
  /([1-6])アタマ/g,
  /([1-6])枠/g,
  /([1-6])番手/g,
];

// 既定の定型文（テンプレートの注意書きなど）。数値を含むが事実ではないため除外する。
const BOILERPLATE = [/20歳になってから/g];

const FORBIDDEN_TERMS = [
  /\[object Object\]/i, /sourcePayload/i, /\bAI\s*v2\b/i, /\bshadow\b/i, /\bprompt\b/i, /\bmodel\b/i,
  /\braw\b/i, /\bscore\b/i, /\binput\b/i, /\bsource\b/i, /\bheadline\b/i, /\bundefined\b/, /\bnull\b/, /\bNaN\b/,
];

// 漢数字で数値を書いて照合を逃れるケースを不合格にする。
const KANJI_NUMBER_WITH_UNIT = /[〇一二三四五六七八九十百千]+(?:\.[〇一二三四五六七八九]+)?\s*(?:割|%|％|パーセント|円|R|レース|号艇)/;

export function normalizeText(value) {
  let text = String(value ?? "").normalize("NFKC");
  for (const pattern of BOILERPLATE) text = text.replace(pattern, "");
  for (const pattern of TERM_PATTERNS) text = text.replace(pattern, (match) => match.replace(/[0-9]/g, (d) => KANJI_DIGITS[Number(d)]));
  text = text.replace(/#[^\s#]+/g, "");
  text = text.replace(/https?:\/\/\S+/g, "");
  return text;
}

function sameNumber(a, b) {
  const x = Number(a);
  const y = Number(b);
  return Number.isFinite(x) && Number.isFinite(y) && Math.abs(x - y) < 1e-9;
}

// ---- ファクトシート ----

/**
 * facts: [{ labels: ["イン逃げ率", ...], value: "84.2", unit: "%" | "" | "円", boat?: 2 }]
 */
export function buildFactSheet({ date, raceNo, rankNo = null, facts = [], tickets = [] }) {
  const [year, month, day] = String(date || "").split("-").map(Number);
  return {
    year, month, day,
    raceNo: Number(raceNo),
    rankNo: rankNo === null ? null : Number(rankNo),
    tickets: tickets.map((ticket) => normalizeText(ticket).trim()).filter(Boolean),
    facts: facts
      .filter((fact) => fact && fact.value !== null && fact.value !== undefined && fact.value !== "" && Number.isFinite(Number(fact.value)))
      .map((fact) => ({
        ...fact,
        unit: fact.unit || "",
        labels: fact.labels.map((label) => normalizeText(label)).filter(Boolean),
        boat: fact.boat === undefined || fact.boat === null ? null : Number(fact.boat),
      })),
  };
}

// 初音のチェックポイント（例：「2号艇 当地勝率7.40」「2号艇 モーター2連率42.0%」）を艇別ファクトに変換。
const CHECKPOINT_ALIASES = {
  当地勝率: ["当地勝率", "当地"],
  全国勝率: ["全国勝率", "全国"],
  平均ST: ["平均ST", "平均スタート"],
  モーター二連率: ["モーター二連率", "モーター"],
  展示タイム: ["展示タイム"],
  展示ST: ["展示ST"],
  直線: ["直線"],
};

export function parseCheckpointFact(text) {
  const normalized = normalizeText(text).trim();
  const match = normalized.match(/^([1-6])号艇\s*(\S+?)(-?\d+(?:\.\d+)?)(%?)$/);
  if (!match) return null;
  const [, boat, label, value, percent] = match;
  const labels = CHECKPOINT_ALIASES[label];
  if (!labels) return null;
  return { boat: Number(boat), labels, value, unit: percent ? "%" : "" };
}

// ---- 照合 ----

function sentenceBounds(text, index) {
  let start = index;
  while (start > 0 && !SENTENCE_BREAK.test(text[start - 1])) start -= 1;
  let end = index;
  while (end < text.length && !SENTENCE_BREAK.test(text[end])) end += 1;
  return [start, end];
}

function boatMentions(text) {
  const mentions = [];
  for (const match of text.matchAll(/([1-6])\s*号艇?/g)) mentions.push({ boat: Number(match[1]), index: match.index, end: match.index + match[0].length });
  return mentions;
}

function nearestBoat(mentions, index, sentenceStart, sentenceEnd) {
  const before = mentions.filter((m) => m.end <= index && m.index >= sentenceStart).at(-1);
  if (before) return before.boat;
  const after = mentions.find((m) => m.index >= index && m.index <= Math.min(sentenceEnd, index + BOAT_FOLLOW_WINDOW));
  return after ? after.boat : null;
}

function labelBefore(text, index, sentenceStart, labels) {
  const windowText = text.slice(Math.max(sentenceStart, index - LABEL_WINDOW), index);
  return labels.some((label) => windowText.includes(label));
}

function checkMeasured(text, token, unit, sheet, mentions, bounds) {
  const candidates = sheet.facts.filter((fact) => fact.unit === unit && sameNumber(fact.value, token.value));
  if (!candidates.length) return "元データに無い数値";
  const labelled = candidates.filter((fact) => labelBefore(text, token.index, bounds[0], fact.labels));
  if (!labelled.length) return "項目名と数値の対応を確認できない";
  const boat = nearestBoat(mentions, token.index, bounds[0], bounds[1]);
  const ok = labelled.some((fact) => fact.boat === null || fact.boat === boat);
  return ok ? null : "艇番と数値の対応が元データと異なる";
}

function checkYen(text, token, sheet, bounds) {
  const candidates = sheet.facts.filter((fact) => fact.unit === "円" && sameNumber(fact.value, token.value));
  if (!candidates.length) return "元データに無い金額";
  return candidates.some((fact) => labelBefore(text, token.index, bounds[0], fact.labels)) ? null : "金額の項目を確認できない";
}

export function verifyText(rawText, sheet) {
  const violations = [];
  const text = normalizeText(rawText);
  const consumed = [];
  const consume = (start, end) => consumed.push([start, end]);
  const isConsumed = (index) => consumed.some(([start, end]) => index >= start && index < end);
  const fail = (index, reason) => violations.push({ reason, snippet: text.slice(Math.max(0, index - 12), index + 12) });

  for (const pattern of FORBIDDEN_TERMS) {
    const match = text.match(pattern);
    if (match) fail(match.index, `内部用語・不正な値（${match[0]}）`);
  }
  const kanji = text.match(KANJI_NUMBER_WITH_UNIT);
  if (kanji) fail(kanji.index, "漢数字の数値は検証できない");

  // 買い目
  for (const match of text.matchAll(/(?<![\d.])\d+(?:[ \t]?[-=ー−→][ \t]?\d+)+(?![\d.])/g)) {
    const ticket = match[0].replace(/[ \t]+/g, "").replace(/[ー−]/g, "-");
    if (!/^[1-6]-[1-6]-[1-6]$/.test(ticket) || !sheet.tickets.includes(ticket)) fail(match.index, "元データに無い買い目");
    consume(match.index, match.index + match[0].length);
  }
  // 日付
  for (const match of text.matchAll(/(\d{4})年/g)) {
    if (Number(match[1]) !== sheet.year) fail(match.index, "日付（年）が元データと異なる");
    consume(match.index, match.index + match[0].length);
  }
  for (const match of text.matchAll(/(\d{1,2})月(\d{1,2})日/g)) {
    if (Number(match[1]) !== sheet.month || Number(match[2]) !== sheet.day) fail(match.index, "日付が元データと異なる");
    consume(match.index, match.index + match[0].length);
  }
  for (const match of text.matchAll(/(?<![\d.])(\d{1,2})\/(\d{1,2})(?![\d.])/g)) {
    if (Number(match[1]) !== sheet.month || Number(match[2]) !== sheet.day) fail(match.index, "日付が元データと異なる");
    consume(match.index, match.index + match[0].length);
  }

  const mentions = boatMentions(text);
  for (const match of text.matchAll(/\d+(?:\.\d+)?/g)) {
    const index = match.index;
    if (isConsumed(index)) continue;
    const token = { value: match[0], index };
    const after = text.slice(index + match[0].length);
    const bounds = sentenceBounds(text, index);
    let reason = null;
    if (/^\s*号艇?/.test(after)) {
      if (!/^[1-6]$/.test(token.value)) reason = "存在しない艇番";
    } else if (/^\s*(R(?![a-zA-Z])|レース)/.test(after)) {
      if (!sameNumber(token.value, sheet.raceNo)) reason = "レース番号が元データと異なる";
    } else if (/^\s*(%|パーセント)/.test(after)) {
      reason = checkMeasured(text, token, "%", sheet, mentions, bounds);
    } else if (/^\s*円/.test(after)) {
      reason = checkYen(text, token, sheet, bounds);
    } else if (/^\s*点\s*(あたり|\d)/.test(after)) {
      // 「1点100円」「1点あたり」の「1点」は単位の表現。金額側で照合する。
      if (!sameNumber(token.value, 1) || !sheet.tickets.length) reason = "買い目の点数が元データと異なる";
    } else if (/^\s*点/.test(after)) {
      if (!sheet.tickets.length || !sameNumber(token.value, sheet.tickets.length)) reason = "買い目の点数が元データと異なる";
    } else if (/^\s*位/.test(after) || /#\s*$/.test(text.slice(Math.max(0, index - 1), index))) {
      if (sheet.rankNo === null || !sameNumber(token.value, sheet.rankNo)) reason = "順位が元データと異なる";
    } else {
      reason = checkMeasured(text, token, "", sheet, mentions, bounds);
    }
    if (reason) fail(index, reason);
  }
  return violations;
}

/** fields: { 項目名: 文字列 }。戻り値 { ok, violations: [{ field, reason, snippet }] } */
export function verifyNewspaperFields(fields, sheet) {
  if (!sheet || !Number.isFinite(sheet.raceNo) || !sheet.year || !sheet.month || !sheet.day) {
    return { ok: false, violations: [{ field: "*", reason: "ファクトシートが不完全なため検証できない", snippet: "" }] };
  }
  const violations = [];
  for (const [field, value] of Object.entries(fields)) {
    if (value === null || value === undefined) continue;
    if (typeof value !== "string") {
      violations.push({ field, reason: "文字列ではない値は検証できない", snippet: "" });
      continue;
    }
    for (const violation of verifyText(value, sheet)) violations.push({ field, ...violation });
  }
  return { ok: violations.length === 0, violations };
}
