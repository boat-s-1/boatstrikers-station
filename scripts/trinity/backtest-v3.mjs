import { readFileSync } from 'node:fs';
import { buildTrinityCoreV2 } from '../../app/lib/trinityCoreV2.js';
import { selectTrinityV3 } from '../../app/lib/trinitySelectiveV3.js';

const path = process.argv[2];
if (!path) throw new Error('Usage: node scripts/trinity/backtest-v3.mjs <export.jsonl>');
const names = ['race_date','course_code','race_no','boat_no','national_win_rate',
  'local_win_rate','motor_2_rate','motor_top2_rate','boat_2_rate','race_boat_top2_rate',
  'average_st','sex_code','gender','gender_code','race_name','deadline_time',
  'winning_trifecta','trifecta_result','trifecta_payout','result_status','race_status'];
const rows = readFileSync(path, 'utf8').trim().split('\n').flatMap(line => JSON.parse(line)
  .map(values => Object.fromEntries(names.map((name, i) => [name, values[i]]))));
const groups = Map.groupBy(rows, r => `${r.race_date}:${r.course_code}:${r.race_no}`);
const finite = v => { const n = Number(v); return Number.isFinite(n) ? n : null; };
const normalize = (v, max) => { const n = finite(v); return n === null ? v : n > max ? n / 100 : n; };
const ticket = s => String(s || '').replace(/[^1-6]/g, '').slice(0, 3).split('').join('-');
const predictions = [];
for (const [key, six] of groups) {
  const r = six[0];
  if (six.length !== 6 || !r.trifecta_payout) continue;
  const actual = ticket(r.winning_trifecta || r.trifecta_result);
  if (actual.length !== 5) continue;
  const entries = six.sort((a, b) => a.boat_no - b.boat_no).map(e => {
    const motor = normalize(e.motor_2_rate ?? e.motor_top2_rate, 100);
    const boat = normalize(e.boat_2_rate ?? e.race_boat_top2_rate, 100);
    return { ...e, national_win_rate: normalize(e.national_win_rate, 20),
      local_win_rate: normalize(e.local_win_rate, 20),
      motor_2_rate: motor, motor_top2_rate: motor,
      boat_2_rate: boat, race_boat_top2_rate: boat, average_st: finite(e.average_st) };
  });
  const p = buildTrinityCoreV2({ event: r, entries, timing: 'previous_day' });
  if (!p.ok) continue;
  const confidence = p.trinity.top_combination?.probability || 0;
  const base = p.trinity.selected_tickets;
  predictions.push({ key, date: r.race_date, actual, payout: Number(r.trifecta_payout),
    confidence, p, base });
}
const train = predictions.filter(r => r.date < '2026-09-01' && r.base.length)
  .sort((a, b) => b.confidence - a.confidence || a.key.localeCompare(b.key));
const minConfidence = train[Math.floor(train.length * 0.2) - 1]?.confidence;
if (!Number.isFinite(minConfidence)) throw new Error('No training races');
const settled = predictions.map(r => ({
  ...r, selected: selectTrinityV3(r.p, { minConfidence }).selected_tickets,
})).sort((a, b) => a.key.localeCompare(b.key));
function summary(items, field) {
  const bought = items.filter(r => r[field].length);
  const investment = bought.reduce((s, r) => s + r[field].length * 100, 0);
  const winners = bought.filter(r => r[field].some(t => ticket(t.combination) === r.actual));
  const payout = winners.reduce((s, r) => s + r.payout, 0);
  const sortedWinners = [...winners].sort((a, b) => b.payout - a.payout);
  const without = n => {
    const excluded = new Set(sortedWinners.slice(0, n).map(r => r.key));
    const remainingInvestment = bought.filter(r => !excluded.has(r.key))
      .reduce((s, r) => s + r[field].length * 100, 0);
    const remainingPayout = sortedWinners.slice(n).reduce((s, r) => s + r.payout, 0);
    return remainingInvestment ? remainingPayout / remainingInvestment * 100 : 0;
  };
  let streak = 0, maxStreak = 0;
  const hitKeys = new Set(winners.map(r => r.key));
  for (const r of bought) { streak = hitKeys.has(r.key) ? 0 : streak + 1; maxStreak = Math.max(streak, maxStreak); }
  return { races: items.length, bought_races: bought.length, investment, payout,
    hits: winners.length, hit_rate: bought.length ? winners.length / bought.length * 100 : 0,
    roi: investment ? payout / investment * 100 : 0,
    avg_tickets: bought.length ? investment / 100 / bought.length : 0,
    max_losing_streak: maxStreak, roi_without_top1: without(1), roi_without_top3: without(3) };
}
const split = items => ({ baseline_v2: summary(items, 'base'), selective_v3: summary(items, 'selected') });
console.log(JSON.stringify({ caveat: 'Current database rows, not immutable as-of inputs; experimental only',
  minConfidence, training: split(settled.filter(r => r.date < '2026-09-01')),
  validation: split(settled.filter(r => r.date >= '2026-09-01')) }, null, 2));
