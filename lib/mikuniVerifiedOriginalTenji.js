import { fetchNationalBeforeInfo } from "./nationalBeforeInfoIdentity.js";

const clean = (value) => String(value || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;|&#160;/gi, " ").replace(/\s+/g, " ").trim();
const fail = (error) => ({ ok: false, supported: true, published: false, source: "mikuni_official_verified", sourceLabel: "BOAT RACE三国公式", rows: [], error });
const numeric = (value) => /^\d{1,2}\.\d{2}$/.test(clean(value)) ? Number(clean(value)) : null;

function cellByClass(rowHtml, className) {
  const pattern = new RegExp(`<td\\b[^>]*class=(['"])[^'"]*\\b${className}\\b[^'"]*\\1[^>]*>([\\s\\S]*?)<\\/td>`, "i");
  const match = String(rowHtml || "").match(pattern);
  return match ? clean(match[2]) : null;
}

export function parseMikuniOfficialOriginalTenji(html) {
  const source = String(html || "");
  const tables = [...source.matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)].map((match) => match[0]);
  const matches = tables.filter((table) => /<th\b[^>]*class=(['"])[^'"]*\bhalf-rap-time\b[^'"]*\1/i.test(table));
  const parsed = matches.map((table) => {
    const header = clean(table.match(/<thead\b[^>]*>([\s\S]*?)<\/thead>/i)?.[1] || "");
    if (!/<th\b[^>]*class=(['"])[^'"]*\bcurve-time\b[^'"]*\1/i.test(table)
      || !/<th\b[^>]*class=(['"])[^'"]*\bextension-time\b[^'"]*\1/i.test(table)
      || !header.includes("半周ﾗｯﾌﾟ") || !header.includes("まわり足") || !header.includes("直線")) return [];
    const rows = [];
    for (const match of table.matchAll(/<tr\b[^>]*class=(['"])[^'"]*\bframe([1-6])\b[^'"]*\1[^>]*>([\s\S]*?)<\/tr>/gi)) {
      const classBoat = Number(match[2]), row = match[3], boatText = cellByClass(row, "frame-no");
      if (boatText === null) continue;
      const boatNo = Number(boatText), racerNo = cellByClass(row, "racer-no");
      const halfLapTime = numeric(cellByClass(row, "half-rap-time"));
      const turnTime = numeric(cellByClass(row, "curve-time"));
      const straightTime = numeric(cellByClass(row, "extension-time"));
      if (boatNo !== classBoat || !/^\d{4}$/.test(racerNo || "") || halfLapTime < 10 || halfLapTime > 25 || turnTime < 2 || turnTime > 20 || straightTime < 2 || straightTime > 20) return [];
      rows.push({ boatNo, racerNo, exhibitionTime: null, lapTime: null, halfLapTime, turnTime, straightTime });
    }
    const unique = [...new Map(rows.map((row) => [row.boatNo, row])).values()].sort((a, b) => a.boatNo - b.boatNo);
    return unique.length === 6 && unique.every((row, index) => row.boatNo === index + 1) && new Set(unique.map((row) => row.racerNo)).size === 6 ? unique : [];
  }).filter((rows) => rows.length === 6);
  if (!parsed.length) return [];
  const signature = (rows) => JSON.stringify(rows.map(({ boatNo, racerNo, halfLapTime, turnTime, straightTime }) => [boatNo, racerNo, halfLapTime, turnTime, straightTime]));
  return parsed.every((rows) => signature(rows) === signature(parsed[0])) ? parsed[0] : [];
}

function jstToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export async function fetchMikuniVerifiedOriginalTenji(race, options = {}) {
  const raceDate = String(race?.raceDate || ""), raceNo = Number(race?.raceNo);
  if (Number(race?.courseCode) !== 10 || raceDate !== jstToday() || !(raceNo >= 1 && raceNo <= 12)) return fail("mikuni_current_day_only");
  // The venue exposes only the currently selected race at /races.
  // The six racer numbers are matched to the requested national race below.
  const url = "https://www.mikuniks-web.jp/races";
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), Math.min(12000, Math.max(1000, Number(options.timeoutMs) || 10000)));
  try {
    const [response, reference] = await Promise.all([
      fetch(url, { cache: "no-store", redirect: "manual", signal: controller.signal, headers: { "user-agent": "BoatStrikers-ExhibitionDiagnostic/1.0", "x-requested-with": "XMLHttpRequest", referer: "https://www.mikuniks-web.jp/" } }),
      fetchNationalBeforeInfo(race, { ...options, timeoutMs: Math.min(10000, Number(options.timeoutMs) || 9000) }),
    ]);
    if (!response.ok) { await response.body?.cancel(); return { ...fail("upstream_http_error"), status: response.status, url, referenceUrl: reference.url }; }
    const html = await response.text();
    if (!/<title>\s*BOAT RACE 三国 #10 /i.test(html)) return { ...fail("source_venue_mismatch"), url, referenceUrl: reference.url };
    const rows = parseMikuniOfficialOriginalTenji(html);
    if (rows.length !== 6) return { ...fail("official_original_tenji_not_available"), url, referenceUrl: reference.url };
    if (!reference.ok) return { ...fail(reference.error || "reference_identity_missing"), url, referenceUrl: reference.url };
    for (const row of rows) {
      const expected = reference.rows.find((item) => item.boatNo === row.boatNo);
      if (!expected || expected.racerNo !== row.racerNo) return { ...fail("roster_or_exhibition_mismatch"), url, referenceUrl: reference.url };
    }
    return {
      ok: true, supported: true, published: true, source: "mikuni_official_verified", sourceLabel: "BOAT RACE三国公式",
      rows, url, referenceUrl: reference.url,
      identity: { verified: true, courseCode: 10, raceDate, raceNo, evidence: "current_official_race_plus_six_boat_racer_matches_national_reference" },
      eligibleTheories: { ichika: false, hatsune: false, kiina: true },
    };
  } catch (error) {
    return { ...fail(error?.name === "AbortError" ? "upstream_timeout" : "upstream_fetch_failed"), url };
  } finally {
    controller.abort();
    clearTimeout(timer);
  }
}
