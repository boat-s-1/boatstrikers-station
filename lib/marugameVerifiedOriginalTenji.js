// Public official data only. No DB/LINE access. Fail closed on identity ambiguity.
const clean = s => String(s).replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ').replace(/\s+/g, ' ').trim();
const fail = error => ({ ok: false, published: false, rows: [], error, source: 'marugame_official_verified' });

export function validMarugameRace(race) {
  const date = race?.raceDate;
  return Number(race?.courseCode) === 15 && Number.isInteger(Number(race?.raceNo)) &&
    Number(race.raceNo) >= 1 && Number(race.raceNo) <= 12 &&
    /^20\d{2}-\d{2}-\d{2}$/.test(date || '') && Number.isFinite(Date.parse(date)) &&
    new Date(date).toISOString().slice(0, 10) === date;
}

export function parseMarugameVerifiedOriginalTenji(html, race) {
  if (!validMarugameRace(race)) return fail('invalid_race');
  const day = race.raceDate.replaceAll('-', '');
  const raceNo = Number(race.raceNo);
  const proofs = [];
  for (const m of String(html).matchAll(/<iframe\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)) {
    let url;
    try { url = new URL(m[1].replaceAll('&amp;', '&')); } catch { continue; }
    if (url.origin !== 'https://front.player.boatrace-cdn.jp' || url.pathname !== '/player/vod' || url.searchParams.get('raceType') !== 'exhibition') continue;
    proofs.push(url);
  }
  if (!proofs.length) return fail('source_identity_missing');
  if (proofs.some(url => url.searchParams.get('stadium') !== '15marugame' ||
    url.searchParams.get('raceDate') !== day || url.searchParams.get('raceNumber') !== String(raceNo))) return fail('source_identity_mismatch');
  const tables = [...String(html).matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)].map(m => m[0]);
  const candidates = tables.filter(t => /オリジナル展示データ/.test(clean(t.match(/<thead\b[^>]*>([\s\S]*?)<\/thead>/i)?.[1] || '')));
  if (candidates.length !== 1) return fail('timing_table_ambiguous');
  const table = candidates[0];
  const head = table.match(/<thead\b[^>]*>([\s\S]*?)<\/thead>/i)?.[1] || '';
  const headers = [...head.matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/gi)].map(m => clean(m[1]));
  if (headers.join('|') !== '枠|体重|チルト|展示|オリジナル展示データ|調整|一周|まわり足|直線') return fail('timing_layout_changed');
  const rows = [];
  for (const m of table.matchAll(/<tr\b([^>]*)>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...m[2].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(c => clean(c[1]));
    if (!cells.length || cells.length === 1) continue; // header or adjustment row
    if (cells.length !== 7 || !/^[1-6]$/.test(cells[0])) return fail('timing_row_changed');
    const boatNo = Number(cells[0]);
    const classBoat = m[1].match(/\bline_waku0([1-6])\b/);
    if (!classBoat || Number(classBoat[1]) !== boatNo) return fail('boat_identity_mismatch');
    const values = cells.slice(3).map(s => /^\d{1,2}\.\d{2}$/.test(s) ? Number(s) : null);
    const [exhibitionTime, lapTime, turnTime, straightTime] = values;
    if (values.some(v => v === null) || exhibitionTime < 4 || exhibitionTime > 12 ||
      lapTime < 25 || lapTime > 60 || turnTime < 2 || turnTime > 20 || straightTime < 2 || straightTime > 20) return fail('measurements_incomplete_or_invalid');
    rows.push({ boatNo, exhibitionTime, lapTime, turnTime, straightTime });
  }
  if (rows.length !== 6 || new Set(rows.map(r => r.boatNo)).size !== 6) return fail('six_unique_boats_required');
  return { ok: true, published: true, supported: true, source: 'marugame_official_verified',
    sourceLabel: 'BOAT RACEまるがめ公式', rows: rows.sort((a,b) => a.boatNo-b.boatNo),
    identity: { verified: true, raceDate: race.raceDate, raceNo, courseCode: 15,
      evidence: 'same_page_exhibition_replay_and_explicit_boat_cells' },
    eligibleTheories: { ichika: true, hatsune: true, kiina: true } };
}

const cache = new Map();
export async function fetchMarugameVerifiedOriginalTenji(race, options = {}) {
  if (!validMarugameRace(race)) return fail('invalid_race');
  const key = `${race.raceDate}/${Number(race.raceNo)}`;
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return structuredClone(cached.result);
  const url = `https://www.marugameboat.jp/asp/kyogi/15/sp/yoso05${String(Number(race.raceNo)).padStart(2,'0')}.htm`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.min(10000, Math.max(1000, Number(options.timeoutMs) || 7000)));
  try {
    const response = await fetch(url, { cache: 'no-store', redirect: 'manual', signal: controller.signal,
      headers: { 'User-Agent': 'BoatStrikers/1.0 (+https://www.boat-strike.online/)', Referer: 'https://www.marugameboat.jp/' } });
    if (!response.ok) { await response.body?.cancel(); return { ...fail('upstream_http_error'), status: response.status, url }; }
    const reader = response.body?.getReader();
    if (!reader) return fail('empty_body');
    let size = 0;
    const chunks = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 1000000) { await reader.cancel(); return fail('body_too_large'); }
      chunks.push(value);
    }
    const result = { ...parseMarugameVerifiedOriginalTenji(new TextDecoder('utf-8').decode(Buffer.concat(chunks)), race), url, fetchedAt: new Date().toISOString() };
    // Briefly share a verified complete snapshot between the three alert jobs.
    if (result.ok) {
      if (cache.size >= 24) cache.delete(cache.keys().next().value);
      cache.set(key, { result: structuredClone(result), expires: Date.now() + 15000 });
    }
    return result;
  } catch (error) { return fail(error?.name === 'AbortError' ? 'upstream_timeout' : 'upstream_fetch_failed'); }
  finally { clearTimeout(timer); }
}
