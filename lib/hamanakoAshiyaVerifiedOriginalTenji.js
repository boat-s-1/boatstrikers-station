import { verifyNationalBeforeInfo } from './nationalBeforeInfoIdentity.js';

const CONFIG = {
  6: { source: 'hamanako_official_verified', label: 'BOAT RACE浜名湖公式' },
  21: { source: 'ashiya_official_verified', label: 'BOAT RACE芦屋公式' },
};
const clean = (value) => String(value || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ').replace(/[\s\u3000]+/g, ' ').trim();
const number = (value, min, max) => {
  const text = clean(value);
  if (!/^\d{1,2}\.\d{2}$/.test(text)) return null;
  const result = Number(text);
  return result >= min && result <= max ? result : null;
};
const cells = (row) => [...String(row || '').matchAll(/<td\b([^>]*)>([\s\S]*?)<\/td>/gi)].map((match) => ({ attrs: match[1], html: match[2], text: clean(match[2]) }));
const classCell = (row, name) => cells(row).find((cell) => new RegExp(`(?:^|\\s)${name}(?:\\s|$)`, 'i').test(cell.attrs.match(/class\s*=\s*(['"])(.*?)\1/i)?.[2] || ''));
const fail = (courseCode, error) => ({
  ok: false, supported: true, published: false,
  source: CONFIG[Number(courseCode)]?.source || null,
  sourceLabel: CONFIG[Number(courseCode)]?.label || null,
  rows: [], error,
});

export function validHamanakoAshiyaRace(race) {
  const code = Number(race?.courseCode), raceNo = Number(race?.raceNo), date = String(race?.raceDate || '');
  return [6, 21].includes(code) && Number.isInteger(raceNo) && raceNo >= 1 && raceNo <= 12
    && /^20\d{2}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date))
    && new Date(date).toISOString().slice(0, 10) === date;
}

function identityOk(html, race) {
  const day = race.raceDate.replaceAll('-', ''), raceNo = Number(race.raceNo);
  return new RegExp(`data-day=['"]${day}['"](?=[^>]*data-race=['"]${raceNo}['"])`, 'i').test(html)
    || new RegExp(`data-race=['"]${raceNo}['"](?=[^>]*data-day=['"]${day}['"])`, 'i').test(html);
}

function parseRacerMap(html) {
  const map = new Map();
  for (const table of String(html || '').matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)) {
    for (const row of table[0].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
      const boatCell = classCell(row[1], 'col1');
      const boatNo = Number(boatCell?.text), profile = row[1].match(/profile\?toban=(\d{4})/i)?.[1];
      if (boatNo >= 1 && boatNo <= 6 && profile && !map.has(boatNo)) map.set(boatNo, profile);
    }
  }
  return map;
}

export function parseHamanakoAshiyaOriginal(html, race) {
  const code = Number(race?.courseCode);
  if (!validHamanakoAshiyaRace(race)) return fail(code, 'invalid_race');
  const source = String(html || '');
  if (code === 6 && !/<title>\s*BOAT RACE 浜名湖\s*<\/title>/i.test(source)) return fail(code, 'source_venue_mismatch');
  if (code === 21 && !/BOATRACE\s*芦屋独自計測値/.test(clean(source))) return fail(code, 'source_venue_mismatch');
  if (!identityOk(source, race)) return fail(code, 'source_identity_mismatch');
  const racerMap = parseRacerMap(source);
  const timingTables = [...source.matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)].map((match) => match[0]).filter((table) => {
    const header = clean(table.match(/<thead\b[^>]*>([\s\S]*?)<\/thead>/i)?.[1] || '');
    return /(?:オリジナル展示データ|展示)/.test(header) && /一周/.test(header) && /まわり足/.test(header) && /直線/.test(header);
  });
  if (timingTables.length !== 1) return fail(code, timingTables.length ? 'timing_table_ambiguous' : 'official_original_tenji_not_available');
  const rows = [];
  for (const row of timingTables[0].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const boatNo = Number(classCell(row[1], 'col1')?.text);
    if (!(boatNo >= 1 && boatNo <= 6)) continue;
    const racerNo = racerMap.get(boatNo);
    const exhibitionTime = number(classCell(row[1], code === 6 ? 'col5' : 'col4')?.text, 6, 8);
    const lapTime = number(classCell(row[1], code === 6 ? 'col6' : 'col5')?.text, 30, 45);
    const turnTime = number(classCell(row[1], code === 6 ? 'col7' : 'col6')?.text, 4, 10);
    const straightTime = number(classCell(row[1], code === 6 ? 'col8' : 'col7')?.text, 4, 10);
    if (!racerNo || [exhibitionTime, lapTime, turnTime, straightTime].some((value) => value === null)) return fail(code, 'measurements_incomplete_or_invalid');
    rows.push({ boatNo, racerNo, exhibitionTime, lapTime, turnTime, straightTime });
  }
  rows.sort((a, b) => a.boatNo - b.boatNo);
  if (rows.length !== 6 || rows.some((row, index) => row.boatNo !== index + 1)
    || new Set(rows.map((row) => row.racerNo)).size !== 6) return fail(code, 'six_unique_boats_required');
  return { ok: true, supported: true, published: true, source: CONFIG[code].source, sourceLabel: CONFIG[code].label, rows };
}

export function verifyHamanakoAshiya(originalHtml, referenceHtml, race) {
  const parsed = parseHamanakoAshiyaOriginal(originalHtml, race);
  if (!parsed.ok) return parsed;
  const reference = verifyNationalBeforeInfo(referenceHtml, race);
  if (!reference.ok) return fail(race.courseCode, reference.error || 'reference_unavailable');
  for (const row of parsed.rows) {
    const matched = reference.rows.find((item) => item.boatNo === row.boatNo && item.racerNo === row.racerNo);
    if (!matched || matched.exhibitionTime !== row.exhibitionTime) return fail(race.courseCode, 'roster_or_exhibition_mismatch');
  }
  return {
    ...parsed,
    identity: { verified: true, courseCode: Number(race.courseCode), raceDate: race.raceDate, raceNo: Number(race.raceNo), evidence: 'official_date_race_and_six_boat_racer_exhibition_match_national_beforeinfo' },
    eligibleTheories: { ichika: true, hatsune: true, kiina: true },
    availableMetrics: ['exhibition', 'lap', 'turn', 'straight'],
  };
}

async function readHtml(url, headers, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.min(18000, Math.max(1000, Number(options.timeoutMs) || 15000)));
  try {
    const response = await fetch(url, { cache: 'no-store', redirect: 'manual', signal: controller.signal, headers });
    if (!response.ok) { await response.body?.cancel(); return { ok: false, error: 'upstream_http_error', status: response.status }; }
    return { ok: true, html: await response.text() };
  } catch (error) {
    return { ok: false, error: error?.name === 'AbortError' ? 'upstream_timeout' : 'upstream_fetch_failed' };
  } finally {
    controller.abort(); clearTimeout(timer);
  }
}

export async function fetchHamanakoAshiyaVerifiedOriginalTenji(race, options = {}) {
  const code = Number(race?.courseCode);
  if (!validHamanakoAshiyaRace(race)) return fail(code, 'invalid_race');
  const day = race.raceDate.replaceAll('-', ''), raceNo = Number(race.raceNo);
  const officialUrl = code === 6
    ? `https://www.boatrace-hamanako.jp/modules/yosou/group-cyokuzen.php?day=${day}&race=${raceNo}&kind=2&if=1`
    : `https://boatrace-ashiya.com/sp/ajax/ajax_yosou.php?targetday=${day}&race=${raceNo}&req=cyokuzen&run=0`;
  const referenceUrl = `https://www.boatrace.jp/owpc/pc/race/beforeinfo?rno=${raceNo}&jcd=${String(code).padStart(2, '0')}&hd=${day}`;
  const [official, reference] = await Promise.all([
    readHtml(officialUrl, { 'user-agent': 'BoatStrikers/1.0 (+https://www.boat-strike.online/)', 'x-requested-with': 'XMLHttpRequest', referer: code === 6 ? 'https://www.boatrace-hamanako.jp/' : 'https://boatrace-ashiya.com/sp/' }, options),
    readHtml(referenceUrl, { 'user-agent': 'BoatStrikers/1.0 (+https://www.boat-strike.online/)' }, options),
  ]);
  if (!official.ok) return { ...fail(code, official.error), status: official.status, url: officialUrl, referenceUrl };
  if (!reference.ok) return { ...fail(code, reference.error), status: reference.status, url: officialUrl, referenceUrl };
  return { ...verifyHamanakoAshiya(official.html, reference.html, race), url: officialUrl, referenceUrl };
}
