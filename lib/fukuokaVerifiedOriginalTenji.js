import { verifyNationalBeforeInfo } from './nationalBeforeInfoIdentity.js';

const SOURCE = 'fukuoka_official_verified';
const LABEL = 'BOAT RACE福岡公式';
const clean = (value) => String(value || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ').replace(/[\s\u3000]+/g, ' ').trim();
const fail = (error) => ({ ok:false, supported:true, published:false, source:SOURCE, sourceLabel:LABEL, rows:[], error });
const value = (html, min, max) => {
  const text = clean(html);
  if (!/^\d{1,2}\.\d{2}$/.test(text)) return null;
  const number = Number(text);
  return number >= min && number <= max ? number : null;
};
const classCell = (row, name) => {
  for (const match of String(row || '').matchAll(/<td\b([^>]*)>([\s\S]*?)<\/td>/gi)) {
    const classes = match[1].match(/class\s*=\s*(['"])(.*?)\1/i)?.[2] || '';
    if (new RegExp(`(?:^|\\s)${name}(?:\\s|$)`, 'i').test(classes)) return match[2];
  }
  return null;
};

export function validFukuokaRace(race) {
  const raceNo = Number(race?.raceNo), date = String(race?.raceDate || '');
  return Number(race?.courseCode) === 22 && Number.isInteger(raceNo) && raceNo >= 1 && raceNo <= 12
    && /^20\d{2}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date))
    && new Date(date).toISOString().slice(0, 10) === date;
}

export function parseFukuokaOriginal(html, race) {
  if (!validFukuokaRace(race)) return fail('invalid_race');
  const source = String(html || '');
  if (!/BOATRACE\s*福岡独自計測値/.test(clean(source))) return fail('source_venue_mismatch');
  const tables = [...source.matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)].map((match) => match[0]).filter((table) => {
    const heading = clean(table.match(/<tr\b[^>]*>([\s\S]*?)<\/tr>/i)?.[1] || '');
    return /展示タイム/.test(heading) && /オリジナル展示データ/.test(heading) && /一周/.test(clean(table)) && /まわり足/.test(clean(table)) && /直線/.test(clean(table));
  });
  if (tables.length !== 1) return fail(tables.length ? 'timing_table_ambiguous' : 'official_original_tenji_not_available');
  const rows = [];
  for (const match of tables[0].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const row = match[1], boatNo = Number(clean(classCell(row, 'col1')));
    if (!(boatNo >= 1 && boatNo <= 6)) continue;
    const racerNo = clean(classCell(row, 'col2')).match(/(?:^|\s)(\d{4})\s*\//)?.[1] || null;
    const exhibitionTime = value(classCell(row, 'col6'), 6, 8);
    const lapTime = value(classCell(row, 'col7'), 30, 45);
    const turnTime = value(classCell(row, 'col8'), 4, 10);
    const straightTime = value(classCell(row, 'col9'), 4, 10);
    if (!racerNo || [exhibitionTime, lapTime, turnTime, straightTime].some((item) => item === null)) return fail('measurements_incomplete_or_invalid');
    rows.push({ boatNo, racerNo, exhibitionTime, lapTime, turnTime, straightTime });
  }
  rows.sort((a, b) => a.boatNo - b.boatNo);
  if (rows.length !== 6 || rows.some((row, index) => row.boatNo !== index + 1) || new Set(rows.map((row) => row.racerNo)).size !== 6) return fail('six_unique_boats_required');
  return { ok:true, supported:true, published:true, source:SOURCE, sourceLabel:LABEL, rows };
}

export function verifyFukuoka(originalHtml, referenceHtml, race) {
  const parsed = parseFukuokaOriginal(originalHtml, race);
  if (!parsed.ok) return parsed;
  const reference = verifyNationalBeforeInfo(referenceHtml, race);
  if (!reference.ok) return fail(reference.error || 'reference_unavailable');
  for (const row of parsed.rows) {
    const matched = reference.rows.find((item) => item.boatNo === row.boatNo && item.racerNo === row.racerNo);
    if (!matched || matched.exhibitionTime !== row.exhibitionTime) return fail('roster_or_exhibition_mismatch');
  }
  return {
    ...parsed,
    identity:{ verified:true, courseCode:22, raceDate:race.raceDate, raceNo:Number(race.raceNo), evidence:'fixed_official_query_and_six_boat_racer_exhibition_match_national_beforeinfo' },
    eligibleTheories:{ ichika:true, hatsune:true, kiina:true },
    availableMetrics:['exhibition','lap','turn','straight'],
  };
}

async function readHtml(url, options = {}) {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), Math.min(18000, Math.max(1000, Number(options.timeoutMs) || 15000)));
  try {
    const response = await fetch(url, { cache:'no-store', redirect:'manual', signal:controller.signal, headers:{ 'user-agent':'BoatStrikers/1.0 (+https://www.boat-strike.online/)', referer:'https://www.boatrace-fukuoka.com/modules/yosou/' } });
    if (!response.ok) { await response.body?.cancel(); return { ok:false, error:'upstream_http_error', status:response.status }; }
    return { ok:true, html:await response.text() };
  } catch (error) {
    return { ok:false, error:error?.name === 'AbortError' ? 'upstream_timeout' : 'upstream_fetch_failed' };
  } finally { controller.abort(); clearTimeout(timer); }
}

export async function fetchFukuokaVerifiedOriginalTenji(race, options = {}) {
  if (!validFukuokaRace(race)) return fail('invalid_race');
  const day = race.raceDate.replaceAll('-', ''), raceNo = Number(race.raceNo);
  const url = `https://www.boatrace-fukuoka.com/modules/yosou/tenji_info.php?day=${day}&race=${raceNo}&if=1&nowmode=1`;
  const referenceUrl = `https://www.boatrace.jp/owpc/pc/race/beforeinfo?rno=${raceNo}&jcd=22&hd=${day}`;
  const [official, reference] = await Promise.all([readHtml(url, options), readHtml(referenceUrl, options)]);
  if (!official.ok) return { ...fail(official.error), status:official.status, url, referenceUrl };
  if (!reference.ok) return { ...fail(reference.error), status:reference.status, url, referenceUrl };
  return { ...verifyFukuoka(official.html, reference.html, race), url, referenceUrl };
}
