const COURSE_NAMES = {
  1: "kiryu", 2: "toda", 3: "edogawa", 4: "heiwajima", 5: "tamagawa", 6: "hamanako",
  7: "gamagori", 8: "tokoname", 9: "tsu", 10: "mikuni", 11: "biwako", 12: "suminoe",
  13: "amagasaki", 14: "naruto", 15: "marugame", 16: "kojima", 17: "miyajima", 18: "tokuyama",
  19: "shimonoseki", 20: "wakamatsu", 21: "ashiya", 22: "fukuoka", 23: "karatsu", 24: "omura",
};

function ymd(date) {
  return String(date || "").replace(/-/g, "");
}

function pad2(value) {
  return String(Number(value)).padStart(2, "0");
}

function jstToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

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

function htmlToText(html) {
  return decodeHtml(String(html || "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/t[rdh]>/gi, "\n")
    .replace(/<[^>]+>/g, " "))
    .replace(/\r/g, "")
    .replace(/[\t ]+/g, " ")
    .replace(/\n+/g, "\n")
    .trim();
}

function numericOrNull(value) {
  const text = String(value ?? "").trim();
  if (!text || text === "-" || text === "─" || text === "—" || text === "-.--" || text === "-.-") return null;
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

function parseGamagori(html) {
  if (!/オリジナル展示タイム/.test(String(html || ""))) return [];
  const rows = [];
  for (const cells of parseTableRows(html)) {
    if (cells.length < 6) continue;
    const course = Number(cells[0]);
    const boatNo = Number(cells[1]);
    if (!(course >= 1 && course <= 6 && boatNo >= 1 && boatNo <= 6)) continue;
    const exhibitionTime = numericOrNull(cells[2]);
    const lapTime = numericOrNull(cells[3]);
    const turnTime = numericOrNull(cells[4]);
    const straightTime = numericOrNull(cells[5]);
    if ([exhibitionTime, lapTime, turnTime, straightTime].every((v) => v === null)) continue;
    rows.push({ boatNo, exhibitionCourse: course, exhibitionTime, lapTime, turnTime, straightTime });
  }
  return [...new Map(rows.map((row) => [row.boatNo, row])).values()].sort((a, b) => a.boatNo - b.boatNo);
}

function parseHeiwajima(html) {
  const text = htmlToText(html);
  const originalAt = text.indexOf("オリジナルデータ");
  if (originalAt < 0) return [];
  let original = text.slice(originalAt);
  const exhibitAt = original.indexOf("展示情報");
  if (exhibitAt >= 0) original = original.slice(0, exhibitAt);

  const originalCompact = original.replace(/\n/g, " ").replace(/\s+/g, " ");
  const originals = new Map();
  const originalPattern = /(?:^|\s)([1-6])\s+(.{1,80}?)\s+タイム\s+(\d{1,2}\.\d{2}|[-—－])\s+(\d{1,2}\.\d{2}|[-—－])\s+(\d{1,2}\.\d{2}|[-—－])\s+時速/g;
  for (const match of originalCompact.matchAll(originalPattern)) {
    const boatNo = Number(match[1]);
    originals.set(boatNo, {
      boatNo,
      lapTime: numericOrNull(match[3]),
      turnTime: numericOrNull(match[4]),
      straightTime: numericOrNull(match[5]),
    });
  }

  const exhibitionTimes = new Map();
  const exhibitSections = text.split("展示情報");
  const exhibit = exhibitSections.length > 1 ? exhibitSections.at(-1) : "";
  const exhibitCompact = exhibit.replace(/\n/g, " ").replace(/\s+/g, " ");
  for (let boatNo = 1; boatNo <= 6; boatNo += 1) {
    const re = new RegExp(`(?:^|\\s)${boatNo}\\s+.{1,100}?\\s+(\\d{1,2}\\.\\d{2}|[-—－])\\s+-?\\d+(?:\\.\\d+)?\\s+(?:部品交換|$)`);
    const match = exhibitCompact.match(re);
    if (match) exhibitionTimes.set(boatNo, numericOrNull(match[1]));
  }

  for (const cells of parseTableRows(html)) {
    const boatNo = Number(cells[0]);
    if (!(boatNo >= 1 && boatNo <= 6) || exhibitionTimes.has(boatNo)) continue;
    const candidates = cells.map(numericOrNull).filter((v) => v !== null);
    const exhibition = candidates.find((v) => v >= 6 && v <= 8);
    if (exhibition !== undefined) exhibitionTimes.set(boatNo, exhibition);
  }

  const rows = [];
  for (let boatNo = 1; boatNo <= 6; boatNo += 1) {
    const originalRow = originals.get(boatNo);
    if (!originalRow) continue;
    rows.push({
      ...originalRow,
      exhibitionTime: exhibitionTimes.get(boatNo) ?? null,
    });
  }
  return rows;
}

function parseBiwako(html) {
  const text = htmlToText(html);
  if (!text.includes("オリジナル展示")) return [];
  const rows = [];
  for (const cells of parseTableRows(html)) {
    if (cells.length < 7) continue;
    const boatNo = Number(cells[0]);
    if (!(boatNo >= 1 && boatNo <= 6)) continue;

    const exhibitionTime = numericOrNull(cells[3]);
    const lapTime = numericOrNull(cells[4]);
    const turnTime = numericOrNull(cells[5]);
    const straightTime = numericOrNull(cells[6]);
    if ([exhibitionTime, lapTime, turnTime, straightTime].every((v) => v === null)) continue;
    rows.push({ boatNo, exhibitionTime, lapTime, turnTime, straightTime });
  }
  return [...new Map(rows.map((row) => [row.boatNo, row])).values()].sort((a, b) => a.boatNo - b.boatNo);
}

function parseKojima(html) {
  const text = htmlToText(html);
  if (!text.includes("オリジナル展示")) return [];
  const rows = [];

  for (const cells of parseTableRows(html)) {
    const boatNo = Number(cells[0]);
    if (!(boatNo >= 1 && boatNo <= 6)) continue;

    const nums = cells.map(numericOrNull);
    const lapIndex = nums.findIndex((v, index) => index > 0 && v !== null && v >= 30 && v <= 45);
    if (lapIndex < 0) continue;

    let exhibitionTime = null;
    for (let i = lapIndex - 1; i >= 1; i -= 1) {
      const v = nums[i];
      if (v !== null && v >= 6 && v <= 8) {
        exhibitionTime = v;
        break;
      }
    }

    const afterLap = nums.slice(lapIndex + 1).filter((v) => v !== null && v >= 4 && v <= 9);
    const lapTime = nums[lapIndex];
    const turnTime = afterLap[0] ?? null;
    const straightTime = afterLap[1] ?? null;

    if ([exhibitionTime, lapTime, turnTime, straightTime].every((v) => v === null)) continue;
    rows.push({ boatNo, exhibitionTime, lapTime, turnTime, straightTime });
  }

  return [...new Map(rows.map((row) => [row.boatNo, row])).values()].sort((a, b) => a.boatNo - b.boatNo);
}

const ADAPTERS = {
  4: {
    key: "heiwajima_official",
    label: "BOAT RACE平和島公式",
    urls({ raceNo }) {
      return [
        `https://www.heiwajima.gr.jp/asp/kyogi/04/sp/yoso05${pad2(raceNo)}.htm`,
        `https://www1.heiwajima.gr.jp/asp/kyogi/04/sp/yoso05${pad2(raceNo)}.htm`,
      ];
    },
    parse: parseHeiwajima,
  },
  7: {
    key: "gamagori_official",
    label: "BOAT RACE蒲郡公式",
    urls({ raceDate, raceNo }) {
      const suffix = `recomend${ymd(raceDate)}07${pad2(raceNo)}.htm`;
      return [
        `https://www1.gamagori-kyotei.com/asp/gamagori/sp/kyogi/kyogihtml/recomend/${suffix}`,
        `https://www.gamagori-kyotei.com/asp/gamagori/sp/kyogi/kyogihtml/recomend/${suffix}`,
      ];
    },
    parse: parseGamagori,
  },
  11: {
    key: "biwako_official",
    label: "BOAT RACEびわこ公式",
    urls({ raceDate, raceNo }) {
      if (String(raceDate) !== jstToday()) return [];
      return [
        `https://www.boatrace-biwako.jp/sp/index.php?page=yosou-cyokuzen&race=${Number(raceNo)}`,
        `https://boatrace-biwako.jp/sp/index.php?page=yosou-cyokuzen&race=${Number(raceNo)}`,
      ];
    },
    parse: parseBiwako,
  },
  16: {
    key: "kojima_official",
    label: "BOAT RACE児島公式",
    urls({ raceDate, raceNo }) {
      // 児島の yoso05xx は開催中レースを番号で切り替える形式。
      // 過去日の誤取得を防ぐため当日のみ利用する。
      if (String(raceDate) !== jstToday()) return [];
      return [
        `https://www.kojimaboat.jp/asp/kyogi/16/sp/yoso05${pad2(raceNo)}.htm`,
        `https://kojimaboat.jp/asp/kyogi/16/sp/yoso05${pad2(raceNo)}.htm`,
      ];
    },
    parse: parseKojima,
  },
};

export function getOfficialOriginalTenjiSupport(courseCode) {
  const code = Number(courseCode);
  const adapter = ADAPTERS[code];
  return {
    courseCode: code,
    courseKey: COURSE_NAMES[code] || null,
    supported: Boolean(adapter),
    sourceKey: adapter?.key || null,
    sourceLabel: adapter?.label || null,
  };
}

export async function fetchOfficialOriginalTenji(race, options = {}) {
  const courseCode = Number(race?.courseCode);
  const adapter = ADAPTERS[courseCode];
  if (!adapter) {
    return {
      ok: false,
      supported: false,
      courseCode,
      source: null,
      rows: [],
      error: "official_adapter_not_verified",
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 7000);
  const attempts = [];
  try {
    for (const url of adapter.urls(race)) {
      try {
        const response = await fetch(url, {
          cache: "no-store",
          signal: controller.signal,
          headers: {
            "user-agent": "BoatStrikers/1.0 (+https://www.boat-strike.online/)",
            accept: "text/html,application/xhtml+xml",
            "accept-language": "ja,en-US;q=0.8,en;q=0.6",
          },
        });
        if (!response.ok) {
          attempts.push({ url, status: response.status, rows: 0 });
          continue;
        }
        const html = await response.text();
        const rows = adapter.parse(html);
        attempts.push({ url, status: response.status, rows: rows.length });
        if (rows.length === 6) {
          return {
            ok: true,
            supported: true,
            courseCode,
            source: adapter.key,
            sourceLabel: adapter.label,
            url,
            status: response.status,
            rows,
            published: true,
            attempts,
          };
        }
      } catch (error) {
        attempts.push({ url, error: error?.name === "AbortError" ? "timeout" : error?.message || "fetch failed", rows: 0 });
      }
    }
    return {
      ok: false,
      supported: true,
      courseCode,
      source: adapter.key,
      sourceLabel: adapter.label,
      rows: [],
      published: false,
      error: "official_original_tenji_not_available",
      attempts,
    };
  } finally {
    clearTimeout(timeout);
  }
}
