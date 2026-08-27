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
  if (!text || text === "-" || text === "─" || text === "—") return null;
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
    // 蒲郡公式: コース / 枠番 / 展示タイム / 一周 / まわり足 / 直線
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

const ADAPTERS = {
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
