import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { buildTrinityCoreV2 } from '../../../lib/trinityCoreV2.js';
import { selectTrinityV3 } from '../../../lib/trinitySelectiveV3.js';
import { buildTrinityPredictionSnapshot, captureTrinityEntries, V3_CANDIDATE_01_THRESHOLD } from '../../../lib/trinitySnapshotV1.js';
import { OFFICIAL_SOURCE_VERSION, officialCourses, parseOfficialRacelist } from '../../../lib/trinityOfficialRacelist.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;
const jst = (date = new Date()) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
}).format(date);
const datePart = date => jst(date).slice(0, 10);
const raceKey = (course, no) => `${course}:${no}`;
const root = 'https://www.boatrace.jp';

async function fetchOfficial(url) {
  const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(9000),
    headers: { 'User-Agent': 'BoatStrikers TRINITY shadow research (official race list)' } });
  if (!response.ok || !/text\/html/i.test(response.headers.get('content-type') || '')) {
    const sample = (await response.text()).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').slice(0, 220);
    throw new Error(`Official race list unavailable: HTTP ${response.status}; content-type=${response.headers.get('content-type') || 'missing'}; reason=${sample}`);
  }
  const html = await response.text();
  if (html.length > 250000) throw new Error('Official race list exceeds size limit');
  return html;
}
async function rows(query) {
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}
async function captureRace(db, date, course, no, existingSource) {
  // Reuse the original immutable page if the first run saved evidence but not its prediction pair.
  let source = existingSource;
  if (!source) {
    const compact = date.replaceAll('-', '');
    const sourceUrl = `${root}/owpc/pc/race/racelist?rno=${no}&jcd=${String(course).padStart(2, '0')}&hd=${compact}`;
    const html = await fetchOfficial(sourceUrl);
    const capturedAt = new Date().toISOString();
    const parsed = parseOfficialRacelist(html, { raceDate: date, courseCode: course, raceNo: no });
    const registrationNos = parsed.entries.map(e => e.racer_registration_no);
    const history = await rows(db.from('bs_race_entries')
      .select('racer_registration_no,gender_code,sex_code,gender,race_date,created_at,updated_at')
      .in('racer_registration_no', registrationNos).lt('race_date', date)
      .lte('created_at', capturedAt).lte('updated_at', capturedAt)
      .order('race_date', { ascending: false }).limit(150));
    const gender = new Map();
    for (const item of history) {
      const code = String(item.gender_code ?? item.sex_code ?? '');
      if (['1', '2'].includes(code) && !gender.has(item.racer_registration_no)) {
        gender.set(item.racer_registration_no, item);
      }
    }
    const missing = registrationNos.filter(reg => !gender.has(reg));
    if (missing.length) return { status: 'no_historical_gender', missing };
    const enriched = parsed.entries.map(entry => ({ ...entry,
      gender_code: String(gender.get(entry.racer_registration_no).gender_code ??
        gender.get(entry.racer_registration_no).sex_code),
      created_at: capturedAt, updated_at: capturedAt }));
    const features = captureTrinityEntries(enriched, 'previous_day', capturedAt);
    source = {
      id: randomUUID(), race_date: date, course_code: course, race_no: no,
      captured_at: capturedAt, closing_time: parsed.closing_time,
      source_url: sourceUrl, source_sha256: parsed.source_sha256, source_html: parsed.source_html,
      boat_features: features,
      gender_evidence: parsed.entries.map(e => ({ boat_no: e.boat_no,
        racer_registration_no: e.racer_registration_no,
        race_date: gender.get(e.racer_registration_no).race_date,
        created_at: gender.get(e.racer_registration_no).created_at,
        updated_at: gender.get(e.racer_registration_no).updated_at,
        gender_code: String(gender.get(e.racer_registration_no).gender_code ??
          gender.get(e.racer_registration_no).sex_code) })),
    };
    const { error } = await db.from('trinity_official_entry_sources').insert(source);
    if (error) throw error;
  }
  const event = { race_date: date, course_code: course, race_no: no, closing_time: source.closing_time };
  const generatedAt = new Date().toISOString();
  const prediction = buildTrinityCoreV2({ event, entries: source.boat_features, timing: 'previous_day' });
  if (!prediction.ok || prediction.timing !== 'previous_day') throw new Error('Previous-day model input rejected');
  const v3 = selectTrinityV3(prediction, { minConfidence: V3_CANDIDATE_01_THRESHOLD });
  const common = { event, entries: source.boat_features, prediction, timing: 'previous_day',
    generatedAt, sourceCapturedAt: source.captured_at,
    sourceVersion: OFFICIAL_SOURCE_VERSION, officialSourceId: source.id };
  const pair = [
    buildTrinityPredictionSnapshot({ ...common, engineVersion: 'trinity-core-v2',
      strategyTag: 'v2_baseline', selection: {
        selected_tickets: prediction.trinity.selected_tickets, reason: 'v2_baseline',
      } }),
    buildTrinityPredictionSnapshot({ ...common, engineVersion: 'trinity-v3-candidate-01',
      strategyTag: v3.reason === 'ichika_confidence' ? 'ichika_selective' :
        prediction.women_race ? 'hatsune_watch' :
        Number(prediction.specialists.kiina.ranking[0]?.boat_no) === 5 ? 'kiina_watch' : 'other',
      selection: v3 }),
  ];
  const { error } = await db.from('trinity_prediction_snapshots').insert(pair);
  if (error) throw error;
  return { status: 'saved', source_id: source.id };
}

