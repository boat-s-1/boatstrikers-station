import { randomUUID, createHash } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync, readFileSync, lstatSync, readdirSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BASE, stagesFor, executionMode, validatePlan, estimateTotal, assertSafe, externalPath, hold } from './verification-budget.mjs';
import { verifySource } from './verification-source.mjs';
import { prepareIchika } from './verification-ichika.mjs';
import { canonical } from './verification-snapshot.mjs';
const SOURCE_REPO = fileURLToPath(new URL('../..', import.meta.url));

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
export function approvalPhrase(p, sourceDigest, head = verifySource(SOURCE_REPO).head) {
  const binding=executionMode(p)==='ichika-only'?` CASE=${p.caseKey} INPUT=${p.inputDataHash} SNAPSHOT=${p.snapshotHash}`:'';
  return `APPROVE ${fingerprint(p, sourceDigest)} MODE=${executionMode(p)} HEAD=${head} SOURCE=${sourceDigest} MODEL=${p.model} BUDGET=1000JPY LIMIT=700JPY RESERVE=${estimateTotal(p)}JPY CALLS=${stagesFor(p).length} OUT=${p.output}${binding}`;
}
export async function issueApproval({ plan, sourceDigest, confirm, now = Date.now(), repo = SOURCE_REPO }) {
  validatePlan(plan, now);
  if (!/^[a-f0-9]{64}$/.test(sourceDigest)) hold('SOURCE_DIGEST');
  if (estimateTotal(plan) > 700) hold('BUDGET_EXCEEDED');
  if (existsSync(plan.output)) hold('OUTPUT_ALREADY_EXISTS');
  const identity = verifySource(repo);
  if (codeDigest(repo) !== sourceDigest) hold('SOURCE_DIGEST');
  const prepared=prepareIchika(plan,repo,now);
  const phrase = approvalPhrase(plan, sourceDigest, identity.head);
  if (typeof confirm !== 'function' || await confirm(phrase) !== phrase) hold('APPROVAL_REQUIRED');
  if (codeDigest(repo) !== sourceDigest) hold('SOURCE_CHANGED_DURING_APPROVAL');
  if(prepared)prepareIchika(plan,repo,Date.now());
  const record = { version: prepared?3:2, id: randomUUID(), mode: executionMode(plan), base: BASE, head: identity.head, sourceDigest, fingerprint: fingerprint(plan, sourceDigest), issuedAt: now, expiresAt: now + 3600000, stages: stagesFor(plan),...(prepared?{artifacts:prepared.binding}:{}) };
  const directory = join(plan.stateDir, 'approvals');
  externalPath(directory);
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  writeFileSync(join(directory, `${record.id}.json`), assertSafe(record), { flag: 'wx', mode: 0o600 });
  return record.id;
}
export function consumeApproval({ plan, id, sourceDigest, now = Date.now(), repo = SOURCE_REPO }) {
  validatePlan(plan, now);
  if (typeof id !== 'string' || !/^[a-f0-9-]{36}$/.test(id)) hold('APPROVAL_REQUIRED');
  const file = join(plan.stateDir, 'approvals', `${id}.json`);
  externalPath(join(plan.stateDir, 'approvals'));
  if (!existsSync(file) || !lstatSync(file).isFile()) hold('INVALID_APPROVAL');
  let record; try { record = JSON.parse(readFileSync(file, 'utf8')); } catch { hold('INVALID_APPROVAL'); }
  const identity = verifySource(repo);
  const prepared=prepareIchika(plan,repo,now);
  if (record.version !== (prepared?3:2) || record.id !== id || record.mode !== executionMode(plan) || record.base !== BASE || record.head !== identity.head || record.sourceDigest !== sourceDigest || codeDigest(repo) !== sourceDigest || record.fingerprint !== fingerprint(plan, sourceDigest) || !Number.isFinite(record.issuedAt) || record.issuedAt > now || record.expiresAt !== record.issuedAt + 3600000 || record.expiresAt <= now || JSON.stringify(record.stages) !== JSON.stringify(stagesFor(plan)) || (prepared&&canonical(record.artifacts)!==canonical(prepared.binding))) hold('INVALID_APPROVAL');
  // Exclusive create is atomic across processes; crashes/cancellation never restore approval.
  try { writeFileSync(join(plan.stateDir, 'approvals', `${id}.used`), 'consumed\n', { flag: 'wx', mode: 0o600 }); }
  catch { hold('APPROVAL_USED'); }
  return record;
}
