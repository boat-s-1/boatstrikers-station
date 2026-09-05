const OFFICIAL_BASE = "https://www.boatrace.jp/owpc/pc/race/odds3t";

function compactDate(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length !== 8) throw new Error("オッズ取得日が正しくありません。");
  return digits;
}

function decodeHtml(value) {
  return String(value || "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .trim();
}

function allTrifectaBets() {
  const bets = [];
  for (let first = 1; first <= 6; first += 1) {
    for (let second = 1; second <= 6; second += 1) {
      if (second === first) continue;
      for (let third = 1; third <= 6; third += 1) {
        if (third === first || third === second) continue;
        bets.push(`${first}-${second}-${third}`);
      }
    }
  }
  return bets;
}

const BET_ORDER = allTrifectaBets();

export function parseOfficialTrifectaOdds(html) {
  const cells = [];
  const re = /<td\b[^>]*class=(['"])[^'"]*\boddsPoint\b[^'"]*\1[^>]*>([\s\S]*?)<\/td>/gi;
  for (const match of String(html || "").matchAll(re)) {
    cells.push(decodeHtml(match[2]));
  }

  if (cells.length < 120) {
    throw new Error(`3連単オッズを120通り取得できませんでした（${cells.length}通り）。`);
  }

  const odds = {};
  BET_ORDER.forEach((bet, index) => {
    const raw = cells[index];
    const value = Number(String(raw).replace(/,/g, ""));
    odds[bet] = Number.isFinite(value) && value > 0 ? value : null;
  });

  return odds;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchOfficialHtml(url, attempt) {
  const controller = new AbortController();
  const timeoutMs = attempt === 1 ? 15000 : 18000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; BoatStrikers/1.0; +https://www.boat-strike.online/)",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ja,en-US;q=0.8,en;q=0.6",
      },
    });

    if (!response.ok) {
      throw new Error(`公式オッズ取得 HTTP ${response.status}`);
    }

    return await response.text();
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`公式オッズ取得がタイムアウトしました（${timeoutMs / 1000}秒）`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function getOfficialTrifectaOdds({ raceDate, courseCode, raceNo }) {
  const hd = compactDate(raceDate);
  const jcd = String(Number(courseCode)).padStart(2, "0");
  const rno = Number(raceNo);
  if (!/^\d{2}$/.test(jcd) || !Number.isInteger(rno) || rno < 1 || rno > 12) {
    throw new Error("オッズ取得対象レースが正しくありません。");
  }

  const url = `${OFFICIAL_BASE}?hd=${hd}&jcd=${jcd}&rno=${rno}`;
  let lastError = null;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const html = await fetchOfficialHtml(url, attempt);
      const odds = parseOfficialTrifectaOdds(html);
      return {
        odds,
        source: "BOAT RACE オフィシャルウェブサイト",
        sourceUrl: url,
        fetchedAt: new Date().toISOString(),
        count: Object.values(odds).filter((value) => Number.isFinite(value)).length,
        attempts: attempt,
      };
    } catch (error) {
      lastError = error;
      if (attempt < 2) await sleep(700);
    }
  }

  throw new Error(lastError?.message || "公式オッズを取得できませんでした。時間をおいて再診断してください。");
}
