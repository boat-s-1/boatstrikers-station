import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { validatePlan, estimateTotal, estimate, reserveBudget, assertSafe } from '../../scripts/blog/verification-budget.mjs';
import { codeDigest, issueApproval, consumeApproval } from '../../scripts/blog/verification-approval.mjs';
import { execute, privateRequests, REPO } from '../../scripts/blog/verification-worker.mjs';
import { createGuardedTransport } from '../../scripts/blog/verification-transport.mjs';
import { verifySource } from '../../scripts/blog/verification-source.mjs';

// Mock-only plans, credentials, approval records and ledgers, removed after this suite.
const KEY = 'SMOKE_ONLY_MOCK_CREDENTIAL_123456789';
const roots = [];
after(() => { for (const root of roots) rmSync(root, { recursive: true, force: true }); });
const yes = async s => s;
function plan() {
  const root = mkdtempSync(join(tmpdir(), 'boat-smoke-only-test-')); roots.push(root);
  return { mode:'smoke-only',model:'gpt-6.1-terra',serviceTier:'default',store:false,budgetYen:1000,limitYen:700,margin:0.2,inputTokens:100000,outputTokens:1000,inputUsdPerMillion:1,outputUsdPerMillion:5,usdJpy:170,pricingSource:'https://example.invalid/MOCK-PRICE',fxSource:'https://example.invalid/MOCK-FX',ratesVerifiedAt:new Date().toISOString(),output:join(root,'output'),stateDir:join(root,'state'),maxCalls:1 };
}
function four(p) {
  const {mode,serviceTier,store,outputTokens,...common}=p;
  return {...common,maxCalls:4,articleOutputTokens:12000};
}
function recordFile(p,id) { return join(p.stateDir,'approvals',`${id}.json`); }
function used(p,id) { return existsSync(join(p.stateDir,'approvals',`${id}.used`)); }
function ledger(p) { return JSON.parse(readFileSync(join(p.stateDir,'budget.json'),'utf8')); }
async function approve(p,confirm=yes) { return issueApproval({plan:p,sourceDigest:codeDigest(REPO),confirm}); }
function response(p,patch={}) {
  return new Response(JSON.stringify({status:'completed',model:p.model,service_tier:'default',usage:{input_tokens:100,output_tokens:20,total_tokens:120},output:[{content:[{type:'output_text',text:'{"ok":true}'}]}],...patch}),{status:200});
}
function request(p,store=false) {
  return ['https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${KEY}`},body:JSON.stringify({model:p.model,store,max_output_tokens:1000,text:{format:{name:'smoke'}}})}];
}
function options(p,id,fetchImpl,confirm=yes) { return {plan:p,approvalId:id,env:{OPENAI_API_KEY:KEY},runtimeCheck:()=>{},fetchImpl,confirm}; }

test('smoke-only: exactly one request, then PASS with no articles and only 21.42 JPY reserved',async()=>{
  const p=plan(),id=await approve(p);let n=0,confirmations=0;
  const result=await execute(options(p,id,async(_url,init)=>{
    n++;const b=JSON.parse(init.body);assert.equal(b.model,p.model);assert.equal(b.service_tier,'default');assert.equal(b.store,false);assert.equal(b.max_output_tokens,1000);assert.equal(b.text.format.name,'smoke');assert.equal(b.input,'ping');return response(p);
  },async s=>{confirmations++;assert.match(s,/MODE=smoke-only/);return s;}));
  assert.deepEqual(result,{status:'PASS',calls:1});assert.equal(n,1);assert.equal(confirmations,1);
  const report=JSON.parse(readFileSync(join(p.output,'report.json'),'utf8'));
  assert.equal(report.mode,'smoke-only');assert.equal(report.head,verifySource(REPO).head);assert.equal(report.reservedYen,21.42);assert.notEqual(report.reservedYen,119.34);assert.deepEqual(report.results,[]);assert.equal(report.usage[0].stage,'smoke');assert.equal(report.usage[0].serviceTier,'default');
  assert.equal(ledger(p).reservations.length,1);assert.equal(ledger(p).reservations[0].amountYen,21.42);assert.equal(ledger(p).reservations[0].mode,'smoke-only');assert.equal(used(p,id),true);assertSafe(report,[KEY]);
});
test('smoke-only: second direct transport call is rejected before dispatch',async()=>{
  const p=plan();let n=0;const t=createGuardedTransport({plan:p,apiKey:KEY,runId:'MOCK',confirm:yes,fetchImpl:async()=>{n++;return response(p);}});
  await t.fetch(...request(p));await assert.rejects(t.fetch(...request(p)),/CALL_LIMIT/);assert.equal(n,1);
});
test('smoke-only: fixed parameters and mode cannot be broadened by the plan',()=>{
  const p=plan();validatePlan(p);assert.equal(estimateTotal(p),21.42);assert.throws(()=>estimate(p,'ichika'),/STAGE/);
  for(const patch of [{maxCalls:2},{inputTokens:100001},{outputTokens:1001},{store:true},{serviceTier:'auto'},{usdJpy:169},{margin:0.1},{inputUsdPerMillion:0.05},{outputUsdPerMillion:4},{mode:'unknown'},{articleOutputTokens:12000}])assert.throws(()=>validatePlan({...p,...patch}),/HOLD/);
});
test('smoke-only: approval binds mode, HEAD, source, model, budget and output',async()=>{
  const p=plan();let phrase;const id=await approve(p,async s=>{phrase=s;return s;});
  const record=JSON.parse(readFileSync(recordFile(p,id),'utf8'));
  assert.equal(record.version,2);assert.equal(record.mode,'smoke-only');assert.equal(record.sourceDigest,codeDigest(REPO));assert.deepEqual(record.stages,['smoke']);
  for(const part of ['MODE=smoke-only',`HEAD=${record.head}`,`SOURCE=${record.sourceDigest}`,`MODEL=${p.model}`,'LIMIT=700JPY','RESERVE=21.42JPY','CALLS=1',`OUT=${p.output}`])assert.ok(phrase.includes(part));
});
test('smoke-only: missing approval stops before any transport',async()=>{
  const p=plan();let n=0;await assert.rejects(execute(options(p,undefined,async()=>{n++;})),/APPROVAL_REQUIRED/);assert.equal(n,0);assert.equal(existsSync(p.output),false);assert.equal(existsSync(p.stateDir),false);
});
test('smoke-only: invalid confirmation cannot issue even a mock approval',async()=>{
  const p=plan();await assert.rejects(approve(p,async()=> 'yes'),/APPROVAL_REQUIRED/);assert.equal(existsSync(p.stateDir),false);
});
test('smoke-only: approval reuse is rejected even after the mock output directory is removed',async()=>{
  const p=plan(),id=await approve(p);let n=0;
  await execute(options(p,id,async()=>{n++;return response(p);}));rmSync(p.output,{recursive:true});
  await assert.rejects(execute(options(p,id,async()=>{n++;return response(p);})),/APPROVAL_USED/);assert.equal(n,1);
});
for(const direction of ['smoke-to-four','four-to-smoke'])test(`smoke-only: approval cannot cross modes (${direction})`,async()=>{
  const p=plan(),other=four(p),from=direction==='smoke-to-four'?p:other,to=direction==='smoke-to-four'?other:p,id=await approve(from);let n=0;
  await assert.rejects(execute(options(to,id,async()=>{n++;})),/INVALID_APPROVAL/);assert.equal(n,0);assert.equal(used(p,id),false);
});
for(const field of ['head','sourceDigest','mode'])test(`smoke-only: tampered approval ${field} is rejected`,async()=>{
  const p=plan(),id=await approve(p),path=recordFile(p,id),record=JSON.parse(readFileSync(path,'utf8'));record[field]=field==='mode'?'four-stage':'0'.repeat(field==='head'?40:64);writeFileSync(path,JSON.stringify(record));let n=0;
  await assert.rejects(execute(options(p,id,async()=>{n++;})),/INVALID_APPROVAL/);assert.equal(n,0);
});
test('smoke-only: changed save path cannot reuse approval',async()=>{
  const p=plan(),id=await approve(p);await assert.rejects(execute(options({...p,output:p.output+'-other'},id,async()=>{throw new Error('must not dispatch');})),/INVALID_APPROVAL/);
});
test('smoke-only: shared old/four-stage reservations count toward the 700 JPY limit',async()=>{
  const p=plan(),full=four(p);
  for(let i=0;i<5;i++)reserveBudget(full,randomUUID());for(let i=0;i<4;i++)reserveBudget(p,randomUUID());
  const before=ledger(p);assert.ok(Math.abs(before.reservations.reduce((s,r)=>s+r.amountYen,0)-682.38)<1e-9);
  const id=await approve(p);let n=0;await assert.rejects(execute(options(p,id,async()=>{n++;})),/BUDGET_EXCEEDED/);assert.equal(n,0);assert.equal(used(p,id),true);assert.equal(ledger(p).reservations.length,9);assert.equal(existsSync(p.output),false);
});
for(const store of [undefined,true,null,'false',0])test(`smoke-only: guard rejects store ${JSON.stringify(store)} before dispatch`,async()=>{
  const p=plan();let n=0;const t=createGuardedTransport({plan:p,apiKey:KEY,runId:'MOCK',confirm:yes,fetchImpl:async()=>{n++;return response(p);}});
  // request's default is false; delete explicitly to test an omitted property.
  const args=request(p,store);if(store===undefined){const b=JSON.parse(args[1].body);delete b.store;args[1].body=JSON.stringify(b);}
  await assert.rejects(t.fetch(...args),/TRANSPORT_STOPPED/);assert.equal(n,0);assert.equal(t.calls,0);
});
test('smoke-only: legacy-builder adapter never corrects explicit unsafe store',async()=>{
  const p=plan();let n=0;const adapted=privateRequests(async()=>{n++;});assert.throws(()=>adapted(...request(p,true)),/STORE_FALSE_REQUIRED/);assert.equal(n,0);
});
for(const kind of ['http','network','abort','usage','inconsistent-usage','tier','missing-tier','incomplete','invalid-json','not-ok','secret'])test(`smoke-only: ${kind} failure stops, keeps reservation, and consumes approval`,async()=>{
  const p=plan(),id=await approve(p);let n=0;
  const fetchImpl=async()=>{
    n++;
    if(kind==='http')return new Response('{}',{status:429});
    if(kind==='network')throw new Error('mock network error');
    if(kind==='abort')throw new DOMException('mock timeout','AbortError');
    if(kind==='invalid-json')return new Response('not JSON',{status:200});
    const patch=kind==='usage'?{usage:null}:kind==='inconsistent-usage'?{usage:{input_tokens:1,output_tokens:1,total_tokens:3}}:kind==='tier'?{service_tier:'priority'}:kind==='missing-tier'?{service_tier:undefined}:kind==='incomplete'?{status:'incomplete'}:kind==='not-ok'?{output:[{content:[{type:'output_text',text:'{"ok":false}'}]}]}:kind==='secret'?{output:[{content:[{type:'output_text',text:KEY}]}]}:{};
    return response(p,patch);
  };
  const result=await execute(options(p,id,fetchImpl));assert.deepEqual(result,{status:'HOLD',calls:1});assert.equal(n,1);assert.equal(used(p,id),true);assert.equal(ledger(p).reservations[0].amountYen,21.42);assertSafe(readFileSync(join(p.output,'report.json'),'utf8'),[KEY]);
  rmSync(p.output,{recursive:true});await assert.rejects(execute(options(p,id,fetchImpl)),/APPROVAL_USED/);assert.equal(n,1);
});
test('smoke-only: actual mock timeout freezes transport with no retry',async()=>{
  const p=plan();let n=0;const t=createGuardedTransport({plan:p,apiKey:KEY,runId:'MOCK',confirm:yes,timeoutMs:10,fetchImpl:async()=>{n++;return new Promise(()=>{});}}),timer=setInterval(()=>{},100);
  try{await assert.rejects(t.fetch(...request(p)),/TRANSPORT_STOPPED/);await assert.rejects(t.fetch(...request(p)),/RUN_STOPPED/);assert.equal(n,1);}finally{clearInterval(timer);}
});
test('smoke-only: cancellation consumes approval but makes no request and no refund',async()=>{
  const p=plan(),id=await approve(p);let n=0;const result=await execute(options(p,id,async()=>{n++;},async()=> 'cancel'));assert.deepEqual(result,{status:'HOLD',calls:0});assert.equal(n,0);assert.equal(used(p,id),true);assert.equal(ledger(p).reservations[0].amountYen,21.42);
});
test('four-stage compatibility: all four requests explicitly store false and keep all seven gates',async()=>{
  const p=four(plan()),id=await approve(p);let n=0;
  const names=['ichika-kiryu-inside-escape','hatsune-women-inside-escape','kiina-kiryu-boat5'];
  const result=await execute(options(p,id,async(_url,init)=>{
    const i=n++,b=JSON.parse(init.body);assert.equal(b.store,false);assert.equal(b.service_tier,'default');
    if(i===0)return response(p);
    return response(p,{output:[{content:[{type:'output_text',text:readFileSync(join(REPO,`tests/blog/fixtures/mock-ai/${names[i-1]}.json`),'utf8')}]}]});
  }));
  assert.deepEqual(result,{status:'PASS',calls:4});assert.equal(n,4);assert.equal(ledger(p).reservations[0].amountYen,119.34);
  const r=JSON.parse(readFileSync(join(p.output,'report.json'),'utf8'));assert.equal(r.mode,'four-stage');assert.equal(r.results.length,3);for(const line of r.results)assert.ok(Object.values(line.gates).every(g=>g==='PASS'));
});
