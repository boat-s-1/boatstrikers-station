function ymd(date) {
  return String(date || "").replace(/-/g, "");
}

function numericOrNull(value) {
  const text = String(value ?? "").trim();
  if (!text || text === "-" || text === "─" || text === "—") return null;
  const n = Number(text.replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function htmlToText(html) {
  return String(html || "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?\s*>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/[\u3000\s]+/g, " ")
    .trim();
}

function cellByClass(rowHtml, className) {
  const pattern = new RegExp(`<td\\b([^>]*)class=(['"])([^'"]*\\b${className}\\b[^'"]*)\\2[^>]*>([\\s\\S]*?)<\\/td>`, "i");
  const match = String(rowHtml || "").match(pattern);
  return match ? { attrs: match[1] + ` class=${match[2]}${match[3]}${match[2]}`, text: htmlToText(match[4]) } : null;
}

export function parseAmagasakiOfficialOriginalTenji(html) {
  const table = String(html || "").match(/<table\b[^>]*class=(['"])[^'"]*\btbl_oriten\b[^'"]*\1[^>]*>[\s\S]*?<\/table>/i)?.[0] || "";
  const header = htmlToText(table.match(/<thead\b[^>]*>([\s\S]*?)<\/thead>/i)?.[1] || "");
  if (!table || !header.includes("展示 タイム") || !header.includes("一周") || !header.includes("まわり足")) return [];
  const rows = [];
  for (const match of table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const row = match[1], boat = cellByClass(row, "col1");
    if (!boat || !/\btei_color([1-6])\b/.test(boat.attrs)) continue;
    const boatNo = Number(boat.text), color = Number(boat.attrs.match(/\btei_color([1-6])\b/)?.[1]);
    const exhibitionTime = numericOrNull(cellByClass(row, "col4")?.text);
    const lapTime = numericOrNull(cellByClass(row, "col5")?.text);
    const turnTime = numericOrNull(cellByClass(row, "col6")?.text);
    if (boatNo !== color || exhibitionTime < 4 || exhibitionTime > 12 || lapTime < 25 || lapTime > 60 || turnTime < 2 || turnTime > 20) return [];
    rows.push({
      boatNo,
      exhibitionTime,
      lapTime,
      turnTime,
      straightTime: null,
    });
  }
  const unique = [...new Map(rows.map((row) => [row.boatNo, row])).values()].sort((a, b) => a.boatNo - b.boatNo);
  return unique.length === 6 && unique.every((row, index) => row.boatNo === index + 1) ? unique : [];
}

export async function fetchAmagasakiOfficialOriginalTenji(race, options = {}) {
  const raceDate = ymd(race?.raceDate);
  const raceNo = Number(race?.raceNo);
  if (!/^\d{8}$/.test(raceDate) || !(raceNo >= 1 && raceNo <= 12)) {
    return { ok: false, supported: true, source: "amagasaki_official", rows: [], error: "invalid_race" };
  }

  const url = `https://www.boatrace-amagasaki.jp/sp/ajax/ajax_yosou.php?targetday=${raceDate}&race=${raceNo}&req=cyokuzen&run=0`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs || 7000);
  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "user-agent": "BoatStrikers/1.0 (+https://www.boat-strike.online/)",
        accept: "text/html,*/*;q=0.8",
        "accept-language": "ja,en-US;q=0.8,en;q=0.6",
        referer: "https://www.boatrace-amagasaki.jp/sp/index.php",
      },
    });
    if (!response.ok) {
      return { ok: false, supported: true, source: "amagasaki_official", rows: [], status: response.status, error: "http_error", url };
    }
    const html = await response.text();
    const identityOk = new RegExp(`<a\\b[^>]*class=['"][^'"]*\\bselected\\b[^'"]*['"][^>]*data-day=['"]${raceDate}['"][^>]*data-race=['"]${raceNo}['"][^>]*data-run=['"]0['"][^>]*data-req=['"]cyokuzen['"][^>]*>`, "i").test(html);
    if (!identityOk) {
      return { ok: false, supported: true, source: "amagasaki_official", sourceLabel: "BOAT RACE尼崎公式", rows: [], status: response.status, published: false, error: "source_identity_mismatch", url };
    }
    const rows = parseAmagasakiOfficialOriginalTenji(html);
    if (rows.length !== 6) {
      return { ok: false, supported: true, source: "amagasaki_official", sourceLabel: "BOAT RACE尼崎公式", rows: [], status: response.status, published: false, error: "official_original_tenji_not_available", url };
    }
    return {
      ok: true,
      supported: true,
      source: "amagasaki_official",
      sourceLabel: "BOAT RACE尼崎公式",
      rows,
      status: response.status,
      published: true,
      identity: { verified: true, courseCode: 13, raceDate: race.raceDate, raceNo, evidence: "official_selected_date_race_plus_six_boat_classes" },
      eligibleTheories: { ichika: true, hatsune: true, kiina: false },
      url,
    };
  } catch (error) {
    return { ok: false, supported: true, source: "amagasaki_official", rows: [], error: error?.name === "AbortError" ? "timeout" : error?.message || "fetch failed", url };
  } finally {
    clearTimeout(timer);
  }
}
