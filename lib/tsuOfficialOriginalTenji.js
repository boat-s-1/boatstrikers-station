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

function cookieHeader(response) {
  const values = typeof response?.headers?.getSetCookie === "function"
    ? response.headers.getSetCookie()
    : [response?.headers?.get?.("set-cookie")].filter(Boolean);
  return values
    .map((value) => String(value).split(";", 1)[0].trim())
    .filter(Boolean)
    .join("; ");
}

async function fetchTsuText(url, { timeoutMs, cookie = "", referer = "https://www.boatrace-tsu.com/", redirect = "manual" }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      cache: "no-store",
      redirect,
      signal: controller.signal,
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; BoatStrikers/1.0; +https://www.boat-strike.online/)",
        accept: "text/html,application/xhtml+xml",
        "accept-language": "ja,en-US;q=0.8,en;q=0.6",
        "cache-control": "no-cache",
        pragma: "no-cache",
        "x-requested-with": "XMLHttpRequest",
        referer,
        ...(cookie ? { cookie } : {}),
      },
    });
    const text = await response.text();
    return { ok: response.ok, status: response.status, text, cookie: cookieHeader(response) };
  } catch (error) {
    return { ok: false, status: null, text: "", cookie: "", error: error?.name === "AbortError" ? "timeout" : error?.message || "fetch failed" };
  } finally {
    clearTimeout(timer);
  }
}

function parseTsuResponse(fetched, { day, raceNo }) {
  if (!fetched.ok) return { ok: false, rows: [], error: fetched.error || `http_${fetched.status}` };
  const identityOk = new RegExp(`<a\\b[^>]*class=['"][^'"]*\\bselected\\b[^'"]*['"][^>]*data-day=['"]${day}['"][^>]*data-race=['"]${raceNo}['"][^>]*data-run=['"]0['"][^>]*data-req=['"]sttenji['"][^>]*>`, "i").test(fetched.text);
  if (!identityOk) return { ok: false, rows: [], error: "source_identity_mismatch" };
  const rows = parseTsuOfficialOriginalTenji(fetched.text);
  return { ok: rows.length === 6, rows, error: rows.length === 6 ? null : "official_original_tenji_not_available" };
}

export async function fetchTsuOfficialOriginalTenji(race, options = {}) {
  const raceDate = String(race?.raceDate || "");
  const raceNo = Number(race?.raceNo);
  if (raceDate !== jstToday() || !(raceNo >= 1 && raceNo <= 12)) {
    return { ok: false, supported: true, source: "tsu_official", rows: [], error: "tsu_current_day_only" };
  }

  const day = raceDate.replaceAll("-", "");
  const baseUrl = `https://www.boatrace-tsu.com/sp/ajax/ajax_yosou.php?targetday=${day}&race=${raceNo}&req=sttenji&run=0`;
  const timeoutMs = Math.min(10000, Math.max(1000, Number(options.timeoutMs) || 7000));
  const attempts = [];
  try {
    const direct = await fetchTsuText(baseUrl, { timeoutMs });
    attempts.push({ status: direct.status, error: direct.error || null, mode: "direct" });
    let parsed = parseTsuResponse(direct, { day, raceNo });
    let finalFetch = direct;
    let url = baseUrl;

    // The official page loads this Ajax endpoint from a browser session. When a
    // direct request returns an empty/incomplete 200 response, bootstrap the
    // official shell and repeat once with its cookie and Referer. This mirrors
    // the site's own flow without accepting an unverified alternate source.
    if (!parsed.ok && direct.ok) {
      const shellUrl = `https://www.boatrace-tsu.com/sp/index.php?page=yosou-yosou&race=${raceNo}`;
      const shell = await fetchTsuText(shellUrl, { timeoutMs: Math.min(timeoutMs, 3500), redirect: "follow" });
      attempts.push({ status: shell.status, error: shell.error || null, mode: "session_bootstrap" });
      url = `${baseUrl}&_=${Date.now()}`;
      const retried = await fetchTsuText(url, {
        timeoutMs: Math.min(timeoutMs, 5000),
        cookie: shell.cookie,
        referer: shellUrl,
      });
      attempts.push({ status: retried.status, error: retried.error || null, mode: "session_retry" });
      const retriedParsed = parseTsuResponse(retried, { day, raceNo });
      if (retriedParsed.ok || retried.ok) {
        parsed = retriedParsed;
        finalFetch = retried;
      }
    }

    const rows = parsed.rows;
    return {
      ok: rows.length === 6,
      supported: true,
      source: "tsu_official",
      sourceLabel: "BOAT RACE津公式",
      rows,
      status: finalFetch.status,
      url,
      attempts,
      published: rows.length === 6,
      identity: rows.length === 6 ? { verified: true, courseCode: 9, raceDate, raceNo, evidence: "official_selected_date_race_plus_six_boat_classes" } : null,
      eligibleTheories: { ichika: true, hatsune: true, kiina: true },
      error: rows.length === 6 ? null : parsed.error,
    };
  } catch (error) {
    return { ok: false, supported: true, source: "tsu_official", rows: [], url: baseUrl, attempts, error: error?.name === "AbortError" ? "timeout" : error?.message || "fetch failed" };
  }
}
