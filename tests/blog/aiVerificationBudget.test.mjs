import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, existsSync, rmSync, writeFileSync, mkdirSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawnSync, spawn } from 'node:child_process';
import http from 'node:http';
import { MODEL, BASE, STAGES, validatePlan, estimateTotal, reserveBudget, externalPath, assertSafe } from '../../scripts/blog/verification-budget.mjs';
import { issueApproval, consumeApproval, codeDigest } from '../../scripts/blog/verification-approval.mjs';
import { createGuardedTransport } from '../../scripts/blog/verification-transport.mjs';
import { execute, REPO, checkRuntime } from '../../scripts/blog/verification-worker.mjs';
import { childEnvironment } from '../../scripts/blog/verification-cli.mjs';

const roots = [];
after(() => { for (const dir of roots) rmSync(dir, { recursive: true, force: true }); });
const KEY = 'MOCK_CREDENTIAL_NEVER_REAL_123456789';
const sourceDigest = codeDigest(REPO);
function plan(extra = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'boat-safety-')); roots.push(dir);
  return { model: MODEL, budgetYen: 1000, limitYen: 700, margin: 0.2, inputTokens: 100000, articleOutputTokens: 12000,
    inputUsdPerMillion: 1, outputUsdPerMillion: 4, usdJpy: 150,
    pricingSource: 'https://example.invalid/MOCK-PRICES', fxSource: 'https://example.invalid/MOCK-FX', ratesVerifiedAt: new Date().toISOString(),
    output: join(dir, 'output'), stateDir: join(dir, 'state'), maxCalls: 4, ...extra };
}
const yes = async phrase => phrase;
async function approve(p, extra = {}) { return issueApproval({ plan: p, sourceDigest, confirm: yes, ...extra }); }
function response(index, patch = {}) {
  const names = ['ichika-kiryu-inside-escape','hatsune-women-inside-escape','kiina-kiryu-boat5'];
  const text = index === 0 ? '{"ok":true}' : readFileSync(join(REPO, `tests/blog/fixtures/mock-ai/${names[index - 1]}.json`), 'utf8');
  return new Response(JSON.stringify({ status: 'completed', model: MODEL, usage: { input_tokens: 3000, output_tokens: index === 0 ? 20 : 1500, total_tokens: index === 0 ? 3020 : 4500 }, output: [{ content: [{ type: 'output_text', text }] }], ...patch }), { status: 200 });
}
async function run(p, { failAt, patch = {}, cancelAt, secret = false, id } = {}) {
  let calls = 0, confirmations = 0;
  const approvalId = id ?? await approve(p);
  const result = await execute({ plan: p, approvalId, env: { OPENAI_API_KEY: KEY }, runtimeCheck: () => {}, confirm: async s => ++confirmations === cancelAt ? 'cancel' : s,
    fetchImpl: async () => { const n = calls++; if (n === failAt) return new Response('{}', { status: 429 }); return response(n, secret ? { model: KEY } : patch); } });
  return { result, calls, confirmations, approvalId, report: JSON.parse(readFileSync(join(p.output, 'report.json'), 'utf8')) };
}

