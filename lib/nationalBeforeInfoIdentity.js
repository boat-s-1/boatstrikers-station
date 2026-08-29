const clean = (value) => String(value || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;|&#160;/gi, " ").replace(/\s+/g, " ").trim();
const cells = (row) => [...String(row || "").matchAll(/<td\b([^>]*)>([\s\S]*?)<\/td>/gi)];
const headers = (table) => [...((table.match(/<thead\b[^>]*>([\s\S]*?)<\/thead>/i)?.[1]) || "").matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/gi)].map((match) => clean(match[1])).join("|");
const number = (value) => /^\d{1,2}\.\d{2}$/.test(clean(value)) ? Number(clean(value)) : null;

export function verifyNationalBeforeInfo(html, race) {
  const courseCode = Number(race?.courseCode), raceNo = Number(race?.raceNo), raceDate = String(race?.raceDate || "");
  if (!(courseCode >= 1 && courseCode <= 24) || !(raceNo >= 1 && raceNo <= 12) || !/^20\d{2}-\d{2}-\d{2}$/.test(raceDate)) return { ok: false, error: "invalid_race", rows: [] };
  const day = raceDate.replaceAll("-", ""), jcd = String(courseCode).padStart(2, "0");
  if (!new RegExp(`<img[^>]*text_place2_${jcd}\\.png`, "i").test(html)) return { ok: false, error: "source_venue_mismatch", rows: [] };
  const selected = [...html.matchAll(/<th\s*>\s*<a\s+href="([^"]+)"[^>]*>\s*\d+R\s*<\/a>\s*<\/th>/g)];
  if (selected.length !== 1) return { ok: false, error: "reference_identity_missing", rows: [] };
  const url = new URL(selected[0][1].replaceAll("&amp;", "&"), "https://www.boatrace.jp");
  if (url.origin !== "https://www.boatrace.jp" || url.pathname !== "/owpc/pc/race/beforeinfo" || url.searchParams.get("hd") !== day || url.searchParams.get("jcd") !== jcd || url.searchParams.get("rno") !== String(raceNo)) return { ok: false, error: "reference_identity_mismatch", rows: [] };
  const active = html.match(/<li class="is-active2">\s*<span class="tab2_inner">(\d+)月(\d+)日/);
  if (Number(active?.[1]) !== Number(raceDate.slice(5, 7)) || Number(active?.[2]) !== Number(raceDate.slice(8))) return { ok: false, error: "reference_date_mismatch", rows: [] };
  const tables = [...html.matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)].map((match) => match[0]);
  const table = tables.filter((item) => headers(item) === "枠|写真|ボートレーサー|体重|展示 タイム|チルト|プロペラ|部品交換|前走成績|調整重量");
  if (table.length !== 1) return { ok: false, error: "reference_row_changed", rows: [] };
  const rows = [];
  for (const match of table[0].matchAll(/<tbody\b[^>]*>([\s\S]*?)<\/tbody>/gi)) {
    const first = match[1].match(/<tr\b[^>]*>([\s\S]*?)<\/tr>/i)?.[1] || "", rowCells = cells(first);
    if (rowCells.length !== 10) return { ok: false, error: "reference_row_changed", rows: [] };
    const boat = clean(rowCells[0][2]), color = rowCells[0][1].match(/\bis-boatColor([1-6])\b/)?.[1];
    const ids = [...rowCells[1][2].concat(rowCells[2][2]).matchAll(/profile\?toban=(\d{4})/g)].map((item) => item[1]);
    const exhibitionTime = number(rowCells[4][2]);
    if (!/^[1-6]$/.test(boat) || boat !== color || ids.length !== 2 || ids[0] !== ids[1] || exhibitionTime === null) return { ok: false, error: "reference_boat_identity_invalid", rows: [] };
    rows.push({ boatNo: Number(boat), racerNo: ids[0], exhibitionTime });
  }
  if (rows.length !== 6 || new Set(rows.map((row) => row.boatNo)).size !== 6 || new Set(rows.map((row) => row.racerNo)).size !== 6) return { ok: false, error: "six_unique_boats_required", rows: [] };
  return { ok: true, rows: rows.sort((a, b) => a.boatNo - b.boatNo) };
}

export async function fetchNationalBeforeInfo(race, options = {}) {
  const day = String(race?.raceDate || "").replaceAll("-", ""), raceNo = Number(race?.raceNo), jcd = String(Number(race?.courseCode)).padStart(2, "0");
  const url = `https://www.boatrace.jp/owpc/pc/race/beforeinfo?rno=${raceNo}&jcd=${jcd}&hd=${day}`;
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), Math.min(12000, Math.max(1000, Number(options.timeoutMs) || 10000)));
  try {
    const response = await fetch(url, { cache: "no-store", redirect: "manual", signal: controller.signal, headers: { "user-agent": "BoatStrikers/1.0 (+https://www.boat-strike.online/)" } });
    if (!response.ok) { await response.body?.cancel(); return { ok: false, error: "upstream_http_error", rows: [], url }; }
    const html = await response.text();
    return { ...verifyNationalBeforeInfo(html, race), url };
  } catch (error) {
    return { ok: false, error: error?.name === "AbortError" ? "upstream_timeout" : "upstream_fetch_failed", rows: [], url };
  } finally {
    controller.abort();
    clearTimeout(timer);
  }
}
