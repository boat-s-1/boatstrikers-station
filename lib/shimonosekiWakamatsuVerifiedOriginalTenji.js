import { verifyNationalBeforeInfo } from './nationalBeforeInfoIdentity.js';

const CONFIG = {
  19: {
    name: '下関',
    origin: 'https://www.boatrace-shimonoseki.jp',
    source: 'shimonoseki_official_verified',
  },
  20: {
    name: '若松',
    origin: 'https://www.wmb.jp',
    source: 'wakamatsu_official_verified',
  },
};

const clean = (value) => String(value || '')
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
  .replace(/<[^>]*>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/[\u3000\s]+/g, ' ')
  .trim();
const number = (value) => /^\d{1,2}\.\d{2}$/.test(clean(value)) ? Number(clean(value)) : null;
const fail = (race, error) => ({
  ok: false,
  published: false,
  source: CONFIG[Number(race?.courseCode)]?.source || 'shimonoseki_wakamatsu_official_verified',
  rows: [],
  error,
});

export function validShimonosekiWakamatsuRace(race) {
  return Boolean(CONFIG[Number(race?.courseCode)])
    && Number.isInteger(Number(race?.raceNo))
    && Number(race.raceNo) >= 1 && Number(race.raceNo) <= 12
    && /^20\d{2}-\d{2}-\d{2}$/.test(race?.raceDate || '')
    && Number.isFinite(Date.parse(race.raceDate))
    && new Date(race.raceDate).toISOString().slice(0, 10) === race.raceDate;
}

function cellByClass(row, className) {
  const cells = [...String(row || '').matchAll(/<td\b([^>]*)>([\s\S]*?)<\/td>/gi)]
    .filter((match) => new RegExp(`(?:^|\\s)${className}(?:\\s|$)`).test(match[1].match(/class=['"]([^'"]*)['"]/i)?.[1] || ''));
  return cells.length === 1 ? cells[0] : null;
}

