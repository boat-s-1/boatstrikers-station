import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { buildTrinityCoreV2 } from '../../../lib/trinityCoreV2.js';
import { selectTrinityV3 } from '../../../lib/trinitySelectiveV3.js';
import { buildTrinityPredictionSnapshot, captureTrinityEntries, closingAt, V3_CANDIDATE_01_THRESHOLD } from '../../../lib/trinitySnapshotV1.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;
const V2 = 'trinity-core-v2';
const V3 = 'trinity-v3-candidate-01';
const jstDate = (date = new Date()) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(date);
const jstHour = () => Number(new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Tokyo', hour: '2-digit', hourCycle: 'h23',
}).format(new Date()));
const key = r => `${r.race_date}:${r.course_code}:${r.race_no}:${r.timing}`;
const trifecta = value => {
  const digits = String(value || '').replace(/[^1-6]/g, '').slice(0, 3);
  return digits.length === 3 && new Set(digits).size === 3 ? digits.split('').join('-') : null;
};
function client() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase service configuration is missing');
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } });
}
async function rows(query) {
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}
async function readSnapshots(db, date) {
  return rows(db.from('trinity_prediction_snapshots')
    .select('prediction_id,race_date,course_code,race_no,timing,engine_version,selected_tickets,investment_yen')
    .gte('race_date', date).limit(1000));
}
async function settle(db, snapshots) {
  const pending = snapshots.filter(s => s.race_date <= jstDate());
  if (!pending.length) return 0;
  const today = jstDate();
  const results = await rows(db.from('bs_race_results')
    .select('race_date,course_code,race_no,winning_trifecta,trifecta_result,trifecta_payout,result_status,race_status')
    .gte('race_date', pending[0].race_date).lte('race_date', today).limit(1000));
  const byRace = new Map(results.map(r => [`${r.race_date}:${r.course_code}:${r.race_no}`, r]));
  const existing = new Set((await rows(db.from('trinity_prediction_results')
    .select('prediction_id').gte('race_date', pending[0].race_date).limit(1000)))
    .map(r => r.prediction_id));
  const inserts = [];
  for (const s of pending) {
    if (existing.has(s.prediction_id)) continue;
    const r = byRace.get(`${s.race_date}:${s.course_code}:${s.race_no}`);
    const actual = trifecta(r?.winning_trifecta || r?.trifecta_result);
    const payout = Number(r?.trifecta_payout);
    if (!actual || !Number.isFinite(payout) || payout <= 0 ||
      ['cancelled', '中止', '不成立'].includes(r.result_status) ||
      ['cancelled', '中止', '不成立'].includes(r.race_status)) continue;
    const hit = s.selected_tickets.some(t => trifecta(t.combination) === actual);
    const payoutYen = hit ? payout * Number(s.selected_tickets.find(t => trifecta(t.combination) === actual)?.stake_yen ?? 100) / 100 : 0;
    inserts.push({ prediction_id: s.prediction_id, race_date: s.race_date,
      course_code: s.course_code, race_no: s.race_no, actual_trifecta: actual,
      trifecta_payout: payout, hit, payout_yen: payoutYen,
      profit_yen: payoutYen - s.investment_yen });
  }
  if (!inserts.length) return 0;
  const { error } = await db.from('trinity_prediction_results').insert(inserts);
  if (error) throw error;
  return inserts.length;
}
async function captureRace(db, event, timing, existing) {
  const raceKey = `${event.race_date}:${event.course_code}:${event.race_no}:${timing}`;
  if (existing.has(raceKey)) return 'exists';
  const startedAt = new Date().toISOString();
  const closes = closingAt(event);
  if (!Number.isFinite(closes) || closes - Date.now() <= 3 * 60_000 || event.result_available !== false) return 'late';
  const source = await rows(db.from('bs_race_entries').select('*')
    .eq('race_date', event.race_date).eq('course_code', event.course_code)
    .eq('race_no', event.race_no).order('boat_no'));
  const entries = captureTrinityEntries(source, timing, startedAt);
  if (timing === 'after_exhibition' && entries.some(e => e.exhibition_time == null || e.exhibition_st == null)) return 'no_exhibition';
  const prediction = buildTrinityCoreV2({ event, entries, timing });
  if (!prediction.ok || prediction.timing !== timing) return 'prediction_unavailable';
  const v2 = { selected_tickets: prediction.trinity.selected_tickets, reason: 'v2_baseline' };
  const v3 = selectTrinityV3(prediction, { minConfidence: V3_CANDIDATE_01_THRESHOLD });
  const odds = (await rows(db.from('bs_elimination_odds_snapshots').select('*')
    .eq('race_date', event.race_date).eq('course_code', event.course_code)
    .eq('race_no', event.race_no).lte('captured_at', startedAt)
    .order('captured_at', { ascending: false }).limit(1)))[0] || null;
  const generatedAt = new Date().toISOString();
  const common = { event, entries, prediction, timing, generatedAt, sourceCapturedAt: startedAt, oddsSnapshot: odds };
  const snapshots = [
    buildTrinityPredictionSnapshot({ ...common, selection: v2, engineVersion: V2,
      strategyTag: 'v2_baseline' }),
    buildTrinityPredictionSnapshot({ ...common, selection: v3, engineVersion: V3,
      strategyTag: v3.reason === 'ichika_confidence' ? 'ichika_selective' :
        prediction.women_race ? 'hatsune_watch' :
        Number(prediction.specialists.kiina.ranking[0]?.boat_no) === 5 ? 'kiina_watch' : 'other' }),
  ];
  const { error } = await db.from('trinity_prediction_snapshots').insert(snapshots);
  if (error) throw error;
  existing.add(raceKey);
  return 'saved';
}
export async function GET(request) {
  if (!process.env.CRON_SECRET || request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  try {
    const db = client();
    const today = jstDate();
    const tomorrow = jstDate(new Date(Date.now() + 86_400_000));
    const yesterday = jstDate(new Date(Date.now() - 86_400_000));
    const snapshots = await readSnapshots(db, yesterday);
    const existing = new Set(snapshots.map(key));
    const events = await rows(db.from('bs_race_events')
      .select('race_date,course_code,race_no,closing_time,result_available')
      .gte('race_date', today).lte('race_date', jstHour() >= 21 ? tomorrow : today)
      .eq('result_available', false).order('race_date').order('closing_time').limit(500));
    const eligible = events.flatMap(event => {
      const until = closingAt(event) - Date.now();
      if (until <= 3 * 60_000) return [];
      const capture = [];
      if (event.race_date === tomorrow &&
        !existing.has(`${event.race_date}:${event.course_code}:${event.race_no}:previous_day`)) {
        capture.push({ event, timing: 'previous_day' });
      }
      if (event.race_date === today && until <= 26 * 60_000 &&
        !existing.has(`${event.race_date}:${event.course_code}:${event.race_no}:after_exhibition`)) {
        capture.push({ event, timing: 'after_exhibition' });
      }
      return capture;
    }).slice(0, 80);
    const outcomes = { saved: 0, exists: 0, late: 0, no_exhibition: 0, prediction_unavailable: 0, incomplete: 0, errors: [] };
    for (const { event, timing } of eligible) {
      try { outcomes[await captureRace(db, event, timing, existing)]++; }
      catch (error) {
        if (error.message === 'Six complete, contemporaneous entries are required') outcomes.incomplete++;
        else outcomes.errors.push({ race: `${event.race_date}/${event.course_code}/${event.race_no}/${timing}`, message: error.message });
      }
    }
    const settled = await settle(db, snapshots);
    return NextResponse.json({ ok: outcomes.errors.length === 0, date: today, eligible: eligible.length,
      ...outcomes, settled }, { status: outcomes.errors.length ? 500 : 200 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
