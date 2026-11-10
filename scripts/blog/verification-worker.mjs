import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';
import { validatePlan, executionMode, reserveBudget, assertSafe, hold } from './verification-budget.mjs';
import { codeDigest, consumeApproval } from './verification-approval.mjs';
import { createGuardedTransport } from './verification-transport.mjs';
import { smoke } from './openai-smoke.mjs';
import { runVerification } from './verify-real-articles.mjs';

export const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export async function terminalConfirm(phrase) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) hold('INTERACTIVE_CONFIRMATION_REQUIRED');
  const io = createInterface({ input: process.stdin, output: process.stdout });
  try { return await io.question(`${phrase}\n上記を完全一致で入力（それ以外は停止）: `); } finally { io.close(); }
}
export function checkRuntime(env = process.env, execArgv = process.execArgv, version = process.versions.node) {
  if (Number(version.split('.')[0]) !== 24) hold('NODE24_REQUIRED');
  if (!execArgv.includes('--use-env-proxy') && env.NODE_USE_ENV_PROXY !== '1') hold('PROXY_NOT_ENABLED');
  if (!env.HTTPS_PROXY && !env.https_proxy) hold('HTTPS_PROXY_REQUIRED');
  if (env.NODE_TLS_REJECT_UNAUTHORIZED === '0') hold('TLS_VERIFICATION_REQUIRED');
}
// Adapt the immutable legacy request builders, then let the guard enforce store:false.
// An explicit unsafe value is never silently corrected.
export function privateRequests(guardedFetch) {
  return (url, init) => {
    const body = JSON.parse(init.body);
    if (body.store !== undefined && body.store !== false) hold('STORE_FALSE_REQUIRED');
    return guardedFetch(url, { ...init, body: JSON.stringify({ ...body, store: false }) });
  };
}
export async function execute({ plan, approvalId, repo = REPO, env = process.env, confirm = terminalConfirm, fetchImpl = globalThis.fetch, runtimeCheck = () => checkRuntime(env), now = Date.now() }) {
  validatePlan(plan, now);
  runtimeCheck();
  if (!env.OPENAI_API_KEY) hold('HTTP_SECRET_REQUIRED');
  const key = env.OPENAI_API_KEY;
  assertSafe(plan, [key]);
  const digest = codeDigest(repo);
  if (existsSync(plan.output)) hold('OUTPUT_ALREADY_EXISTS');
  const approval = consumeApproval({ plan, id: approvalId, sourceDigest: digest, now, repo });
  const reservedYen = reserveBudget(plan, approvalId, now);
  mkdirSync(plan.output, { recursive: true, mode: 0o700 });
  const usage = [];
  const transport = createGuardedTransport({ plan, runId: approvalId, apiKey: key, confirm, fetchImpl, approvalExpiresAt: approval.expiresAt, onRecord: row => usage.push(row) });
  const guardedFetch = privateRequests(transport.fetch);
  const mode = executionMode(plan);
  let status = 'HOLD', results = [];
  try {
    const config = { apiKey: key, model: plan.model, maxOutputTokens: plan.articleOutputTokens, prices: { input: plan.inputUsdPerMillion, output: plan.outputUsdPerMillion } };
    const smokeResult = await smoke({ env: { OPENAI_API_KEY: key, BLOG_AI_MODEL: plan.model }, fetchImpl: guardedFetch });
    if (!smokeResult.ok || transport.stopped) hold('SMOKE_FAILED');
    if (mode === 'four-stage') {
      const verification = await runVerification({ casesFile: join(repo, 'tests/blog/fixtures/real-data/cases.json'), useAi: true, maxCalls: 3, config, fetchImpl: guardedFetch, stopOnFailure: true, log: line => {
        assertSafe(line, [key]); results.push(line);
      } });
      if (transport.stopped || !verification.ok || verification.lines.length !== 3 || verification.lines.some(l => l.verdict !== 'PASS' || l.tampered?.verdict !== 'HOLD' || l.period_removed?.verdict === 'PASS')) hold('QUALITY_GATES');
    }
    status = 'PASS';
  } catch { status = 'HOLD'; }
  // Never serialize upstream errors, request headers, credentials, or arbitrary runtime environment.
  const report = { status, mode, head: approval.head, approvalId, model: plan.model, sourceDigest: digest, reservedYen, limitYen: 700, calls: transport.calls, usage, results };
  let text;
  try { text = assertSafe(report, [key]); } catch { hold('REPORT_SECRET_REJECTED'); }
  writeFileSync(join(plan.output, 'report.json'), text + '\n', { flag: 'wx', mode: 0o600 });
  return { status, calls: transport.calls };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  // Arguments contain only a local plan filename and a non-secret approval identifier.
  try {
    if (process.argv.length !== 4) hold('APPROVAL_REQUIRED');
    const plan = JSON.parse(readFileSync(process.argv[2], 'utf8'));
    const result = await execute({ plan, approvalId: process.argv[3] });
    console.log(`${result.status}: calls=${result.calls}`);
    process.exitCode = result.status === 'PASS' ? 0 : 1;
  } catch { console.error('HOLD: safety prerequisites failed; no automatic retry'); process.exitCode = 1; }
}