export async function GET(request) {
  if (!process.env.CRON_SECRET || request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now);
  const hour = Number(parts.find(part => part.type === 'hour')?.value);
  const minute = Number(parts.find(part => part.type === 'minute')?.value);
  if (hour < 21 || hour > 23) return NextResponse.json({ ok: true, status: 'outside_previous_evening' });
  const tomorrow = datePart(new Date(now.getTime() + 86_400_000));
  const result = { race_date: tomorrow, venues: 0, scheduled: 0, saved: 0,
    no_historical_gender: 0, errors: [], attempts: [] };
  try {
    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } });
    const compact = tomorrow.replaceAll('-', '');
    const indexHtml = await fetchOfficial(`${root}/owpc/pc/race/index?hd=${compact}`);
    const courses = officialCourses(indexHtml, compact);
    result.venues = courses.length;
    const sources = await rows(db.from('trinity_official_entry_sources')
      .select('id,race_date,course_code,race_no,captured_at,closing_time,boat_features')
      .eq('race_date', tomorrow).limit(300));
    const byKey = new Map(sources.map(s => [raceKey(s.course_code, s.race_no), s]));
    const snapshots = await rows(db.from('trinity_prediction_snapshots')
      .select('course_code,race_no,engine_version').eq('race_date', tomorrow).eq('timing', 'previous_day').limit(300));
    const saved = new Map();
    for (const row of snapshots) {
      const key = raceKey(row.course_code, row.race_no);
      if (!saved.has(key)) saved.set(key, new Set());
      saved.get(key).add(row.engine_version);
    }
    const candidates = courses.flatMap(course => Array.from({ length: 12 }, (_, n) => ({ course, no: n + 1 })))
      .filter(r => !saved.has(raceKey(r.course, r.no))?.size);
    const slot = (hour - 21) * 12 + Math.floor(minute / 5);
    const rotating = candidates.slice(slot * 12 % Math.max(1, candidates.length));
    const work = [...new Map([...candidates.slice(0, 4), ...rotating.slice(0, 12)]
      .map(r => [raceKey(r.course, r.no), r])).values()];
    result.scheduled = work.length;
    // Limit official site requests and avoid holding a long-lived database transaction.
    for (let offset = 0; offset < work.length; offset += 3) {
      const batch = await Promise.all(work.slice(offset, offset + 3).map(async ({ course, no }) => {
        try { return { course, no, ...await captureRace(db, tomorrow, course, no, byKey.get(raceKey(course, no))) }; }
        catch (error) { return { course, no, status: 'error', message: error.message }; }
      }));
      for (const attempt of batch) {
        result.attempts.push(attempt);
        if (attempt.status === 'saved') result.saved++;
        if (attempt.status === 'no_historical_gender') result.no_historical_gender++;
        if (attempt.status === 'error') result.errors.push(attempt);
      }
    }
    console.log(JSON.stringify({ level: result.errors.length ? 'error' : 'info',
      message: 'trinity official previous-day cron complete', ...result }));
    return NextResponse.json({ ok: result.errors.length === 0, ...result },
      { status: result.errors.length ? 500 : 200 });
  } catch (error) {
    console.error(JSON.stringify({ level: 'error', message: 'trinity official previous-day cron failed',
      error: error.message, ...result }));
    return NextResponse.json({ ok: false, error: error.message, ...result }, { status: 500 });
  }
}