test('base commit and model are pinned; invalid plan fields and limits fail closed', () => {
  assert.equal(BASE, '94677eedebfffb7cfef3f857e3d2a87a0f42a61d');
  const p = plan(); assert.equal(validatePlan(p), p);
  for (const patch of [{model:'other'}, {maxCalls:5}, {limitYen:701}, {budgetYen:1001}, {unexpected:1}, {margin:0}, {inputTokens:0}, {articleOutputTokens:12001}]) assert.throws(() => validatePlan({...p,...patch}), /HOLD/);
});
test('prices, exchange rate, source and freshness are mandatory; no guessed prices', () => {
  const p = plan();
  for (const patch of [{inputUsdPerMillion:null},{outputUsdPerMillion:0},{usdJpy:NaN},{ratesVerifiedAt:'2020-01-01'},{ratesVerifiedAt:'invalid'},{fxSource:'http://example.invalid'},{pricingSource:'https://api.openai.com/pricing'}]) assert.throws(() => validatePlan({...p,...patch}), /HOLD/);
});
test('repository and symlink destinations are rejected', () => {
  const p = plan(); assert.throws(() => externalPath(join(REPO,'result')), /PATH_INSIDE_GIT/);
  symlinkSync(REPO,join(p.stateDir+'/..','link')); assert.throws(() => externalPath(join(p.stateDir+'/..','link','result')), /HOLD/);
});
test('reservation sums all four calls including margin before any communication', () => {
  const p = plan(); assert.equal(estimateTotal(p), 98.64);
  assert.throws(() => reserveBudget({...p,inputUsdPerMillion:1000},randomUUID()), /BUDGET_EXCEEDED/);
  assert.equal(existsSync(p.stateDir),false);
});
test('persistent ledger prevents cumulative overspending and reservation replay; no automatic refunds', () => {
  const p = plan(), id = randomUUID(); reserveBudget(p,id);
  assert.throws(() => reserveBudget(p,id), /BUDGET_REPLAY/);
  for(let i=0;i<6;i++) reserveBudget(p,randomUUID());
  assert.throws(() => reserveBudget(p,randomUUID()), /BUDGET_EXCEEDED/);
  assert.equal(JSON.parse(readFileSync(join(p.stateDir,'budget.json'))).reservations.length,7);
});
test('corrupt ledger and competing budget lock stop', () => {
  const p = plan(); mkdirSync(p.stateDir); writeFileSync(join(p.stateDir,'budget.json'),'{}');
  assert.throws(() => reserveBudget(p,randomUUID()), /HOLD/);
  mkdirSync(join(p.stateDir,'budget.lock')); assert.throws(() => reserveBudget(p,randomUUID()), /BUDGET_LOCKED/);
});
test('approval requires exact explicit plan confirmation', async () => {
  const p = plan(); await assert.rejects(approve(p,{confirm:async()=> 'y'}),/APPROVAL_REQUIRED/);
  assert.equal(existsSync(p.stateDir),false);
});
test('invalid, altered, expired, mismatched-code and reused approvals are refused', async () => {
  const p = plan(), id = await approve(p);
  assert.throws(() => consumeApproval({plan:p,id:randomUUID(),sourceDigest}), /INVALID_APPROVAL/);
  assert.throws(() => consumeApproval({plan:{...p,articleOutputTokens:11000},id,sourceDigest}), /INVALID_APPROVAL/);
  assert.throws(() => consumeApproval({plan:p,id,sourceDigest:'0'.repeat(64)}), /INVALID_APPROVAL/);
  assert.throws(() => consumeApproval({plan:p,id,sourceDigest,now:Date.now()+3600001}), /INVALID_APPROVAL/);
  consumeApproval({plan:p,id,sourceDigest});
  assert.throws(() => consumeApproval({plan:p,id,sourceDigest}), /APPROVAL_USED/);
});
test('missing approval stops the entire runner before any API transport', async () => {
  const p = plan(); let calls=0;
  await assert.rejects(execute({plan:p,env:{OPENAI_API_KEY:KEY},runtimeCheck:()=>{},fetchImpl:()=>{calls++;}}),/APPROVAL_REQUIRED/);
  assert.equal(calls,0);assert.equal(existsSync(p.output),false);
});
test('exhausted persistent budget stops runner before API and burns approval', async () => {
  const p = plan();for(let i=0;i<7;i++)reserveBudget(p,randomUUID());
  const id=await approve(p);let calls=0;
  await assert.rejects(execute({plan:p,approvalId:id,env:{OPENAI_API_KEY:KEY},runtimeCheck:()=>{},fetchImpl:()=>{calls++;}}),/BUDGET_EXCEEDED/);
  assert.equal(calls,0);assert.throws(()=>consumeApproval({plan:p,id,sourceDigest}),/APPROVAL_USED/);
});
test('three characters pass unchanged seven quality gates; tampering HOLD, missing period not PASS', async () => {
  const p=plan(),r=await run(p);assert.equal(r.result.status,'PASS');assert.equal(r.calls,4);assert.equal(r.confirmations,4);
  assert.deepEqual(r.report.results.map(l=>l.character),['ichika','hatsune','kiina']);
  for(const l of r.report.results){assert.equal(Object.keys(l.gates).length,7);assert.ok(Object.values(l.gates).every(g=>g==='PASS'));assert.equal(l.tampered.verdict,'HOLD');assert.notEqual(l.period_removed.verdict,'PASS');}
  assertSafe(readFileSync(join(p.output,'report.json'),'utf8'),[KEY]);
});
for(const cancelAt of [1,2,3,4])test(`cancel at stage ${cancelAt} stops without another API call or reusable approval`,async()=>{
  const p=plan(),r=await run(p,{cancelAt});assert.equal(r.result.status,'HOLD');assert.equal(r.calls,cancelAt-1);
  assert.throws(()=>consumeApproval({plan:p,id:r.approvalId,sourceDigest}),/APPROVAL_USED/);
});
for(const failAt of [0,1,2,3])test(`API failure at stage ${failAt+1} stops immediately without retry`,async()=>{
  const p=plan(),r=await run(p,{failAt});assert.equal(r.result.status,'HOLD');assert.equal(r.calls,failAt+1);
});
for(const patch of [{usage:null},{usage:{input_tokens:1,output_tokens:1,total_tokens:3}},{status:'incomplete'},{model:'wrong-model'},{usage:{input_tokens:100001,output_tokens:1,total_tokens:100002}}])test(`unsafe response stops: ${JSON.stringify(patch)}`,async()=>{
  const r=await run(plan(),{patch});assert.equal(r.result.status,'HOLD');assert.equal(r.calls,1);
});
test('secret-bearing upstream content is rejected and never saved',async()=>{
  const p=plan(),r=await run(p,{secret:true});assert.equal(r.result.status,'HOLD');assert.equal(r.calls,1);assertSafe(readFileSync(join(p.output,'report.json'),'utf8'),[KEY]);
});
test('secret scanner rejects literal, encoded and credential-labelled content',()=>{
  for(const value of [KEY,Buffer.from(KEY).toString('base64'),encodeURIComponent(KEY),'Bearer mock-value','sk-test-12345678901234567890','{"apiKey":"value"}'])assert.throws(()=>assertSafe(value,[KEY]),/SECRET_CONTENT/);
});
function request(p,index){return ['https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${KEY}`},body:JSON.stringify({model:MODEL,max_output_tokens:index===0?1000:p.articleOutputTokens,text:{format:{name:index===0?'smoke':'boatstrikers_blog_article'}}})}];}
test('fifth transport call is refused, including when the caller asks again',async()=>{
  const p=plan();let n=0;const t=createGuardedTransport({plan:p,apiKey:KEY,runId:randomUUID(),confirm:yes,fetchImpl:async()=>response(n++)});
  for(let i=0;i<4;i++)await t.fetch(...request(p,i));
  await assert.rejects(t.fetch(...request(p,4)),/CALL_LIMIT/);await assert.rejects(t.fetch(...request(p,4)),/RUN_STOPPED/);assert.equal(n,4);
});
test('request input above approved token reservation stops before API',async()=>{
  const p=plan({inputTokens:4096});let n=0;const t=createGuardedTransport({plan:p,apiKey:KEY,runId:randomUUID(),confirm:yes,fetchImpl:async()=>{n++;}});
  await assert.rejects(t.fetch(...request(p,0)),/TRANSPORT_STOPPED/);assert.equal(n,0);
});
test('approval expiring while waiting for stage confirmation stops before API',async()=>{
  const p=plan();let n=0,time=0;const t=createGuardedTransport({plan:p,apiKey:KEY,runId:randomUUID(),approvalExpiresAt:100,now:()=>time,confirm:async s=>{time=101;return s;},fetchImpl:async()=>{n++;}});
  await assert.rejects(t.fetch(...request(p,0)),/TRANSPORT_STOPPED/);assert.equal(n,0);
});
test('quality rejection stops later characters instead of spending more calls',async()=>{
  const p=plan();let n=0;const id=await approve(p);
  const result=await execute({plan:p,approvalId:id,env:{OPENAI_API_KEY:KEY},runtimeCheck:()=>{},confirm:yes,fetchImpl:async()=>{
    const index=n++;if(index!==1)return response(index);
    const raw=await response(index).json();raw.output[0].content[0].text=raw.output[0].content[0].text.replaceAll('44%','45%');return new Response(JSON.stringify(raw));
  }});
  assert.equal(result.status,'HOLD');assert.equal(n,2);
});
test('timeout permanently stops transport without retry',async()=>{
  const p=plan();let n=0;const t=createGuardedTransport({plan:p,apiKey:KEY,runId:randomUUID(),confirm:yes,timeoutMs:10,fetchImpl:async()=>{n++;return new Promise(()=>{});}});
  // Keep the event loop alive while AbortSignal.timeout's unref timer fires.
  const timer=setInterval(()=>{},100);
  try{await assert.rejects(t.fetch(...request(p,0)),/TRANSPORT_STOPPED/);await assert.rejects(t.fetch(...request(p,0)),/RUN_STOPPED/);assert.equal(n,1);}finally{clearInterval(timer);}
});
test('runtime requires Node24, inherited HTTPS proxy and enabled env proxy with TLS verification',()=>{
  checkRuntime({HTTPS_PROXY:'http://127.0.0.1:8080'},['--use-env-proxy'],'24.22.1');
  for(const [env,flags,version]of [[{},[],'24.22.1'],[{HTTPS_PROXY:'mock'},[],'24.22.1'],[{HTTPS_PROXY:'mock'},['--use-env-proxy'],'22.0.0'],[{HTTPS_PROXY:'mock',NODE_TLS_REJECT_UNAUTHORIZED:'0'},['--use-env-proxy'],'24.22.1']])assert.throws(()=>checkRuntime(env,flags,version),/HOLD/);
});
test('child-only mapping uses dummy HTTP secret; unrelated credentials and NODE_OPTIONS excluded',()=>{
  const input={BOATSTRIKERS_OPENAI_HTTP_KEY:KEY,OPENAI_API_KEY:'WRONG_MOCK',GH_TOKEN:'MOCK_GH',NODE_OPTIONS:'--inspect',HTTPS_PROXY:'http://127.0.0.1:8080'};
  const result=childEnvironment(input);assert.equal(result.OPENAI_API_KEY,KEY);assert.equal(input.OPENAI_API_KEY,'WRONG_MOCK');
  for(const name of ['BOATSTRIKERS_OPENAI_HTTP_KEY','GH_TOKEN','NODE_OPTIONS'])assert.equal(result[name],undefined);
});
test('legacy real-AI CLIs and default new CLI all remain HOLD without transport',()=>{
  for(const args of [['scripts/blog/verification-cli.mjs'],['scripts/blog/openai-smoke.mjs'],['scripts/blog/run-local-ai-verification.mjs'],['scripts/blog/verify-real-articles.mjs','tests/blog/fixtures/real-data/cases.json','--ai']]){
    const r=spawnSync(process.execPath,args,{cwd:REPO,env:{PATH:process.env.PATH,NODE_OPTIONS:`--require=${join(REPO,'scripts/blog/verification-offline.cjs')}`},encoding:'utf8'});assert.equal(r.status,1);assert.match(r.stderr,/HOLD/);
  }
});
test('Node24 env proxy routes dummy HTTP request only through loopback mock CONNECT proxy',async()=>{
  let calls=0;const sockets=new Set();const server=http.createServer();server.on('connection',s=>{sockets.add(s);s.on('close',()=>sockets.delete(s));});
  server.on('connect',(_req,socket)=>{calls++;socket.write('HTTP/1.1 200 Connection Established\r\n\r\n');socket.once('data',()=>socket.end('HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\nOK'));});
  await new Promise(res=>server.listen(0,'127.0.0.1',res));
  try{
    const proxy=`http://127.0.0.1:${server.address().port}`;
    const c=spawn(process.execPath,['--use-env-proxy','--require',join(REPO,'scripts/blog/verification-offline.cjs'),'-e',`fetch('http://verification.invalid/mock',{signal:AbortSignal.timeout(3000)}).then(async r=>{if(await r.text()!=='OK')process.exitCode=1;}).catch(()=>{process.exitCode=1;});`],{env:{HTTP_PROXY:proxy,HTTPS_PROXY:proxy,NO_PROXY:''},stdio:'ignore'});
    const timer=setTimeout(()=>c.kill(),5000);const code=await new Promise(res=>c.on('exit',res));clearTimeout(timer);assert.equal(code,0);assert.equal(calls,1);
  }finally{for(const s of sockets)s.destroy();await new Promise(res=>server.close(res));}
});
