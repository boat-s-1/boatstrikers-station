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

function parseTableRows(html) {
  const rows = [];
  for (const rowMatch of String(html || "").matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...rowMatch[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((m) => cellText(m[1]));
    if (cells.length) rows.push(cells);
  }
  return rows;
}

function findOriginalTable(html) {
  const source = String(html || "");
  const keywords = ["まわり足", "一周", "直線", "オリジナル展示"];
  let index = -1;
  for (const keyword of keywords) {
    const hit = source.indexOf(keyword);
    if (hit >= 0 && (index < 0 || hit < index)) index = hit;
  }
  if (index < 0) return "";
  const tableStart = source.lastIndexOf("<table", index);
  const tableEnd = source.indexOf("</table>", index);
  if (tableStart < 0 || tableEnd < 0) return "";
  return source.slice(tableStart, tableEnd + 8);
}

export function parseTsuOfficialOriginalTenji(html) {
  const table = findOriginalTable(html);
  if (!table) return [];

  const rows = [];
  for (const cells of parseTableRows(table)) {
    const boatNo = Number(cells[0]);
    if (!(boatNo >= 1 && boatNo <= 6)) continue;

    const nums = cells.map(numericOrNull);
    const lapIndex = nums.findIndex((value, index) => index > 0 && value !== null && value >= 30 && value <= 45);
    if (lapIndex < 0) continue;

    let exhibitionTime = null;
    for (let i = lapIndex - 1; i >= 1; i -= 1) {
      const value = nums[i];
      if (value !== null && value >= 6 && value <= 8) {
        exhibitionTime = value;
        break;
      }
    }

    const afterLap = nums.slice(lapIndex + 1).filter((value) => value !== null && value >= 4 && value <= 9);
    const lapTime = nums[lapIndex];
    const turnTime = afterLap[0] ?? null;
    const straightTime = afterLap[1] ?? null;

    if (lapTime === null || turnTime === null || straightTime === null) continue;
    rows.push({ boatNo, exhibitionTime, lapTime, turnTime, straightTime });
  }

  return [...new Map(rows.map((row) => [row.boatNo, row])).values()].sort((a, b) => a.boatNo - b.boatNo);
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

  const url = `https://www.boatrace-tsu.com/sp/index.php?page=yosou-yosou&race=${raceNo}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 7000);
  try {
    const response = await fetch(url, {
      cache: "no-store",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; BoatStrikers/1.0; +https://www.boat-strike.online/)",
        accept: "text/html,application/xhtml+xml",
        "accept-language": "ja,en-US;q=0.8,en;q=0.6",
      },
    });
    if (!response.ok) return { ok: false, supported: true, source: "tsu_official", rows: [], status: response.status, url, error: `http_${response.status}` };
    const html = await response.text();
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
      error: rows.length === 6 ? null : "official_original_tenji_not_available",
    };
  } catch (error) {
    return { ok: false, supported: true, source: "tsu_official", rows: [], url, error: error?.name === "AbortError" ? "timeout" : error?.message || "fetch failed" };
  } finally {
    clearTimeout(timeout);
  }
}
