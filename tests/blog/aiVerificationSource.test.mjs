import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { BASE, validatePlan } from '../../scripts/blog/verification-budget.mjs';
import { verifySource } from '../../scripts/blog/verification-source.mjs';
import { codeDigest, issueApproval, consumeApproval } from '../../scripts/blog/verification-approval.mjs';
import { REPO } from '../../scripts/blog/verification-worker.mjs';

let root, repo;
const branch = 'verification/pr295-safety';
const git = (...args) => execFileSync('git', ['-C', repo, '-c', 'core.hooksPath=/dev/null', '-c', 'commit.gpgsign=false', '-c', 'user.name=Offline Mock', '-c', 'user.email=offline@example.invalid', ...args], { encoding:'utf8', stdio:['pipe','pipe','pipe'] }).trim();
function reset() {
  git('switch', branch);
  git('reset', '--hard', BASE);
  // This is only the disposable fixture created below, never either user checkout.
  git('clean', '-fd');
}
function add(path, text) { mkdirSync(dirname(join(repo,path)),{recursive:true});writeFileSync(join(repo,path),text);git('add','--',path); }
function commit(message) { return git('commit','-m',message); }
before(() => {
  root=mkdtempSync(join(tmpdir(),'boat-source-policy-'));repo=join(root,'fixture');
  execFileSync('git',['clone','--shared','--no-checkout',REPO,repo],{stdio:'ignore'});
  git('sparse-checkout','init','--cone');git('sparse-checkout','set','lib','scripts/blog','tests/blog/fixtures');
  git('switch','-C',branch,BASE);
});
after(()=>{if(root)rmSync(root,{recursive:true,force:true});});

test('fixed baseline HEAD itself passes on the verification branch',()=>{
  reset();assert.deepEqual(verifySource(repo),{base:BASE,head:BASE,branch});assert.match(codeDigest(repo),/^[a-f0-9]{64}$/);
});
test('committed complete safety addition passes; all existing 44 tests also pass AFTER the commit',()=>{
  reset();git('sparse-checkout','disable');
  const changed=execFileSync('git',['-C',REPO,'diff','--name-only',BASE],{encoding:'utf8'}).trim().split('\n').filter(Boolean);
  const added=execFileSync('git',['-C',REPO,'ls-files','--others','--exclude-standard'],{encoding:'utf8'}).trim().split('\n').filter(p=>p&&p!=='node_modules');
  for(const p of [...changed,...added]){mkdirSync(dirname(join(repo,p)),{recursive:true});copyFileSync(join(REPO,p),join(repo,p));git('add','--',p);}
  commit('Offline fixture: approved safety additions');
  assert.notEqual(git('rev-parse','HEAD'),BASE);assert.equal(verifySource(repo).base,BASE);assert.match(codeDigest(repo),/^[a-f0-9]{64}$/);
  // Dependency reuse is local only; no install/network. The 44-test suite runs against committed source.
  execFileSync(process.execPath,['-e',`require('node:fs').symlinkSync(process.argv[1],process.argv[2]);`,join(REPO,'node_modules'),join(repo,'node_modules')]);
  const env={...process.env};delete env.NODE_TEST_CONTEXT;
  const out=execFileSync(process.execPath,['--require',join(repo,'scripts/blog/verification-offline.cjs'),'--test','--test-reporter=tap','tests/blog/aiVerificationBudget.test.mjs','tests/blog/aiLocalVerification.test.mjs','tests/blog/aiCostLimits.test.mjs'],{cwd:repo,env,encoding:'utf8',maxBuffer:1024*1024,stdio:['ignore','pipe','pipe']});
  assert.match(out,/(?:tests|# tests) 44/);assert.match(out,/(?:pass|# pass) 44/);assert.match(out,/(?:fail|# fail) 0/);
});
test('unrelated branch is HOLD even with identical baseline contents and ancestry',()=>{
  reset();git('switch','-C','unrelated',BASE);assert.throws(()=>verifySource(repo),/SOURCE_BRANCH/);git('switch',branch);
});
test('approved branch name without baseline ancestry is HOLD',()=>{
  reset();git('switch','--orphan','unrelated-root');add('unrelated.txt','offline fixture');commit('Unrelated root');
  git('branch','-f',branch,'HEAD');git('switch',branch);assert.throws(()=>verifySource(repo),/SOURCE_GIT/);
  git('reset','--hard',BASE);
});
test('unexpected existing verification code change in worktree is HOLD',()=>{
  reset();writeFileSync(join(repo,'lib/blog/ai/gates.mjs'),'// unexpected offline fixture\n');assert.throws(()=>verifySource(repo),/SOURCE_/);
});
test('assume-unchanged cannot hide a protected code change',()=>{
  reset();git('update-index','--assume-unchanged','lib/blog/ai/gates.mjs');
  try{writeFileSync(join(repo,'lib/blog/ai/gates.mjs'),'// hidden offline fixture\n');assert.throws(()=>verifySource(repo),/SOURCE_BASELINE_CHANGED/);}finally{git('update-index','--no-assume-unchanged','lib/blog/ai/gates.mjs');}
});
test('unexpected committed change is HOLD, including changed-then-reverted history',()=>{
  reset();const p='lib/blog/ai/gates.mjs',original=readFileSync(join(repo,p));add(p,'// unexpected fixture\n');commit('Unrelated code edit');
  assert.throws(()=>verifySource(repo),/SOURCE_UNEXPECTED_CHANGE/);
  add(p,original);commit('Revert unrelated edit');assert.throws(()=>verifySource(repo),/SOURCE_UNEXPECTED_CHANGE/);
});
test('unexpected additions, index edits and wrapper changes are HOLD',()=>{
  reset();add('scripts/blog/unrelated.mjs','// offline fixture\n');assert.throws(()=>verifySource(repo),/SOURCE_UNEXPECTED_CHANGE/);
  reset();add('scripts/blog/openai-smoke.mjs','// unauthorized wrapper\n');assert.throws(()=>verifySource(repo),/SOURCE_WRAPPER_CHANGED/);
});
test('plan and approval cannot override source policy or fixed baseline',async()=>{
  reset();
  const plan={model:'gpt-6.1-terra',budgetYen:1000,limitYen:700,margin:0.2,inputTokens:100000,articleOutputTokens:12000,inputUsdPerMillion:1,outputUsdPerMillion:4,usdJpy:150,pricingSource:'https://example.invalid/mock',fxSource:'https://example.invalid/mock',ratesVerifiedAt:new Date().toISOString(),output:join(root,'output'),stateDir:join(root,'state'),maxCalls:4};
  assert.throws(()=>validatePlan({...plan,skipBaseCheck:true}),/PLAN_FIELDS/);
  assert.throws(()=>validatePlan({...plan,base:'0'.repeat(40)}),/PLAN_FIELDS/);
  const digest=codeDigest(repo),id=await issueApproval({plan,sourceDigest:digest,confirm:async s=>s});
  add('docs/blog/REAL-AI-FINAL-PREFLIGHT.md','offline safety documentation\n');commit('Allowed safety documentation');
  assert.notEqual(codeDigest(repo),digest);
  assert.throws(()=>consumeApproval({plan,id,sourceDigest:codeDigest(repo)}),/INVALID_APPROVAL/);
});
