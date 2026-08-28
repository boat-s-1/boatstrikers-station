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

export function parseAmagasakiOfficialOriginalTenji(html) {
  const text = htmlToText(html);
  if (!text.includes("オリジナル展示データ") || !text.includes("一周") || !text.includes("まわり足")) return [];

  const headerAt = text.indexOf("枠 体重 チルト 展示 タイム 一周 まわり足 調整");
  if (headerAt < 0) return [];
  let section = text.slice(headerAt + "枠 体重 チルト 展示 タイム 一周 まわり足 調整".length);
  const endAt = section.indexOf("計測位置");
  if (endAt >= 0) section = section.slice(0, endAt);

  const rows = [];
  const pattern = /(?:^|\s)([1-6])\s+\d{2}(?:\.\d+)?\s+-?\d+(?:\.\d+)?\s+(\d(?:\.\d{2})|-|—)\s+(\d{2}(?:\.\d{2})|-|—)\s+(\d{1,2}(?:\.\d{2})|-|—)(?:\s+\d+(?:\.\d+)?)?(?=\s+[1-6]\s+\d{2}(?:\.\d+)?\s|\s*$)/g;
  for (const match of section.matchAll(pattern)) {
    const boatNo = Number(match[1]);
    rows.push({
      boatNo,
      exhibitionTime: numericOrNull(match[2]),
      lapTime: numericOrNull(match[3]),
      turnTime: numericOrNull(match[4]),
      straightTime: null,
    });
  }

  return [...new Map(rows.map((row) => [row.boatNo, row])).values()].sort((a, b) => a.boatNo - b.boatNo);
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
      url,
    };
  } catch (error) {
    return { ok: false, supported: true, source: "amagasaki_official", rows: [], error: error?.name === "AbortError" ? "timeout" : error?.message || "fetch failed", url };
  } finally {
    clearTimeout(timer);
  }
}
