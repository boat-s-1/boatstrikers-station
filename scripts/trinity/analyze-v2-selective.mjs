import { readFileSync } from 'node:fs';
import { buildTrinityCoreV2 } from '../../app/lib/trinityCoreV2.js';

// Exported rows are a read-only copy of historical database rows. This script
// intentionally does not claim they were available at the prediction cutoff.
const input = process.argv[2];
if (!input) throw new Error('Usage: node scripts/trinity/analyze-v2-selective.mjs <export.jsonl>');
const columns = ['race_date', 'course_code', 'race_no', 'boat_no', 'national_win_rate',
  'local_win_rate', 'motor_2_rate', 'motor_top2_rate', 'boat_2_rate',
  'race_boat_top2_rate', 'average_st', 'sex_code', 'gender', 'gender_code',
  'race_name', 'deadline_time', 'winning_trifecta', 'trifecta_result',
  'trifecta_payout', 'result_status', 'race_status'];
const records = readFileSync(input, 'utf8').trim().split('\n').flatMap(line =>
  JSON.parse(line).map(values => Object.fromEntries(columns.map((c, i) => [c, values[i]]))));
const key = r => `${r.race_date}:${Number(r.course_code)}:${Number(r.race_no)}`;
const groups = new Map();
for (const row of records) {
  const k = key(row);
  if (!groups.has(k)) groups.set(k, []);
  groups.get(k).push(row);
}
const ticket = s => String(s || '').replace(/[^1-6]/g, '').slice(0, 3).split('').join('-');
const finite = v => { const n = Number(v); return Number.isFinite(n) ? n : null; };
const norm = (v, threshold) => { const n = finite(v); return n === null ? v : n > threshold ? n / 100 : n; };
const safe = e => {
  const motor = e.motor_2_rate ?? e.motor_top2_rate;
  const boat = e.boat_2_rate ?? e.race_boat_top2_rate;
  return { ...e, national_win_rate: norm(e.national_win_rate, 20),
    local_win_rate: norm(e.local_win_rate, 20),
    motor_2_rate: norm(motor, 100), motor_top2_rate: norm(motor, 100),
    boat_2_rate: norm(boat, 100), race_boat_top2_rate: norm(boat, 100),
    average_st: finite(e.average_st) };
};
const settled = [];
for (const [k, six] of groups) {
  if (six.length !== 6 || !six[0].trifecta_payout) continue;
  const actual = ticket(six[0].winning_trifecta || six[0].trifecta_result);
  if (actual.length !== 5) continue;
  const event = Object.fromEntries(['race_date', 'course_code', 'race_no', 'race_name', 'deadline_time']
    .map(c => [c, six[0][c]]));
  const entries = six.sort((a, b) => a.boat_no - b.boat_no).map(safe);
  const p = buildTrinityCoreV2({ event, entries, timing: 'previous_day' });
  if (!p.ok) continue;
  const tickets = p.trinity.selected_tickets;
  const first = p.trinity.first_place_probabilities;
  const sortedFirst = Object.entries(first).sort((a, b) => b[1] - a[1]);
  const hasFive = tickets.some(t => t.combination.includes('5'));
  const genderComplete = entries.every(e => e.sex_code != null || e.gender != null || e.gender_code != null);
  // Mutually exclusive descriptive groups; a mere fifth-boat ticket is too
  // common to identify a Kiina-led race.
  const kiinaLed = Number(sortedFirst[0][0]) === 5 ||
    (p.specialists.kiina.ranking[0].boat_no === 5 &&
      p.trinity.top_combination.combination.includes('5'));
  const type = p.women_race ? 'hatsune' :
    kiinaLed ? 'kiina' :
    Number(sortedFirst[0][0]) === 1 ? 'ichika' : 'other';
  const hit = tickets.some(t => ticket(t.combination) === actual);
  settled.push({ key: k, date: event.race_date, course: Number(event.course_code),
    race_no: Number(event.race_no), count: tickets.length, investment: tickets.length * 100,
    payout: hit ? Number(six[0].trifecta_payout) : 0, hit,
    confidence: p.trinity.top_combination?.probability || 0,
    type, women: p.women_race, genderComplete, hasFive,
    topBoat: Number(sortedFirst[0][0]), firstOne: first[1],
    firstGap: sortedFirst[0][1] - sortedFirst[1][1],
    ichikaTop: p.specialists.ichika.ranking[0].boat_no,
    hatsuneTop: p.specialists.hatsune.ranking[0].boat_no,
    kiinaTop: p.specialists.kiina.ranking[0].boat_no });
}
settled.sort((a, b) => a.key.localeCompare(b.key));
function summary(rows) {
  const bought = rows.filter(r => r.investment);
  const investment = bought.reduce((n, r) => n + r.investment, 0);
  const payout = bought.reduce((n, r) => n + r.payout, 0);
  let losing = 0, maxLosing = 0;
  for (const r of bought) { losing = r.hit ? 0 : losing + 1; maxLosing = Math.max(maxLosing, losing); }
  const without = n => {
    const winners = [...bought].sort((a, b) => b.payout - a.payout).slice(0, n);
    const excluded = new Set(winners.map(r => r.key));
    const kept = bought.filter(r => !excluded.has(r.key));
    return kept.length ? kept.reduce((s, r) => s + r.payout, 0) /
      kept.reduce((s, r) => s + r.investment, 0) * 100 : 0;
  };
  return { races: rows.length, bought_races: bought.length,
    investment, payout, roi: investment ? payout / investment * 100 : 0,
    hits: bought.filter(r => r.hit).length,
    hit_rate: bought.length ? bought.filter(r => r.hit).length / bought.length * 100 : 0,
    avg_tickets: bought.length ? investment / 100 / bought.length : 0,
    average_hit_payout: bought.some(r => r.hit) ? payout / bought.filter(r => r.hit).length : 0,
    max_losing_streak: maxLosing, roi_without_top1: without(1), roi_without_top3: without(3) };
}
const by = (rows, value) => Object.fromEntries([...Map.groupBy(rows, value)]
  .sort(([a], [b]) => String(a).localeCompare(String(b), undefined, { numeric: true }))
  .map(([k, v]) => [k, summary(v)]));
