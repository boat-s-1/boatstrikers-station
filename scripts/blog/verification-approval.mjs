import { randomUUID, createHash } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync, readFileSync, lstatSync, readdirSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';
import { STAGES, validatePlan, estimateTotal, assertSafe, externalPath, hold } from './verification-budget.mjs';
import { verifySource } from './verification-source.mjs';

export function codeDigest(repo) {
  const identity = verifySource(repo);
  const hash = createHash('sha256').update(JSON.stringify(identity)).update('\0');
  function visit(path) {
    const stat = lstatSync(path);
    if (stat.isSymbolicLink()) hold('SOURCE_SYMLINK');
    if (stat.isDirectory()) { for (const name of readdirSync(path).sort()) visit(join(path, name)); }
    else if (stat.isFile()) hash.update(relative(repo, path)).update('\0').update(readFileSync(path)).update('\0');
    else hold('SOURCE_TYPE');
  }
  for (const name of ['lib','scripts/blog','tests/blog/fixtures','package.json']) visit(join(repo, name));
  return hash.digest('hex');
}
export function fingerprint(p, sourceDigest) { return createHash('sha256').update(JSON.stringify({ plan: p, sourceDigest })).digest('hex'); }
export function approvalPhrase(p, sourceDigest) {
  return `APPROVE ${fingerprint(p, sourceDigest)} MODEL=${p.model} BUDGET=1000JPY LIMIT=700JPY RESERVE=${estimateTotal(p)}JPY CALLS=4 OUT=${p.output}`;
}
export async function issueApproval({ plan, sourceDigest, confirm, now = Date.now() }) {
  validatePlan(plan, now);
  if (!/^[a-f0-9]{64}$/.test(sourceDigest)) hold('SOURCE_DIGEST');
  if (estimateTotal(plan) > 700) hold('BUDGET_EXCEEDED');
  if (existsSync(plan.output)) hold('OUTPUT_ALREADY_EXISTS');
  const phrase = approvalPhrase(plan, sourceDigest);
  if (typeof confirm !== 'function' || await confirm(phrase) !== phrase) hold('APPROVAL_REQUIRED');
  const record = { id: randomUUID(), fingerprint: fingerprint(plan, sourceDigest), issuedAt: now, expiresAt: now + 3600000, stages: STAGES };
  const directory = join(plan.stateDir, 'approvals');
  externalPath(directory);
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  writeFileSync(join(directory, `${record.id}.json`), assertSafe(record), { flag: 'wx', mode: 0o600 });
  return record.id;
}
export function consumeApproval({ plan, id, sourceDigest, now = Date.now() }) {
  validatePlan(plan, now);
  if (typeof id !== 'string' || !/^[a-f0-9-]{36}$/.test(id)) hold('APPROVAL_REQUIRED');
  const file = join(plan.stateDir, 'approvals', `${id}.json`);
  externalPath(join(plan.stateDir, 'approvals'));
  if (!existsSync(file) || !lstatSync(file).isFile()) hold('INVALID_APPROVAL');
  let record; try { record = JSON.parse(readFileSync(file, 'utf8')); } catch { hold('INVALID_APPROVAL'); }
  if (record.id !== id || record.fingerprint !== fingerprint(plan, sourceDigest) || !Number.isFinite(record.issuedAt) || record.issuedAt > now || record.expiresAt !== record.issuedAt + 3600000 || record.expiresAt <= now || JSON.stringify(record.stages) !== JSON.stringify(STAGES)) hold('INVALID_APPROVAL');
  // Exclusive create is atomic across processes; crashes/cancellation never restore approval.
  try { writeFileSync(join(plan.stateDir, 'approvals', `${id}.used`), 'consumed\n', { flag: 'wx', mode: 0o600 }); }
  catch { hold('APPROVAL_USED'); }
  return record;
}
