import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, mkdtempSync, copyFileSync, existsSync, readdirSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
const root=new URL('../',import.meta.url);
const read=p=>readFileSync(new URL(p,root),'utf8');
const base=JSON.parse(read('tests/fixtures/batch1-baseline.json'));
const branches=['codex/boatstrikers-completion-batch1-20261115','codex/batch1-reconstructed-20261115'];
test('20 original Cron entries unchanged; branch deployment guard has no true wildcard',()=>{
  const v=JSON.parse(read('vercel.json')),old=JSON.parse(base['vercel.json']);
  assert.equal(v.crons.length,20);assert.deepEqual(v.crons,old.crons);
  assert.deepEqual(v.git.deploymentEnabled,Object.fromEntries(branches.map(b=>[b,false])));
  delete v.git;assert.deepEqual(v,old);
});
for(const f of ['discord-pr289-checks.yml','today-birthday-build-check.yml']) test(`normal CI unchanged: ${f}`,()=>{
  const path='.github/workflows/'+f;
  const s=read(path);assert.equal(s.replace(/^    if: github.head_ref.*\n/m,''),base[path]);
  for(const b of branches)assert.ok(s.includes(`github.head_ref != '${b}'`));
});
test('official GET disabled only for exact BATCH1 branches; schedules and collect unchanged',()=>{
  const path='.github/workflows/trinity-official-previous-day.yml';
  const s=read(path),old=base[path];
  const guard=' && '+branches.map(b=>`github.head_ref != '${b}'`).join(' && ');
  assert.equal(s.replace(guard,''),old);
  assert.match(s,/if: github.event_name != 'pull_request'/);
});
for(const path of ['app/admin/sync/_lib/adminAuth.js','app/api/cron/data-lab-social/route.js']) test(`auth/scheduler route unchanged: ${path}`,()=>assert.equal(read(path),base[path]));
test('dedicated CI: pinned runner, 10-minute cap, opened only, no install/credentials',()=>{
  const s=read('.github/workflows/batch1-offline-review.yml');
  assert.match(s,/runs-on: ubuntu-24.04/);assert.match(s,/timeout-minutes: 10/);
  assert.match(s,/types: \[opened\]/);assert.match(s,/persist-credentials: false/);
  assert.match(s,/unshare --net/);assert.doesNotMatch(s,/npm install|setup-node|secrets\.|workflow_dispatch|schedule:/);
});
test('namespace checker fails before running tests when isolation absent',()=>{
  const r=spawnSync(process.execPath,['scripts/batch1/offline-ci.mjs'],{cwd:root,env:{PATH:'/usr/bin:/bin'},encoding:'utf8'});
  assert.notEqual(r.status,0);assert.match(r.stderr,/OS network isolation required; no fallback/);assert.doesNotMatch(r.stdout,/tests \d/);
});
test('network shim blocks fetch and native sockets before connection',()=>{
  const r=spawnSync(process.execPath,['--require','./scripts/batch1/deny-network.cjs','-e',`for(const f of [()=>fetch('https://fixture.invalid'),()=>require('node:net').connect(443,'fixture.invalid'),()=>require('node:https').get('https://fixture.invalid')]) {try{f();process.exit(2)}catch(e){if(e.message!=='BATCH1_NETWORK_DENIED')throw e}}`],{cwd:root,env:{PATH:'/usr/bin:/bin'},encoding:'utf8'});
  assert.equal(r.status,0,r.stderr);
});
function build(extra={}) {
  const dir=mkdtempSync(join(tmpdir(),'batch1-static-'));copyFileSync(new URL('review/batch1/build.mjs',root),join(dir,'build.mjs'));
  const r=spawnSync(process.execPath,['build.mjs'],{cwd:dir,env:{PATH:'/usr/bin:/bin',BATCH1_REVIEW_ONLY:'1',BATCH1_SOURCE_REF:branches[1],...extra},encoding:'utf8'});
  return {dir,r};
}
test('static review has exactly three files, no scripts/API/URLs',()=>{
  const {dir,r}=build();try {
    assert.equal(r.status,0,r.stderr);assert.deepEqual(readdirSync(join(dir,'public')).sort(),['404.html','index.html','isolation.json']);
    const html=readFileSync(join(dir,'public/index.html'),'utf8');
    assert.doesNotMatch(html,/<script|<form|https?:|fetch\(|\/api\//i);assert.match(html,/<button disabled>/);assert.match(html,/connect-src 'none'/);
  } finally{rmSync(dir,{recursive:true,force:true});}
});
for(const extra of [{SUPABASE_SERVICE_ROLE_KEY:'fixture'},{NEXT_PUBLIC_SUPABASE_URL:'https://fixture.invalid'},{GEMINI_API_KEY:'fixture'},{VERCEL_ENV:'production'},{BATCH1_SOURCE_REF:'main'},{BATCH1_REVIEW_ONLY:'0'},{VERCEL_GIT_COMMIT_REF:'main'},{VERCEL_OIDC_TOKEN:'fixture'}]) test(`static review refuses ${Object.keys(extra)[0]} before output`,()=>{
  const {dir,r}=build(extra);try{assert.notEqual(r.status,0);assert.equal(existsSync(join(dir,'public')),false);assert.doesNotMatch(r.stderr,/https:\/\/fixture.invalid/);}finally{rmSync(dir,{recursive:true,force:true});}
});
test('static Vercel config has no functions/crons/rewrites and denies connections',()=>{
  const v=JSON.parse(read('review/batch1/vercel.json'));assert.equal(v.framework,null);assert.equal(v.git.deploymentEnabled,false);
  for(const k of ['crons','rewrites','functions'])assert.equal(v[k],undefined);
  assert.match(JSON.stringify(v.headers),/connect-src 'none'/);
});
test('S01 is a gated transaction proposal outside migrations',()=>{
  const s=read('ops/security/s01-bsc-results-apply.sql');
  for(const re of [/BEGIN;/,/COMMIT;/,/lock_timeout = '3s'/,/Verified backup required/,/Table security drift/,/Function drift/,/Policy drift/,/Expected exactly 3/,/Inherited privilege remains/,/MAINTAIN/,/RESTRICT/])assert.match(s,re);
  assert.doesNotMatch(s,/TRUNCATE TABLE|DELETE FROM|DROP TABLE|CREATE OR REPLACE FUNCTION|CASCADE|GRANT ALL/);
  assert.match(read('ops/security/s01-bsc-results-emergency-rollback.sql'),/READ-ONLY GENERATOR/);
});
