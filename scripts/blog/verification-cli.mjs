import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { validatePlan, assertSafe, estimateTotal, externalPath, hold } from './verification-budget.mjs';
import { codeDigest, issueApproval } from './verification-approval.mjs';
import { REPO, terminalConfirm } from './verification-worker.mjs';
import { prepareIchika } from './verification-ichika.mjs';

// Only this child receives the proxy placeholder under OPENAI_API_KEY. Never copy it to a file or argv.
export function childEnvironment(env) {
  const result = {};
  for (const k of ['PATH','HOME','TMPDIR','SYSTEMROOT','HTTP_PROXY','HTTPS_PROXY','NO_PROXY','http_proxy','https_proxy','no_proxy','NODE_EXTRA_CA_CERTS','SSL_CERT_FILE','SSL_CERT_DIR']) if (env[k]) result[k] = env[k];
  if (!env.BOATSTRIKERS_OPENAI_HTTP_KEY) hold('HTTP_SECRET_REQUIRED');
  result.OPENAI_API_KEY = env.BOATSTRIKERS_OPENAI_HTTP_KEY;
  return result;
}
export async function cli(argv = process.argv.slice(2)) {
  const [command, filename, id] = argv;
  if (!['preflight','approve','run'].includes(command) || !filename || argv.length !== (command === 'run' ? 3 : 2)) hold('DEFAULT_HOLD');
  const plan = JSON.parse(readFileSync(externalPath(resolve(filename)), 'utf8'));
  validatePlan(plan);
  const sourceDigest = codeDigest(REPO);
  prepareIchika(plan,REPO);
  assertSafe(plan, [process.env.BOATSTRIKERS_OPENAI_HTTP_KEY, process.env.OPENAI_API_KEY]);
  if (estimateTotal(plan) > 700) hold('BUDGET_EXCEEDED');
  if (command === 'preflight') { console.log(`PASS: offline plan validation; reserved=${estimateTotal(plan)}JPY; real API remains HOLD`); return; }
  if (command === 'approve') {
    const approval = await issueApproval({ plan, sourceDigest, confirm: terminalConfirm });
    console.log(`Approval ID: ${approval}`); return;
  }
  if (Number(process.versions.node.split('.')[0]) !== 24) hold('NODE24_REQUIRED');
  const env = childEnvironment(process.env);
  const child = spawn(process.execPath, ['--use-env-proxy', fileURLToPath(new URL('./verification-worker.mjs', import.meta.url)), resolve(filename), id], { env, stdio: 'inherit', shell: false });
  await new Promise((res, reject) => { child.once('error', () => reject(new Error('HOLD:CHILD_START'))); child.once('exit', code => { process.exitCode = code === 0 ? 0 : 1; res(); }); });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await cli(); } catch { console.error('HOLD: no real execution without a valid plan and one-use approval'); process.exitCode = 1; }
}
