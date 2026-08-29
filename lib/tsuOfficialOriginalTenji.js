function decodeHtml(value) {
  return String(value || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"');
}

function cellText(html) {
  return decodeHtml(String(html || "").replace(/<br\s*\/?\s*>/gi, " ").replace(/<[^>]+>/g, " "))
    .replace(/[\u3000\s]+/g, " ")
    .trim();
}

function numericOrNull(value) {
  const text = String(value ?? "").trim();
  if (!text || ["-", "─", "—", "-.--", "-.-"].includes(text)) return null;
  const n = Number(text.replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function cellByClass(rowHtml, className) {
  const pattern = new RegExp(`<td\\b([^>]*)class=(['"])([^'"]*\\b${className}\\b[^'"]*)\\2[^>]*>([\\s\\S]*?)<\\/td>`, "i");
  const match = String(rowHtml || "").match(pattern);
  return match ? { attrs: match[1] + ` class=${match[2]}${match[3]}${match[2]}`, text: cellText(match[4]) } : null;
}

export function parseTsuOfficialOriginalTenji(html) {
  const table = String(html || "").match(/<table\b[^>]*class=(['"])[^'"]*\btbl_oriten\b[^'"]*\1[^>]*>[\s\S]*?<\/table>/i)?.[0] || "";
  const header = cellText(table.match(/<thead\b[^>]*>([\s\S]*?)<\/thead>/i)?.[1] || "");
  if (!table || !header.includes("展示 タイム") || !header.includes("一周") || !header.includes("まわり 足") || !header.includes("直線")) return [];
  const rows = [];
  for (const match of table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const row = match[1], boat = cellByClass(row, "col1");
    if (!boat || !/\btei_color([1-6])\b/.test(boat.attrs)) continue;
    const boatNo = Number(boat.text), color = Number(boat.attrs.match(/\btei_color([1-6])\b/)?.[1]);
    const exhibitionTime = numericOrNull(cellByClass(row, "col4")?.text);
    const lapTime = numericOrNull(cellByClass(row, "col5")?.text);
    const turnTime = numericOrNull(cellByClass(row, "col6")?.text);
    const straightTime = numericOrNull(cellByClass(row, "col7")?.text);
    if (boatNo !== color || exhibitionTime < 4 || exhibitionTime > 12 || lapTime < 25 || lapTime > 60 || turnTime < 2 || turnTime > 20 || straightTime < 2 || straightTime > 20) return [];
    rows.push({ boatNo, exhibitionTime, lapTime, turnTime, straightTime });
  }
  const unique = [...new Map(rows.map((row) => [row.boatNo, row])).values()].sort((a, b) => a.boatNo - b.boatNo);
  return unique.length === 6 && unique.every((row, index) => row.boatNo === index + 1) ? unique : [];
}

function jstToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export async function fetchTsuOfficialOriginalTenji(race, options = {}) {
  const raceDate = String(race?.raceDate || "");
  const raceNo = Number(race?.raceNo);
  if (raceDate !== jstToday() || !(raceNo >= 1 && raceNo <= 12)) {
    return { ok: false, supported: true, source: "tsu_official", rows: [], error: "tsu_current_day_only" };
  }

  const day = raceDate.replaceAll("-", "");
  const url = `https://www.boatrace-tsu.com/sp/ajax/ajax_yosou.php?targetday=${day}&race=${raceNo}&req=sttenji&run=0`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 7000);
  try {
    const response = await fetch(url, {
      cache: "no-store",
      redirect: "manual",
      signal: controller.signal,
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; BoatStrikers/1.0; +https://www.boat-strike.online/)",
        accept: "text/html,application/xhtml+xml",
        "accept-language": "ja,en-US;q=0.8,en;q=0.6",
        "x-requested-with": "XMLHttpRequest",
        referer: "https://www.boatrace-tsu.com/",
      },
    });
    if (!response.ok) return { ok: false, supported: true, source: "tsu_official", rows: [], status: response.status, url, error: `http_${response.status}` };
    const html = await response.text();
    const identityOk = new RegExp(`<a\\b[^>]*class=['"][^'"]*\\bselected\\b[^'"]*['"][^>]*data-day=['"]${day}['"][^>]*data-race=['"]${raceNo}['"][^>]*data-run=['"]0['"][^>]*data-req=['"]sttenji['"][^>]*>`, "i").test(html);
    if (!identityOk) return { ok: false, supported: true, source: "tsu_official", sourceLabel: "BOAT RACE津公式", rows: [], status: response.status, url, published: false, error: "source_identity_mismatch" };
    const rows = parseTsuOfficialOriginalTenji(html);
    return {
      ok: rows.length === 6,
      supported: true,
      source: "tsu_official",
      sourceLabel: "BOAT RACE津公式",
      rows,
      status: response.status,
      url,
      published: rows.length === 6,
      identity: rows.length === 6 ? { verified: true, courseCode: 9, raceDate, raceNo, evidence: "official_selected_date_race_plus_six_boat_classes" } : null,
      eligibleTheories: { ichika: true, hatsune: true, kiina: true },
      error: rows.length === 6 ? null : "official_original_tenji_not_available",
    };
  } catch (error) {
    return { ok: false, supported: true, source: "tsu_official", rows: [], url, error: error?.name === "AbortError" ? "timeout" : error?.message || "fetch failed" };
  } finally {
    clearTimeout(timeout);
  }
}
