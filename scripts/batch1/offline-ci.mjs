import { readlinkSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../', import.meta.url));
if (process.env.BATCH1_NETWORK_NAMESPACE !== 'required' ||
    readlinkSync('/proc/self/ns/net') === readlinkSync('/proc/1/ns/net') ||
    Object.values(networkInterfaces()).flat().some(n => !n.internal)) {
  throw new Error('OS network isolation required; no fallback');
}
const env = { PATH: '/usr/bin:/bin', NODE_OPTIONS: `--require=${root}scripts/batch1/deny-network.cjs` };
const tests = [
  'tests/batch1-claim.test.mjs', 'tests/batch1-generator.test.mjs',
  'tests/batch1-rss-diagnostics.test.mjs', 'tests/batch1-isolation.test.mjs',
  'tests/batch1-actions.test.mjs',
  'tests/data-lab-prompts.test.mjs', 'tests/news-digest-protection.test.mjs',
  'tests/race-incidents.test.mjs', 'tests/winning-technique.test.mjs',
  'tests/trinity/shadow.test.mjs',
  'scripts/trinity/official-racelist.test.mjs', 'scripts/trinity/dispatch-guard.test.mjs',
  'scripts/trinity/shadow-coverage.test.mjs',
];
for (const args of [['--test', '--import', './scripts/batch1/register-test-hooks.mjs', ...tests], ['review/batch1/build.mjs']]) {
  const result = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit',
    env: args[0] === '--test' ? env : { PATH: '/usr/bin:/bin', BATCH1_REVIEW_ONLY: '1',
      BATCH1_SOURCE_REF: 'codex/batch1-reconstructed-20261115' } });
  if (result.error || result.status !== 0) process.exit(result.status || 1);
}
