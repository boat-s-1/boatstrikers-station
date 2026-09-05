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

export async function getOfficialTrifectaOdds({ raceDate, courseCode, raceNo }) {
  const hd = compactDate(raceDate);
  const jcd = String(Number(courseCode)).padStart(2, "0");
  const rno = Number(raceNo);
  if (!/^\d{2}$/.test(jcd) || !Number.isInteger(rno) || rno < 1 || rno > 12) {
    throw new Error("オッズ取得対象レースが正しくありません。");
  }

  const url = `${OFFICIAL_BASE}?hd=${hd}&jcd=${jcd}&rno=${rno}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);

  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "User-Agent": "BoatStrikers/1.0 (+https://www.boat-strike.online/)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (!response.ok) throw new Error(`公式オッズ取得 HTTP ${response.status}`);
    const html = await response.text();
    const odds = parseOfficialTrifectaOdds(html);
    return {
      odds,
      source: "BOAT RACE オフィシャルウェブサイト",
      sourceUrl: url,
      fetchedAt: new Date().toISOString(),
      count: Object.values(odds).filter((value) => Number.isFinite(value)).length,
    };
  } finally {
    clearTimeout(timer);
  }
}
