import { parseHistoricalOriginalTenji } from './historicalOriginalTenji.js';
import { verifyNationalBeforeInfo } from './nationalBeforeInfoIdentity.js';

const SOURCES = { 12: 'suminoe_official_verified', 24: 'omura_official_verified' };
const fail = (courseCode, error) => ({
  ok: false, published: false, source: SOURCES[Number(courseCode)] || null, rows: [], error,
});
const compactName = (value) => String(value || '').replace(/[\s\u3000]+/g, '');

export function validSuminoeOmuraRace(race) {
  const code = Number(race?.courseCode), raceNo = Number(race?.raceNo), date = String(race?.raceDate || '');
  return [12, 24].includes(code) && Number.isInteger(raceNo) && raceNo >= 1 && raceNo <= 12
    && /^20\d{2}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date))
    && new Date(date).toISOString().slice(0, 10) === date;
}

export function verifySuminoeOmura(originalHtml, referenceHtml, race) {
  const code = Number(race?.courseCode);
  if (!validSuminoeOmuraRace(race)) return fail(code, 'invalid_race');
  const parsed = parseHistoricalOriginalTenji(originalHtml, race);
  if (!parsed.ok || parsed.candidateRows?.length !== 6) return fail(code, parsed.error || 'official_measurements_unavailable');
  const reference = verifyNationalBeforeInfo(referenceHtml, race);
  if (!reference.ok) return fail(code, reference.error || 'reference_unavailable');

  const rows = [];
  for (const candidate of parsed.candidateRows) {
    const matched = code === 12
      ? reference.rows.find((row) => row.boatNo === candidate.boatNo && row.racerNo === candidate.racerNo)
      : reference.rows.find((row) => compactName(row.racerName) === compactName(candidate.racerName));
    if (!matched || matched.exhibitionTime !== candidate.exhibitionTime) return fail(code, 'roster_or_exhibition_mismatch');
    rows.push({ ...candidate, boatNo: matched.boatNo, racerNo: matched.racerNo, racerName: matched.racerName });
  }
  rows.sort((a, b) => a.boatNo - b.boatNo);
  if (rows.length !== 6 || new Set(rows.map((row) => row.boatNo)).size !== 6
    || new Set(rows.map((row) => row.racerNo)).size !== 6) return fail(code, 'six_unique_boats_required');

  return {
    ok: true, published: true, source: SOURCES[code], rows,
    identity: {
      verified: true, courseCode: code, raceDate: race.raceDate, raceNo: Number(race.raceNo),
      evidence: code === 12
        ? 'official_date_race_and_six_boat_racer_exhibition_match_national_beforeinfo'
        : 'official_date_race_and_six_racer_name_exhibition_match_national_beforeinfo',
    },
    eligibleTheories: { ichika: true, hatsune: true, kiina: code === 24 },
    availableMetrics: code === 24 ? ['exhibition', 'lap', 'turn', 'straight'] : ['exhibition', 'lap', 'turn'],
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
  const bytes = Buffer.concat(chunks);
  const contentType = response.headers.get('content-type') || '';
  // Omura's HTTP header currently says UTF-8 while the page itself explicitly
  // declares Shift_JIS and is encoded as such. Prefer the in-document marker.
  const declaredShiftJis = /charset\s*=\s*shift[_-]?jis/i.test(bytes.toString('latin1', 0, Math.min(bytes.length, 4096)));
  const selectedEncoding = declaredShiftJis ? 'shift_jis'
    : /charset\s*=\s*(?:utf-?8)/i.test(contentType) ? 'utf-8' : encoding;
  return new TextDecoder(selectedEncoding).decode(bytes);
}

const cache = new Map();
export async function fetchSuminoeOmuraVerifiedOriginalTenji(race, options = {}) {
  const code = Number(race?.courseCode);
  if (!validSuminoeOmuraRace(race)) return fail(code, 'invalid_race');
  const day = race.raceDate.replaceAll('-', ''), raceNo = Number(race.raceNo), key = `${code}/${day}/${raceNo}`;
  const cached = cache.get(key);
  if (cached && cached.until > Date.now()) return structuredClone(cached.result);
  const originalUrl = code === 12
    ? `https://www.boatrace-suminoe.jp/asp/kyogi/12/sp/yoso05${String(raceNo).padStart(2, '0')}.htm`
    : `https://omurakyotei.jp/yosou/m/chokuzen.php?day=${day}&race=${raceNo}`;
  const referenceUrl = `https://www.boatrace.jp/owpc/pc/race/beforeinfo?rno=${raceNo}&jcd=${code}&hd=${day}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.min(23000, Math.max(3000, Number(options.timeoutMs) || 22000)));
  try {
    const [originalHtml, referenceHtml] = await Promise.all([
      readBounded(originalUrl, code === 24 ? 'shift_jis' : 'utf-8', controller.signal),
      readBounded(referenceUrl, 'utf-8', controller.signal),
    ]);
    const result = {
      ...verifySuminoeOmura(originalHtml, referenceHtml, race),
      url: originalUrl, referenceUrl, fetchedAt: new Date().toISOString(),
    };
    if (result.ok) {
      if (cache.size >= 24) cache.delete(cache.keys().next().value);
      cache.set(key, { result: structuredClone(result), until: Date.now() + 15000 });
    }
    return result;
  } catch (error) {
    const reason = error?.name === 'AbortError' ? 'upstream_timeout'
      : ['upstream_http_error', 'body_too_large', 'empty_body'].includes(error?.message)
        ? error.message : 'upstream_fetch_failed';
    return fail(code, reason);
  } finally {
    controller.abort();
    clearTimeout(timer);
  }
}
