import { createClient } from '@supabase/supabase-js';
import { buildTrinityCoreV0 } from '../app/lib/trinityCoreV0.js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('SUPABASE URL/service role key are required');

const supabase = createClient(url, key, { auth: { persistSession: false } });
const days = Math.max(30, Math.min(730, Number(process.argv[2] || 180)));
const timing = process.argv[3] === 'after_exhibition' ? 'after_exhibition' : 'previous_day';
const end = new Date();
const start = new Date(end);
start.setUTCDate(start.getUTCDate() - days);
const startDate = start.toISOString().slice(0, 10);
const endDate = end.toISOString().slice(0, 10);

function keyOf(row) { return `${row.race_date}|${row.course_code}|${row.race_no}`; }
function pct(n, d) { return d ? Number(((n / d) * 100).toFixed(2)) : null; }
function emptyStats() {
  return { races: 0, ichika: { hits: 0, eligible: 0 }, hatsune: { hits: 0, eligible: 0 }, kiina: { hits: 0, eligible: 0 }, trinity: { hits: 0, eligible: 0 } };
}
function summarize(stats) {
  return {
    races: stats.races,
    results: Object.fromEntries(['ichika', 'hatsune', 'kiina', 'trinity'].map((k) => [k, { ...stats[k], hit_rate: pct(stats[k].hits, stats[k].eligible) }])),
  };
}
function addRace(stats, result, winner) {
  stats.races += 1;
  for (const character of ['ichika', 'hatsune', 'kiina']) {
    if (character === 'hatsune' && !result.women_race) continue;
    const pick = result.specialists[character].ranking[0]?.boat_no;
    if (!pick) continue;
    stats[character].eligible += 1;
    if (Number(pick) === Number(winner)) stats[character].hits += 1;
  }
  const pick = result.trinity.top_boat;
  if (pick) {
    stats.trinity.eligible += 1;
    if (Number(pick) === Number(winner)) stats.trinity.hits += 1;
  }
}

const { data: rows, error } = await supabase
  .from('ai_v2_training_rows')
  .select('race_date,course_code,race_no,boat_no,data_timing,is_female_race,national_win_rate,local_win_rate,average_st,motor_2_rate,boat_2_rate,exhibition_time,exhibition_st,lap_time,turn_time,straight_time,wind_speed,wave_height,finish_position')
  .eq('data_timing', timing)
  .gte('race_date', startDate)
  .lte('race_date', endDate)
  .order('race_date')
  .limit(100000);
if (error) throw error;

const grouped = new Map();
for (const row of rows || []) {
  const key = keyOf(row);
  if (!grouped.has(key)) grouped.set(key, []);
  grouped.get(key).push(row);
}

const evaluated = [];
for (const entries of grouped.values()) {
  if (entries.length !== 6) continue;
  const winner = entries.find((row) => Number(row.finish_position) === 1)?.boat_no;
  if (!winner) continue;
  const first = entries[0];
  const result = buildTrinityCoreV0({
    event: { race_date: first.race_date, course_code: first.course_code, race_no: first.race_no, wind_speed: first.wind_speed, wave_height: first.wave_height },
    entries,
    timing,
  });
  if (result.ok) evaluated.push({ race_date: first.race_date, course_code: first.course_code, race_no: first.race_no, winner, result });
}
evaluated.sort((a, b) => `${a.race_date}-${a.course_code}-${a.race_no}`.localeCompare(`${b.race_date}-${b.course_code}-${b.race_no}`));

// Chronological 60/20/20 split. Never shuffle time-series race data.
const n = evaluated.length;
const trainEnd = Math.floor(n * 0.60);
const validationEnd = Math.floor(n * 0.80);
const splitRows = {
  train: evaluated.slice(0, trainEnd),
  validation: evaluated.slice(trainEnd, validationEnd),
  test: evaluated.slice(validationEnd),
};

const splits = {};
for (const [name, races] of Object.entries(splitRows)) {
  const stats = emptyStats();
  for (const race of races) addRace(stats, race.result, race.winner);
  splits[name] = {
    range: { start: races[0]?.race_date ?? null, end: races.at(-1)?.race_date ?? null },
    ...summarize(stats),
  };
}

const allStats = emptyStats();
for (const race of evaluated) addRace(allStats, race.result, race.winner);

console.log(JSON.stringify({
  engine: 'trinity-core-v0',
  period: { start: startDate, end: endDate, requested_days: days, timing },
  split_policy: { method: 'chronological', train: 0.60, validation: 0.20, test: 0.20, shuffled: false },
  all: summarize(allStats),
  splits,
  guardrails: [
    'TRAIN may be used to fit candidate weights.',
    'VALIDATION may be used to choose among candidate configurations.',
    'TEST is a final holdout and must not be used to tune weights or thresholds.',
    'If TEST is inspected and then parameters are changed, create a newer future holdout before claiming improvement.',
  ],
  cautions: [
    'Read-only backtest: no database writes.',
    'v0 compares top-ranked first-place picks only; it is not a trifecta or ROI test.',
    'Hatsune denominator is restricted to all-female races.',
  ],
}, null, 2));