export function parseShimonosekiWakamatsuOriginal(html, race) {
  if (!validShimonosekiWakamatsuRace(race)) return fail(race, 'invalid_race');
  const config = CONFIG[Number(race.courseCode)];
  const day = race.raceDate.replaceAll('-', ''), raceNo = Number(race.raceNo);
  const title = clean(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '');
  if (!title.includes(config.name)) return fail(race, 'source_venue_mismatch');

  const selectedTabs = [...String(html).matchAll(/<li\b[^>]*class=['"][^'"]*\bselected\b[^'"]*['"][^>]*>([\s\S]*?)<\/li>/gi)]
    .filter((match) => clean(match[1]).includes('オリジナル展示データ'));
  if (selectedTabs.length !== 1) return fail(race, 'source_identity_missing');
  const selected = selectedTabs[0][0];
  const selectedDay = selected.match(/data-day=['"](\d{8})['"]/i)?.[1];
  const selectedRace = selected.match(/data-race=['"](\d{1,2})['"]/i)?.[1];
  const selectedKind = selected.match(/data-kind=['"](\d+)['"]/i)?.[1];
  if (selectedDay !== day || Number(selectedRace) !== raceNo || selectedKind !== '2') {
    return fail(race, 'source_identity_mismatch');
  }

  const tables = [...String(html).matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)]
    .map((match) => match[0])
    .filter((table) => {
      const heading = clean(table.match(/<thead\b[^>]*>([\s\S]*?)<\/thead>/i)?.[1] || '');
      return /展示\s*タイム/.test(heading)
        && ['一周', 'まわり足', '直線'].every((label) => heading.includes(label));
    });
  if (tables.length !== 1) return fail(race, 'timing_table_ambiguous');

  const dataRows = [...tables[0].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)]
    .map((match) => match[1])
    .filter((row) => cellByClass(row, 'col1') && cellByClass(row, 'col2'));
  if (dataRows.length === 0) return fail(race, 'not_published');

  const rows = [];
  for (const row of dataRows) {
    const boatCell = cellByClass(row, 'col1'), racerCell = cellByClass(row, 'col2');
    const exhibitionCell = cellByClass(row, 'col5'), lapCell = cellByClass(row, 'col6');
    const turnCell = cellByClass(row, 'col7'), straightCell = cellByClass(row, 'col8');
    if (!boatCell || !racerCell || !exhibitionCell || !lapCell || !turnCell || !straightCell) {
      return fail(race, 'timing_row_changed');
    }
    const boat = clean(boatCell[2]);
    const color = boatCell[1].match(/\btei_color([1-6])\b/)?.[1];
    const racerIds = [...racerCell[2].matchAll(/profile\?toban=(\d{4})/gi)].map((match) => match[1]);
    const parsed = {
      boatNo: Number(boat),
      racerNo: racerIds[0] || null,
      exhibitionTime: number(exhibitionCell[2]),
      lapTime: number(lapCell[2]),
      turnTime: number(turnCell[2]),
      straightTime: number(straightCell[2]),
    };
    if (!/^[1-6]$/.test(boat) || boat !== color || racerIds.length !== 1
      || parsed.exhibitionTime === null || parsed.exhibitionTime < 4 || parsed.exhibitionTime > 12
      || parsed.lapTime === null || parsed.lapTime < 25 || parsed.lapTime > 60
      || parsed.turnTime === null || parsed.turnTime < 2 || parsed.turnTime > 20
      || parsed.straightTime === null || parsed.straightTime < 2 || parsed.straightTime > 20) {
      return fail(race, 'measurements_incomplete_or_invalid');
    }
    rows.push(parsed);
  }
  if (rows.length !== 6 || new Set(rows.map((row) => row.boatNo)).size !== 6
    || new Set(rows.map((row) => row.racerNo)).size !== 6) {
    return fail(race, 'six_unique_boats_required');
  }
  return {
    ok: true,
    published: true,
    source: config.source,
    rows: rows.sort((a, b) => a.boatNo - b.boatNo),
  };
}

export function verifyShimonosekiWakamatsu(originalHtml, referenceHtml, race) {
  const original = parseShimonosekiWakamatsuOriginal(originalHtml, race);
  if (!original.ok) return original;
  const reference = verifyNationalBeforeInfo(referenceHtml, race);
  if (!reference.ok) return fail(race, reference.error || 'reference_unavailable');
  for (const row of original.rows) {
    const matched = reference.rows.find((item) => item.boatNo === row.boatNo);
    if (!matched || matched.racerNo !== row.racerNo || matched.exhibitionTime !== row.exhibitionTime) {
      return fail(race, 'roster_or_exhibition_mismatch');
    }
  }
  return {
    ...original,
    identity: {
      verified: true,
      courseCode: Number(race.courseCode),
      raceDate: race.raceDate,
      raceNo: Number(race.raceNo),
      evidence: 'official_https_date_race_and_six_boat_racer_exhibition_match_national_beforeinfo',
    },
    eligibleTheories: { ichika: true, hatsune: true, kiina: true },
  };
}

async function readBounded(url, signal) {
  const response = await fetch(url, {
    cache: 'no-store',
    redirect: 'manual',
    signal,
    headers: {
      'user-agent': 'BoatStrikers/1.0 (+https://www.boat-strike.online/)',
      referer: new URL('/', url).href,
    },
  });
  if (!response.ok) { await response.body?.cancel(); throw new Error('upstream_http_error'); }
  const reader = response.body?.getReader();
  if (!reader) throw new Error('empty_body');
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 1_000_000) { await reader.cancel(); throw new Error('body_too_large'); }
    chunks.push(value);
  }
  return new TextDecoder('utf-8').decode(Buffer.concat(chunks));
}

const cache = new Map();
export async function fetchShimonosekiWakamatsuVerifiedOriginalTenji(race, options = {}) {
  if (!validShimonosekiWakamatsuRace(race)) return fail(race, 'invalid_race');
  const config = CONFIG[Number(race.courseCode)];
  const day = race.raceDate.replaceAll('-', ''), raceNo = Number(race.raceNo);
  const key = `${race.courseCode}/${day}/${raceNo}`;
  const cached = cache.get(key);
  if (cached && cached.until > Date.now()) return structuredClone(cached.result);
  const originalUrl = `${config.origin}/modules/yosou/group-cyokuzen.php?day=${day}&race=${raceNo}&kind=2&if=1`;
  const referenceUrl = `https://www.boatrace.jp/owpc/pc/race/beforeinfo?rno=${raceNo}&jcd=${race.courseCode}&hd=${day}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.min(12000, Math.max(1000, Number(options.timeoutMs) || 10000)));
  try {
    const [originalHtml, referenceHtml] = await Promise.all([
      readBounded(originalUrl, controller.signal),
      readBounded(referenceUrl, controller.signal),
    ]);
    const result = {
      ...verifyShimonosekiWakamatsu(originalHtml, referenceHtml, race),
      url: originalUrl,
      referenceUrl,
      fetchedAt: new Date().toISOString(),
    };
    if (result.ok) {
      if (cache.size >= 48) cache.delete(cache.keys().next().value);
      cache.set(key, { result: structuredClone(result), until: Date.now() + 15000 });
    }
    return result;
  } catch (error) {
    const code = error?.name === 'AbortError' ? 'upstream_timeout'
      : ['upstream_http_error', 'body_too_large', 'empty_body'].includes(error?.message)
        ? error.message : 'upstream_fetch_failed';
    return fail(race, code);
  } finally {
    controller.abort();
    clearTimeout(timer);
  }
}
