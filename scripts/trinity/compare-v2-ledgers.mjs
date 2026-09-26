import { readFileSync } from 'node:fs';

const [priorPath, currentPath] = process.argv.slice(2);
if (!priorPath || !currentPath) {
  throw new Error('Usage: node scripts/trinity/compare-v2-ledgers.mjs <original-71.43-ledger.jsonl> <current-ledger.jsonl>');
}
const read = path => new Map(readFileSync(path, 'utf8').trim().split('\n')
  .map(line => JSON.parse(line)).map(row => [row.key, row]));
const prior = read(priorPath), current = read(currentPath);
const fields = ['ticket_count', 'investment', 'official_payout', 'payout', 'hit', 'actual',
  'top', 'tickets', 'result_status', 'race_status', 'normalized_inputs'];
const differences = [];
for (const key of [...new Set([...prior.keys(), ...current.keys()])].sort()) {
  const a = prior.get(key), b = current.get(key);
  if (!a || !b) { differences.push({ key, missing_from: a ? 'current' : 'prior' }); continue; }
  const changed = fields.filter(field => JSON.stringify(a[field]) !== JSON.stringify(b[field]));
  if (changed.length) differences.push({ key, changed,
    prior: Object.fromEntries(changed.map(field => [field, a[field]])),
    current: Object.fromEntries(changed.map(field => [field, b[field]])) });
}
console.log(JSON.stringify({ prior_races: prior.size, current_races: current.size,
  changed_races: differences.length, differences }, null, 2));
