// 出典の見出し・要約から、事実の材料にできる文だけを取り出す（純粋関数・DB を読まない）。
// 出典サイトの宣伝文、URL、時刻、途中で切れた文、収集時に付いた定型文はここで除く。

import { cleanNewsHeadline } from "../newsTaxonomy.js";

// 収集処理や旧テンプレートが付けた定型文（記事の事実ではない）。
const PROMO_RE = /女子ボートレース関連ニュース|初音NEWS|初音の視点|元記事の内容を転載せず|要点をまとめます|女子戦をチェックするうえで|女子ボートレースを追ううえで|転載するのではなく|出典元もあわせてご確認|記事末尾の出典|BoatStrikersでは、公式・報道情報/;
// 出典サイトの名前・宣伝の後置き。
const SITE_TAIL_RES = [
  /\s*[-–]\s*日刊スポーツ新聞社のニュースサイト.*$/s,
  /\s*[-–]\s*ボート\s*[:：]\s*日刊スポーツ\s*$/,
  /\s*[|｜]\s*ボートレース（競艇）\s*【マクール】.*$/s,
];
const URL_RE = /https?:\/\/\S+/g;
const CLOCK_RE = /\[\d{1,2}:\d{2}\]/g;
const TRUNCATED_RE = /(?:…|\.\.\.)\s*$/;

export const VENUES = ["桐生", "戸田", "江戸川", "平和島", "多摩川", "浜名湖", "蒲郡", "常滑", "津", "三国", "びわこ", "住之江", "尼崎", "鳴門", "丸亀", "児島", "宮島", "徳山", "下関", "若松", "芦屋", "福岡", "唐津", "大村"];
export const VENUE_CODES = Object.fromEntries(VENUES.map((name, index) => [name, index + 1]));

// 全角英数字・記号を半角にそろえる（抽出用。表示文はスロットから組み立て直す）。
export function normalizeText(value) {
  return String(value || "")
    .replace(/G([ⅠⅡⅢ])/g, (match, numeral) => `G${{ "Ⅰ": 1, "Ⅱ": 2, "Ⅲ": 3 }[numeral]}`)
    .normalize("NFKC").replace(/[ \t　]+/g, " ").trim();
}

// 「」『』の中では区切らずに、。！？で文に分ける。
export function splitSentences(text) {
  const sentences = [];
  let depth = 0;
  let current = "";
  for (const char of String(text || "")) {
    current += char;
    if (char === "「" || char === "『") depth += 1;
    else if ((char === "」" || char === "』") && depth > 0) depth -= 1;
    else if (depth === 0 && /[。！？!?]/.test(char)) {
      sentences.push(current.trim());
      current = "";
    }
  }
  if (current.trim()) sentences.push(current.trim());
  return sentences.filter(Boolean);
}

function hasOpenQuote(sentence) {
  const open = (sentence.match(/[「『]/g) || []).length;
  const close = (sentence.match(/[」』]/g) || []).length;
  return open > close;
}

// 要約の掃除。戻り値の sentences は「出典で確認できる完結した文」だけ。
export function cleanSourceSummary(value) {
  const removed = [];
  let text = normalizeText(value).replace(URL_RE, () => {
    removed.push("url");
    return "";
  });
  text = text.replace(CLOCK_RE, "").replace(/ {2,}/g, " ");
  for (const re of SITE_TAIL_RES) {
    if (re.test(text)) {
      removed.push("site_tail");
      text = text.replace(re, "");
    }
  }
  const truncated = TRUNCATED_RE.test(text);
  const sentences = [];
  const parts = splitSentences(text);
  parts.forEach((sentence, index) => {
    const isLast = index === parts.length - 1;
    if (PROMO_RE.test(sentence)) return removed.push("promo");
    // 途中で切れた最後の文（「…」で終わる、または句点がない）と、閉じていない談話は使わない。
    if (isLast && (truncated || !/[。！？!?」』]$/.test(sentence))) return removed.push("truncated");
    if (hasOpenQuote(sentence)) return removed.push("open_quote");
    sentences.push(sentence);
  });
  return { sentences, truncated, removed };
}

// 見出しを「本文」と「開催表記（／の後ろ）」に分ける。
export function splitHeadline(row) {
  const headline = normalizeText(cleanNewsHeadline(row?.title || row?.list_headline)).replace(CLOCK_RE, "").trim();
  const match = headline.match(/^(.*?)[／/]([^／/]{1,24})$/);
  const main = (match ? match[1] : headline).trim();
  const eventLabel = match ? match[2].replace(/ボート$/, "").trim() : "";
  return { headline, main, eventLabel };
}

// 見出し・要約・地名欄から開催場を1つに決める。複数の場名が出てくる場合は見出しの開催表記を優先する。
export function detectVenue(row, { eventLabel = "", text = "" } = {}) {
  const fromLabel = VENUES.find((venue) => eventLabel.startsWith(venue));
  if (fromLabel) return fromLabel;
  const place = normalizeText(row?.place);
  if (VENUE_CODES[place]) return place;
  const fromTitle = VENUES.find((venue) => normalizeText(row?.title).startsWith(venue));
  if (fromTitle) return fromTitle;
  const mentioned = VENUES.filter((venue) => new RegExp(`(?:ボートレース)?${venue}(?:の|で|・|G|周年|。|$)`).test(text));
  return mentioned.length === 1 ? mentioned[0] : "";
}

// 選手名の異体字（報道と公式で表記が分かれやすいもの）。照合のときだけ同一視する。
const NAME_VARIANTS = { 瀧: "滝", 齊: "斉", 齋: "斉", 斎: "斉", 邊: "辺", 邉: "辺", 髙: "高", 﨑: "崎", 嵜: "崎", 澤: "沢", 嶋: "島", 濱: "浜", 櫻: "桜", 廣: "広", 國: "国", 冨: "富", 惠: "恵", 眞: "真", 德: "徳" };
const NAME_VARIANT_RE = new RegExp(`[${Object.keys(NAME_VARIANTS).join("")}]`, "g");

export function foldNameVariants(value) {
  return String(value || "").replace(/[\s\u3000]+/g, "").replace(NAME_VARIANT_RE, (char) => NAME_VARIANTS[char]);
}

export function isPromoText(value) {
  return PROMO_RE.test(String(value || ""));
}
