import { createClient } from '@supabase/supabase-js';
import { buildTrinityCoreV0 } from '../app/lib/trinityCoreV0.js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('SUPABASE URL/service role key are required');

const supabase = createClient(url, key, { auth: { persistSession: false } });
const days = Math.max(1, Math.min(730, Number(process.argv[2] || 30)));
const timing = process.argv[3] === 'after_exhibition' ? 'after_exhibition' : 'previous_day';
const end = new Date();
const start = new Date(end);
start.setUTCDate(start.getUTCDate() - days);
const startDate = start.toISOString().slice(0, 10);
const endDate = end.toISOString().slice(0, 10);

function keyOf(row) { return `${row.race_date}|${row.course_code}|${row.race_no}`; }
function pct(n, d) { return d ? Number(((n / d) * 100).toFixed(2)) : null; }

const { data: rows, error } = await supabase
  .from('ai_v2_training_rows')
  .select('race_date,course_code,race_no,boat_no,data_timing,is_female_race,national_win_rate,local_win_rate,average_st,motor_2_rate,boat_2_rate,exhibition_time,exhibition_st,lap_time,turn_time,straight_time,wind_speed,wave_height,finish_position')
  .eq('data_timing', timing)
  .gte('race_date', startDate)
  .lte('race_date', endDate)
  .order('race_date')
  .limit(50000);
if (error) throw error;

const races = new Map();
for (const row of rows || []) {
  const key = keyOf(row);
  if (!races.has(key)) races.set(key, []);
  races.get(key).push(row);
}

const stats = {
  races: 0,
  ichika: { hits: 0, eligible: 0 },
  hatsune: { hits: 0, eligible: 0 },
  kiina: { hits: 0, eligible: 0 },
  trinity: { hits: 0, eligible: 0 },
};

for (const entries of races.values()) {
  if (entries.length !== 6) continue;
  const winner = entries.find((row) => Number(row.finish_position) === 1)?.boat_no;
  if (!winner) continue;
  const first = entries[0];
  const result = buildTrinityCoreV0({
    event: { race_date: first.race_date, course_code: first.course_code, race_no: first.race_no, wind_speed: first.wind_speed, wave_height: first.wave_height },
    entries,
    timing,
  });
  if (!result.ok) continue;
  stats.races += 1;
  for (const character of ['ichika', 'hatsune', 'kiina']) {
    // Hatsune v0 is meaningful only for all-female races; keep denominator honest.
    if (character === 'hatsune' && !result.women_race) continue;
    const pick = result.specialists[character].ranking[0]?.boat_no;
    if (!pick) continue;
    stats[character].eligible += 1;
    if (Number(pick) === Number(winner)) stats[character].hits += 1;
  }
  const trinityPick = result.trinity.top_boat;
  if (trinityPick) {
    stats.trinity.eligible += 1;
    if (Number(trinityPick) === Number(winner)) stats.trinity.hits += 1;
  }
}

const output = {
  engine: 'trinity-core-v0',
  period: { start: startDate, end: endDate, days, timing },
  races: stats.races,
  results: Object.fromEntries(Object.entries(stats).filter(([k]) => k !== 'races').map(([k, v]) => [k, { ...v, hit_rate: pct(v.hits, v.eligible) }])),
  cautions: [
    'Read-only backtest: no database writes.',
    'v0 compares top-ranked first-place picks only; it is not a trifecta or ROI test.',
    'Weights are hypotheses and must not be tuned on the same holdout period used for final evaluation.',
    'Hatsune denominator is restricted to all-female races.',
  ],
};
console.log(JSON.stringify(output, null, 2));
