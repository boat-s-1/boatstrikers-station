import { existsSync, realpathSync, lstatSync, readdirSync, mkdirSync, readFileSync, writeFileSync, renameSync, rmSync } from 'node:fs';
import { resolve, dirname, join, isAbsolute } from 'node:path';

export const MODEL = 'gpt-6.1-terra';
export const BASE = '94677eedebfffb7cfef3f857e3d2a87a0f42a61d';
export const STAGES = ['smoke', 'ichika', 'hatsune', 'kiina'];
export function executionMode(p) {
  if (p.mode === undefined || p.mode === 'four-stage') return 'four-stage';
  if (p.mode === 'smoke-only') return 'smoke-only';
  if (p.mode === 'ichika-only') return 'ichika-only';
  hold('EXECUTION_MODE');
}
export function stagesFor(p) { const mode=executionMode(p);return mode==='smoke-only'?['smoke']:mode==='ichika-only'?['ichika']:[...STAGES]; }
export function outputCap(p,stage){return stage==='smoke'?1000:executionMode(p)==='ichika-only'?p.outputTokens:p.articleOutputTokens;}
export function hold(code) { throw new Error(`HOLD:${code}`); }
export function assertSafe(value, secrets = []) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  if (typeof text !== 'string') hold('UNSERIALIZABLE');
  if (/\bsk-[A-Za-z0-9_-]{8,}|Bearer\s+\S+|(?:api[_-]?key|authorization|replacement[_-]?token)\s*["']?\s*[:=]/i.test(text)) hold('SECRET_CONTENT');
  for (const s of secrets.filter(Boolean)) {
    const forms = [s, encodeURIComponent(s), Buffer.from(s).toString('base64'), Buffer.from(s).toString('base64url'), JSON.stringify(s).slice(1, -1)];
    if (forms.some(v => text.includes(v))) hold('SECRET_CONTENT');
  }
  return text;
}

// Resolve existing ancestors too: a symlink cannot disguise a repository output path.
export function externalPath(path) {
  if (typeof path !== 'string' || !isAbsolute(path)) hold('ABSOLUTE_EXTERNAL_PATH_REQUIRED');
  const parts = []; let parent = resolve(path);
  while (!existsSync(parent)) { parts.unshift(parent.slice(dirname(parent).length + (dirname(parent) === '/' ? 0 : 1))); parent = dirname(parent); }
  const actual = resolve(realpathSync(parent), ...parts);
  for (let d = actual;; d = dirname(d)) {
    const marker = join(d, '.git');
    // Cloud mounts empty .git sentinels at /workspace and /tmp. They are not repositories.
    if (existsSync(marker) && (!lstatSync(marker).isDirectory() || readdirSync(marker).length > 0)) hold('PATH_INSIDE_GIT');
    if (d === dirname(d)) break;
  }
  if (actual !== resolve(path)) hold('SYMLINK_PATH');
  return actual;
}
function keys(object, expected) {
  if (!object || typeof object !== 'object' || Array.isArray(object) || Object.keys(object).sort().join(',') !== [...expected].sort().join(',')) hold('PLAN_FIELDS');
}
export function validatePlan(p, now = Date.now()) {
  assertSafe(p);
  const mode = executionMode(p);
  const common = ['model','budgetYen','limitYen','margin','inputTokens','inputUsdPerMillion','outputUsdPerMillion','usdJpy','pricingSource','fxSource','ratesVerifiedAt','output','stateDir','maxCalls'];
  const single=mode==='smoke-only'||mode==='ichika-only';
  keys(p, [...common, ...(single ? ['mode','serviceTier','store','outputTokens',...(mode==='ichika-only'?['caseKey','inputDataHash','snapshotPath','snapshotHash']:[])] : ['articleOutputTokens', ...(Object.hasOwn(p, 'mode') ? ['mode'] : [])])]);
  if (p.model !== MODEL || p.budgetYen !== 1000 || p.limitYen !== 700 || p.maxCalls !== stagesFor(p).length) hold('FIXED_LIMITS');
  if (single && (p.serviceTier !== 'default' || p.store !== false || p.inputTokens !== 100000 || p.outputTokens !== (mode==='ichika-only'?12000:1000) || p.inputUsdPerMillion !== 1 || p.outputUsdPerMillion !== 5 || p.usdJpy !== 170 || p.margin !== 0.2)) hold('SINGLE_FIXED_LIMITS');
  if(mode==='ichika-only'){
    if(p.caseKey!=='ichika-kiryu-inside'||!(/^[a-f0-9]{64}$/).test(p.inputDataHash)||!(/^[a-f0-9]{64}$/).test(p.snapshotHash))hold('ICHIKA_BINDING');
    const path=externalPath(p.snapshotPath);
    if(path===p.output||path.startsWith(p.output+'/')||path===p.stateDir||path.startsWith(p.stateDir+'/'))hold('SNAPSHOT_SEPARATE_PATH');
  }
  for (const k of ['inputUsdPerMillion','outputUsdPerMillion','usdJpy']) if (!Number.isFinite(p[k]) || p[k] <= 0) hold('RATES_REQUIRED');
  if (!Number.isFinite(p.margin) || p.margin < 0.1 || p.margin > 1) hold('MARGIN');
  if (!Number.isSafeInteger(p.inputTokens) || p.inputTokens < 4096 || p.inputTokens > 1000000) hold('INPUT_LIMIT');
  if (mode === 'four-stage' && (!Number.isSafeInteger(p.articleOutputTokens) || p.articleOutputTokens < 1000 || p.articleOutputTokens > 12000)) hold('OUTPUT_LIMIT');
  const age = now - Date.parse(p.ratesVerifiedAt);
  if (!Number.isFinite(age) || age < 0 || age > 7 * 86400000) hold('STALE_RATES');
  for (const k of ['pricingSource','fxSource']) {
    let u; try { u = new URL(p[k]); } catch { hold('RATE_SOURCE'); }
    if (u.protocol !== 'https:' || u.username || u.password || u.search || u.hash || u.hostname === 'api.openai.com') hold('RATE_SOURCE');
  }
  const output = externalPath(p.output), state = externalPath(p.stateDir);
  if (output === state || output.startsWith(state + '/') || state.startsWith(output + '/')) hold('SEPARATE_STATE_OUTPUT');
  return p;
}
export function estimate(p, stage) {
  if (!stagesFor(p).includes(stage)) hold('STAGE');
  const output = outputCap(p,stage);
  return Math.ceil(((p.inputTokens * p.inputUsdPerMillion + output * p.outputUsdPerMillion) / 1e6) * p.usdJpy * (1 + p.margin) * 100) / 100;
}
export function estimateTotal(p) { return Math.ceil(stagesFor(p).reduce((sum, s) => sum + estimate(p, s), 0) * 100) / 100; }
export function reserveBudget(p, id, now = Date.now()) {
  validatePlan(p, now);
  if (typeof id !== 'string' || !/^[a-f0-9-]{36}$/.test(id)) hold('RESERVATION_ID');
  const amountYen = estimateTotal(p);
  if (amountYen > p.limitYen) hold('BUDGET_EXCEEDED');
  mkdirSync(p.stateDir, { recursive: true, mode: 0o700 });
  const lock = join(p.stateDir, 'budget.lock');
  try { mkdirSync(lock, { mode: 0o700 }); } catch { hold('BUDGET_LOCKED'); }
  try {
    const file = join(p.stateDir, 'budget.json');
    if (existsSync(file) && !lstatSync(file).isFile()) hold('BUDGET_FILE');
    const ledger = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : { limitYen: 700, reservations: [] };
    if (ledger.limitYen !== 700 || !Array.isArray(ledger.reservations) || ledger.reservations.some(r => !Number.isFinite(r.amountYen) || r.amountYen <= 0 || typeof r.id !== 'string')) hold('BUDGET_CORRUPT');
    const spent = ledger.reservations.reduce((sum, r) => sum + r.amountYen, 0);
    if (ledger.reservations.some(r => r.id === id)) hold('BUDGET_REPLAY');
    if (Math.ceil((spent + amountYen) * 100) > 70000) hold('BUDGET_EXCEEDED');
    ledger.reservations.push({ id, amountYen, mode: executionMode(p) });
    const tmp = join(p.stateDir, `budget-${id}.tmp`);
    writeFileSync(tmp, assertSafe(ledger), { flag: 'wx', mode: 0o600 });
    renameSync(tmp, file);
    return amountYen;
  } finally { rmSync(lock, { recursive: true }); }
}