const bought = settled.filter(r => r.investment);
const ranked = [...bought].sort((a, b) => b.confidence - a.confidence || a.key.localeCompare(b.key));
const top = ranked.slice(0, Math.floor(bought.length * 0.2));
const train = r => r.date < '2026-09-01';
const trainBought = bought.filter(train);
const trainRanked = [...trainBought].sort((a, b) => b.confidence - a.confidence || a.key.localeCompare(b.key));
const trainingThreshold = trainRanked[Math.floor(trainRanked.length * 0.2) - 1]?.confidence;
const selectedByTrainingThreshold = bought.filter(r => r.confidence >= trainingThreshold);
const bins = (rows, field, edges) => by(rows, r => {
  const i = edges.findIndex(bound => r[field] < bound);
  return i < 0 ? `>=${edges.at(-1)}` : i === 0 ? `<${edges[0]}` : `${edges[i - 1]}-${edges[i]}`;
});
console.log(JSON.stringify({ provenance: 'current historical rows; not as-of snapshots',
  period: { from: settled[0]?.date, to: settled.at(-1)?.date },
  baseline: summary(settled), monthly: by(settled, r => r.date.slice(0, 7)),
  gender_completeness: by(settled, r => `${r.date.slice(0, 7)}:${r.genderComplete}`),
  top20: { size: top.length, threshold: top.at(-1)?.confidence,
    summary: summary(top), by_character: by(top, r => r.type),
    by_ticket_count: by(top, r => r.count),
    by_month: by(top, r => r.date.slice(0, 7)),
    by_course: by(top, r => r.course), by_race_no: by(top, r => r.race_no),
    by_women: by(top, r => r.women), by_five_ticket: by(top, r => r.hasFive),
    by_top_boat: by(top, r => r.topBoat),
    by_first_one: bins(top, 'firstOne', [0.2, 0.3, 0.4, 0.5, 0.6]),
    by_first_gap: bins(top, 'firstGap', [0.05, 0.1, 0.15, 0.2, 0.3]),
    by_train_validation: by(top, r => train(r) ? 'train_Jul_Aug' : 'validation_Sep'),
    character_by_split: by(top, r => `${train(r) ? 'train' : 'validation'}:${r.type}`) },
  all_ticket_counts: by(bought, r => r.count),
  frozen_train_threshold: { confidence: trainingThreshold,
    selected_train: summary(selectedByTrainingThreshold.filter(train)),
    selected_validation: summary(selectedByTrainingThreshold.filter(r => !train(r))),
    selected_by_character_and_split: by(selectedByTrainingThreshold,
      r => `${train(r) ? 'train' : 'validation'}:${r.type}`),
    baseline_train: summary(settled.filter(train)),
    baseline_validation: summary(settled.filter(r => !train(r))) } }, null, 2));
