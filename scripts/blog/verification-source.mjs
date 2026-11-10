import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BASE, hold } from './verification-budget.mjs';

// Source policy is code, never an option in a plan, approval or environment variable.
const BRANCHES = new Set(['verification/pr295-safety', 'verification/pr295-ai-safety-guards']);
const WRAPPERS = new Map([
  ['scripts/blog/openai-smoke.mjs', 'bbab5a721e1f790d7e0676bbf874f6632225e3ddd440b654850df883b131b1b5'],
  ['scripts/blog/run-local-ai-verification.mjs', '3cacd1a5df3c96c329b8a668ca176b1a5edfba4e3f1f85436633dd5756e6bcce'],
  ['scripts/blog/verify-real-articles.mjs', '3927befcc86c1647bfeb5cd7b8a18108ff8a6b2bbb6c73242c3f96331661bc93'],
]);
const ADDED = new Set([
  ...['approval','budget','cli','offline','source','transport','worker'].map(n => `scripts/blog/verification-${n}.${n === 'offline' ? 'cjs' : 'mjs'}`),
  'tests/blog/aiVerificationBudget.test.mjs', 'tests/blog/aiVerificationSource.test.mjs',
  'tests/blog/aiVerificationSmokeOnly.test.mjs',
  ...['VERIFICATION-BUDGET-SAFETY','REAL-AI-THREE-ARTICLE-PLAN','REAL-AI-ARTICLE-EVALUATION','REAL-AI-FINAL-PREFLIGHT','REAL-AI-EXECUTION-CHECKLIST','REAL-AI-SMOKE-ONLY-PLAN'].map(n => `docs/blog/${n}.md`),
]);
const SCOPES = ['lib', 'scripts/blog', 'tests/blog/fixtures', 'package.json'];
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

export function verifySource(repo) {
  const git = (...args) => {
    try { return execFileSync('git', ['--no-replace-objects', '-C', repo, ...args], { maxBuffer: 16 * 1024 * 1024, stdio: ['pipe','pipe','pipe'] }); }
    catch { hold('SOURCE_GIT'); }
  };
  const text = (...args) => git(...args).toString('utf8').trim();
  const branch = text('symbolic-ref', '--short', 'HEAD');
  if (!BRANCHES.has(branch)) hold('SOURCE_BRANCH');
  // --no-replace-objects prevents local replacement refs from inventing ancestry.
  git('merge-base', '--is-ancestor', BASE, 'HEAD');
  const head = text('rev-parse', 'HEAD');
  const baseline = new Map(git('ls-tree', '-r', '-z', BASE, '--', ...SCOPES).toString('utf8').split('\0').filter(Boolean).map(line => {
    const [meta, path] = line.split('\t'); return [path, meta.split(' ')[2]];
  }));
  function changes(args, read) {
    const fields = git(...args).toString('utf8').split('\0').filter(Boolean);
    for (let i = 0; i < fields.length; i += 2) {
      const status = fields[i], path = fields[i + 1];
      if (WRAPPERS.has(path) && status === 'M') {
        if (sha256(read(path)) !== WRAPPERS.get(path)) hold('SOURCE_WRAPPER_CHANGED');
      } else if (!ADDED.has(path) || !['A','M'].includes(status)) hold('SOURCE_UNEXPECTED_CHANGE');
    }
  }
  // Check every intermediate commit: changing then reverting protected code is not accepted.
  const commits = text('rev-list', '--reverse', `${BASE}..HEAD`).split('\n').filter(Boolean);
  for (const commit of commits) {
    const parents = text('rev-list', '--parents', '-n', '1', commit).split(' ').slice(1);
    if (parents.length !== 1) hold('SOURCE_MERGE');
    changes(['diff-tree','--no-commit-id','--name-status','--no-renames','-r','-z',parents[0],commit], p => git('show', `${commit}:${p}`));
  }
  // Also inspect index and working tree. New allowed files are not assumed committed.
  changes(['diff','--cached','--name-status','--no-renames','-z',BASE], p => git('show', `:${p}`));
  changes(['diff','--name-status','--no-renames','-z',BASE], p => readFileSync(join(repo, p)));
  for (const p of git('ls-files','--others','--exclude-standard','-z').toString('utf8').split('\0').filter(Boolean)) {
    if (p !== 'node_modules' && !p.startsWith('node_modules/') && !ADDED.has(p)) hold('SOURCE_UNEXPECTED_FILE');
  }
  // Read execution dependencies directly too; assume-unchanged/skip-worktree cannot hide edits.
  for (const [path, oid] of baseline) {
    let stat, bytes;
    try { stat = lstatSync(join(repo, path)); bytes = readFileSync(join(repo, path)); } catch { hold('SOURCE_MISSING'); }
    if (!stat.isFile() || stat.isSymbolicLink()) hold('SOURCE_TYPE');
    const actual = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
    if (actual !== oid && (!WRAPPERS.has(path) || sha256(bytes) !== WRAPPERS.get(path))) hold('SOURCE_BASELINE_CHANGED');
  }
  return { base: BASE, head, branch };
}
