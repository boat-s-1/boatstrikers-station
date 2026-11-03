// Structured reading of the BOAT RACE official stadium data page (https://www.boatrace.jp/owpc/pc/data/stadium?jcd=NN),
// from the text stored in blog_source_documents.extracted_text (one table cell per line).
// The reader is strict: if the page layout is not exactly the expected one it returns { ok: false, reason } and no
// numbers at all, so nothing is ever guessed from a changed table.

const PLACES = ["1着", "2着", "3着", "4着", "5着", "6着"];
const KIMARITE = ["逃げ", "捲り", "差し", "捲り差し", "抜き", "恵まれ"];
const RATE = /^\d{1,3}\.\d$/;
const PERIOD = /^\(集計期間:(\d{4})\/(\d{2})\/(\d{2})[~〜](\d{4})\/(\d{2})\/(\d{2}) *単位:%\)$/;
const SEASONS = ["春季", "夏季", "秋季", "冬季"];
const WATER_TYPES = ["淡水", "海水", "汽水"];
// Each course's placement rates and each of the 1st–3rd place columns are shares of 100%; rounding and races with
// fewer finishers keep the sums slightly off 100. Anything further off is not this table.
const SUM_TOLERANCE = 3;

const fail = reason => ({ ok: false, reason });
const lines = text => String(text ?? "").normalize("NFKC").split("\n").map(l => l.replace(/\s+/g, " ").trim()).filter(Boolean);
const compact = value => value.replace(/\s+/g, "");

export function stadiumDataUrl(stadium) {
  return `https://www.boatrace.jp/owpc/pc/data/stadium?jcd=${String(stadium.courseCode).padStart(2, "0")}`;
}

export function isStadiumDataUrl(url, stadium) {
  return Boolean(stadium) && String(url) === stadiumDataUrl(stadium);
}

export function formatPeriod(period) {
  return `${period.from}〜${period.to}`;
}

function period(line) {
  const m = PERIOD.exec(line ?? "");
  return m ? { from: `${m[1]}/${m[2]}/${m[3]}`, to: `${m[4]}/${m[5]}/${m[6]}` } : null;
}

// rows of [course, ...6 placement rates (, ...6 kimarite rates)] following the header at index start.
function readTable(tokens, start, header, cells, label) {
  for (let i = 0; i < header.length; i++) if (tokens[start + i] !== header[i]) return fail(`${label}：表の見出しが想定と異なります（${tokens[start + i] ?? "なし"}）。`);
  let at = start + header.length;
  const rows = [];
  for (let course = 1; course <= 6; course++) {
    if (tokens[at] !== String(course)) return fail(`${label}：${course}コースの行が見つかりません。`);
    const values = tokens.slice(at + 1, at + 1 + cells);
    if (values.length !== cells || !values.every(v => RATE.test(v) && Number(v) <= 100)) return fail(`${label}：${course}コースの数値が想定の形式ではありません。`);
    rows.push({ course, rates: values.slice(0, 6) }); // as printed on the page, e.g. "5.0"
    at += 1 + cells;
  }
  const p = period(tokens[at]);
  if (!p) return fail(`${label}：集計期間が見つかりません。`);
  for (const row of rows) {
    const sum = row.rates.reduce((a, b) => a + Number(b), 0);
    if (Math.abs(sum - 100) > SUM_TOLERANCE) return fail(`${label}：${row.course}コースの入着率の合計が100%になりません（${sum.toFixed(1)}%）。`);
  }
  // Every race has 1st–3rd places; lower places are missing when boats do not finish, so only these columns add up.
  for (let place = 0; place < 3; place++) {
    const sum = rows.reduce((a, row) => a + Number(row.rates[place]), 0);
    if (Math.abs(sum - 100) > SUM_TOLERANCE) return fail(`${label}：${place + 1}着率の合計が100%になりません（${sum.toFixed(1)}%）。`);
  }
  return { ok: true, table: { label, period: p, rows }, end: at + 1 };
}

// Returns { ok: true, recent, seasons, memo } or { ok: false, reason }.
//   recent:  コース別入着率 of the latest period shown on the page ("最近3ヶ月のデータ")
//   seasons: seasonal tables that could be read (each with its own period); unreadable ones are listed in skipped
//   memo:    水質 / 干満差 when present in the expected form
export function parseStadiumDataPage(text, stadium) {
  const tokens = lines(text);
  if (!stadium) return fail("場が指定されていません。");
  if (!tokens.some(t => compact(t) === `${stadium.name}ボートレース場`)) return fail(`${stadium.name}のページであることを確認できません。`);
  const start = tokens.indexOf("コース別入着率&決まり手");
  if (start < 0) return fail("「コース別入着率＆決まり手」の表が見つかりません。");
  const recent = readTable(tokens, start + 1, ["コース", ...PLACES, "コース別決まり手", ...KIMARITE], 12, "最近3ヶ月");
  if (!recent.ok) return recent;

  const seasons = [], skipped = [];
  for (const season of SEASONS) {
    const at = tokens.indexOf(`${season} のコース別入着率`);
    if (at < 0) continue;
    const table = readTable(tokens, at + 1, ["コース", ...PLACES], 6, season);
    if (table.ok) seasons.push(table.table); else skipped.push(table.reason);
  }

  const memo = {};
  const memoAt = tokens.indexOf("MEMO");
  if (memoAt >= 0) {
    const after = tokens.slice(memoAt);
    const water = after[after.indexOf("水質") + 1];
    if (after.includes("水質") && WATER_TYPES.includes(water)) memo.waterType = water;
    const tide = after[after.indexOf("干満差") + 1];
    if (after.includes("干満差") && tide && tide.length <= 20 && !/^\d/.test(tide) && tide !== "レコード") memo.tide = tide;
  }
  return { ok: true, recent: recent.table, seasons, skipped, memo };
}

// Table cells and their periods are delivered only as structured facts; the free text given to the AI keeps the
// page's wording (headings, memo) but no bare numeric cells or table periods, so neither a number nor a period can
// be read from a misaligned table or attached to the wrong one.
export function withoutTableCells(text) {
  return lines(text).filter(t => !/^\d+(?:\.\d+)?$/.test(t) && !/^\(集計期間:/.test(t)).join("\n");
}
