import { verifyNationalBeforeInfo } from './nationalBeforeInfoIdentity.js';

const SOURCE = 'tokuyama_official_verified';
const clean = (value) => String(value || '')
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
  .replace(/<[^>]*>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/[\u3000\s]+/g, ' ')
  .trim();
const number = (value) => /^\d{1,2}\.\d{2}$/.test(clean(value)) ? Number(clean(value)) : null;
const fail = (error) => ({ ok: false, published: false, source: SOURCE, rows: [], error });

export function validTokuyamaRace(race) {
  return Number(race?.courseCode) === 18
    && Number.isInteger(Number(race?.raceNo))
    && Number(race.raceNo) >= 1 && Number(race.raceNo) <= 12
    && /^20\d{2}-\d{2}-\d{2}$/.test(race?.raceDate || '')
    && Number.isFinite(Date.parse(race.raceDate))
    && new Date(race.raceDate).toISOString().slice(0, 10) === race.raceDate;
}

export function parseTokuyamaOriginal(html, race) {
  if (!validTokuyamaRace(race)) return fail('invalid_race');
  const day = race.raceDate.replaceAll('-', ''), raceNo = Number(race.raceNo);
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '';
  if (!clean(title).includes('徳山')) return fail('source_venue_mismatch');
  const date = clean(html).match(/(20\d{2})年(\d{2})月(\d{2})日/);
  if (!date || date.slice(1).join('') !== day) return fail('source_date_mismatch');
  const displayed = html.match(/<p>\s*(\d+)R[\s\u3000]/)?.[1];
  if (Number(displayed) !== raceNo) return fail('source_race_mismatch');

  const rows = [];
  const blocks = [...html.matchAll(/<div><span><a\b([^>]*)>([\s\S]*?)<\/a>([\s\S]*?)<\/div>/gi)];
  for (const match of blocks) {
    const anchor = match[1].match(/href=['"]#([1-6])['"]/)?.[1];
    const boat = match[2].match(/mb_tenjidata_no([1-6])\.gif/)?.[1];
    const text = clean(match[3]);
    const racerNo = text.match(/^(\d{4})\s/)?.[1];
    if (!boat || anchor !== boat || !racerNo) return fail('boat_identity_mismatch');
    const metric = (label) => {
      const matches = [...text.matchAll(new RegExp(`${label}：([^ ]+)`, 'g'))];
      return matches.length === 1 ? number(matches[0][1]) : null;
    };
    const row = {
      boatNo: Number(boat), racerNo,
      exhibitionTime: metric('展示'), lapTime: metric('一周'),
      turnTime: metric('まわり足'), straightTime: null,
    };
    if (row.exhibitionTime === null || row.exhibitionTime < 4 || row.exhibitionTime > 12
      || row.lapTime === null || row.lapTime < 25 || row.lapTime > 60
      || row.turnTime === null || row.turnTime < 2 || row.turnTime > 20) {
      return fail('measurements_incomplete_or_invalid');
    }
    rows.push(row);
  }
  if (rows.length !== 6 || new Set(rows.map((row) => row.boatNo)).size !== 6
    || new Set(rows.map((row) => row.racerNo)).size !== 6) return fail('six_unique_boats_required');
  return { ok: true, published: true, source: SOURCE, rows: rows.sort((a, b) => a.boatNo - b.boatNo) };
}

export function verifyTokuyama(originalHtml, referenceHtml, race) {
  const original = parseTokuyamaOriginal(originalHtml, race);
  if (!original.ok) return original;
  const reference = verifyNationalBeforeInfo(referenceHtml, race);
  if (!reference.ok) return fail(reference.error || 'reference_unavailable');
  for (const row of original.rows) {
    const matched = reference.rows.find((item) => item.boatNo === row.boatNo);
    if (!matched || matched.racerNo !== row.racerNo || matched.exhibitionTime !== row.exhibitionTime) {
      return fail('roster_or_exhibition_mismatch');
    }
  }
  return {
    ...original,
    identity: {
      verified: true, courseCode: 18, raceDate: race.raceDate, raceNo: Number(race.raceNo),
      evidence: 'official_https_date_race_and_six_boat_racer_exhibition_match_http_original_metrics',
    },
    eligibleTheories: { ichika: true, hatsune: true, kiina: false },
  };
}

async function readBounded(url, encoding, signal) {
  const response = await fetch(url, {
    cache: 'no-store', redirect: 'manual', signal,
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
  const contentType = response.headers.get('content-type') || '';
  const selectedEncoding = /charset\s*=\s*(?:utf-?8)/i.test(contentType) ? 'utf-8' : encoding;
  return new TextDecoder(selectedEncoding).decode(Buffer.concat(chunks));
}

const cache = new Map();
export async function fetchTokuyamaVerifiedOriginalTenji(race, options = {}) {
  if (!validTokuyamaRace(race)) return fail('invalid_race');
  const day = race.raceDate.replaceAll('-', ''), raceNo = Number(race.raceNo), key = `${day}/${raceNo}`;
  const cached = cache.get(key);
  if (cached && cached.until > Date.now()) return structuredClone(cached.result);
  const originalUrl = `http://www.boatrace-tokuyama.jp/tenji-keisoku/m/?day=${day}&race=${raceNo}`;
  const referenceUrl = `https://www.boatrace.jp/owpc/pc/race/beforeinfo?rno=${raceNo}&jcd=18&hd=${day}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.min(12000, Math.max(1000, Number(options.timeoutMs) || 10000)));
  try {
    const [originalHtml, referenceHtml] = await Promise.all([
      readBounded(originalUrl, 'shift_jis', controller.signal),
      readBounded(referenceUrl, 'utf-8', controller.signal),
    ]);
    const result = {
      ...verifyTokuyama(originalHtml, referenceHtml, race),
      url: originalUrl, referenceUrl, fetchedAt: new Date().toISOString(),
    };
    if (result.ok) {
      if (cache.size >= 24) cache.delete(cache.keys().next().value);
      cache.set(key, { result: structuredClone(result), until: Date.now() + 15000 });
    }
    return result;
  } catch (error) {
    const code = error?.name === 'AbortError' ? 'upstream_timeout'
      : ['upstream_http_error', 'body_too_large', 'empty_body'].includes(error?.message)
        ? error.message : 'upstream_fetch_failed';
    return fail(code);
  } finally {
    controller.abort();
    clearTimeout(timer);
  }
}
