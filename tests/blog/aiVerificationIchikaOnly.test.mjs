import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { codeDigest, issueApproval, consumeApproval } from '../../scripts/blog/verification-approval.mjs';
import { validatePlan, reserveBudget, estimateTotal, assertSafe } from '../../scripts/blog/verification-budget.mjs';
import { execute, privateRequests, REPO } from '../../scripts/blog/verification-worker.mjs';
import { createGuardedTransport } from '../../scripts/blog/verification-transport.mjs';
import { ichikaInput, prepareIchika } from '../../scripts/blog/verification-ichika.mjs';
import { sealSnapshot, sha256, loadSnapshot, capturePublishedSnapshot, SNAPSHOT_MAX_AGE_MS, writeSnapshot } from '../../scripts/blog/verification-snapshot.mjs';
import { composeDocument } from '../../lib/blog/ai/compose.mjs';
import { articleText } from '../../lib/blog/ai/duplicates.mjs';

const KEY='ICHIKA_ONLY_MOCK_NEVER_REAL_CREDENTIAL_123456789';
const roots=[];after(()=>{for(const root of roots)rmSync(root,{recursive:true,force:true});});
const yes=async s=>s;
const source={kind:'blog-anon-readonly-select',url:'https://blog-snapshot-mock.supabase.co',scope:'all-publicly-readable-published-sealed',queryVersion:1};
const fixture=()=>JSON.parse(readFileSync(join(REPO,'tests/blog/fixtures/mock-ai/ichika-kiryu-inside-escape.json'),'utf8'));
function snapshot(articles=[{id:'MOCK-PUBLISHED',revisionId:'MOCK-SEALED',slug:'mock-existing',state:'published',publishedAt:'2026-10-01T00:00:00Z',title:'別の既存記事：サイト利用方法',text:'検証専用の既存公開記事本文です。端末の表示や画面操作について説明しています。'}],retrievedAt=new Date().toISOString()){
  return sealSnapshot({source,retrievedAt,articles});
}
function rewriteSnapshot(p,s){writeFileSync(p.snapshotPath,JSON.stringify(s));p.snapshotHash=sha256(readFileSync(p.snapshotPath));}
function plan(){
  const root=mkdtempSync(join(tmpdir(),'boat-ichika-only-test-'));roots.push(root);
  const p={mode:'ichika-only',model:'gpt-6.1-terra',serviceTier:'default',store:false,budgetYen:1000,limitYen:700,margin:0.2,inputTokens:100000,outputTokens:12000,inputUsdPerMillion:1,outputUsdPerMillion:5,usdJpy:170,pricingSource:'https://example.invalid/MOCK-RATES',fxSource:'https://example.invalid/MOCK-FX',ratesVerifiedAt:new Date().toISOString(),output:join(root,'result'),stateDir:join(root,'state'),maxCalls:1,caseKey:'ichika-kiryu-inside',inputDataHash:ichikaInput(REPO).inputDataHash,snapshotPath:join(root,'published.json'),snapshotHash:''};
  rewriteSnapshot(p,snapshot());return p;
}
async function approve(p,confirm=yes){return issueApproval({plan:p,sourceDigest:codeDigest(REPO),confirm});}
function response(p,ai=fixture(),patch={}){return new Response(JSON.stringify({status:'completed',model:p.model,service_tier:'default',usage:{input_tokens:4000,output_tokens:2000,total_tokens:6000},output:[{content:[{type:'output_text',text:JSON.stringify(ai)}]}],...patch}),{status:200});}
const opts=(p,id,fetchImpl,confirm=yes)=>({plan:p,approvalId:id,env:{OPENAI_API_KEY:KEY},runtimeCheck:()=>{},fetchImpl,confirm});
const ledger=p=>JSON.parse(readFileSync(join(p.stateDir,'budget.json'),'utf8'));
const used=(p,id)=>existsSync(join(p.stateDir,'approvals',id+'.used'));
function request(p,store=false){return ['https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${KEY}`},body:JSON.stringify({model:p.model,store,max_output_tokens:12000,text:{format:{name:'boatstrikers_blog_article'}}})}];}
function smoke(p){const {caseKey,inputDataHash,snapshotPath,snapshotHash,...base}=p;return {...base,mode:'smoke-only',outputTokens:1000};}

test('ichika-only: one article, no smoke or other characters, default/store false, seven gates and no publication',async()=>{
  const p=plan(),smokePlan=smoke(p),oldId=randomUUID();reserveBudget(smokePlan,oldId);
  const before=readFileSync(join(p.stateDir,'budget.json'),'utf8');let n=0,prompts=0;
  const id=await approve(p);const result=await execute(opts(p,id,async(_url,init)=>{
    n++;const b=JSON.parse(init.body);assert.equal(b.store,false);assert.equal(b.service_tier,'default');assert.equal(b.model,p.model);assert.equal(b.max_output_tokens,12000);assert.equal(b.text.format.name,'boatstrikers_blog_article');assert.notEqual(b.input,'ping');assert.match(b.instructions,/主に案内するのは一果/);assert.match(b.instructions,/号艇/);assert.match(b.input,/2026\/10\/04〜2026\/10\/26/);return response(p);
  },async s=>{prompts++;assert.match(s,/MODE=ichika-only ichika/);return s;}));
  assert.deepEqual(result,{status:'PASS',calls:1});assert.equal(n,1);assert.equal(prompts,1);assert.equal(used(p,id),true);
  const l=ledger(p),previous=JSON.parse(before).reservations[0];assert.deepEqual(l.reservations[0],previous);assert.equal(previous.amountYen,21.42);assert.equal(l.reservations[1].amountYen,32.64);assert.equal(Math.round(l.reservations.reduce((s,r)=>s+r.amountYen,0)*100)/100,54.06);
  const report=JSON.parse(readFileSync(join(p.output,'report.json'),'utf8'));assert.equal(report.mode,'ichika-only');assert.equal(report.publishAllowed,false);assert.equal(report.results.length,1);assert.equal(report.results[0].character,'ichika');assert.equal(report.results[0].verdict,'PASS');assert.equal(Object.keys(report.results[0].gates).length,7);assert.ok(Object.values(report.results[0].gates).every(g=>g.verdict==='PASS'));assert.equal(report.reservedYen,32.64);assert.equal(report.artifacts.snapshot.count,1);assertSafe(report,[KEY]);
});
test('ichika-only: second guarded request is refused and no retry occurs',async()=>{
  const p=plan();let n=0;const t=createGuardedTransport({plan:p,apiKey:KEY,runId:'MOCK',confirm:yes,fetchImpl:async()=>{n++;return response(p);}});
  await t.fetch(...request(p));await assert.rejects(t.fetch(...request(p)),/CALL_LIMIT/);assert.equal(n,1);
});
test('ichika-only: only fixed input, rates and one-call mode are accepted',()=>{
  const p=plan();validatePlan(p);assert.equal(estimateTotal(p),32.64);const d=ichikaInput(REPO);assert.equal(d.evidence.population,168);assert.equal(d.evidence.usable,166);assert.equal(d.evidence.metrics.escapes,73);assert.equal(d.evidence.metrics.escape_rate,44);assert.equal(d.evidence.excluded.course_missing,2);
  for(const patch of [{caseKey:'hatsune-women'},{maxCalls:2},{outputTokens:12001},{store:true},{inputTokens:99999},{usdJpy:169},{margin:0.1}])assert.throws(()=>validatePlan({...p,...patch}),/HOLD/);
});
test('ichika-only: approval binds mode, HEAD, input and snapshot metadata; reuse denied',async()=>{
  const p=plan();let phrase;const id=await approve(p,async s=>{phrase=s;return s;});
  const record=JSON.parse(readFileSync(join(p.stateDir,'approvals',id+'.json'),'utf8'));assert.equal(record.version,3);assert.equal(record.mode,'ichika-only');assert.deepEqual(record.stages,['ichika']);assert.equal(record.artifacts.inputDataHash,p.inputDataHash);assert.equal(record.artifacts.snapshot.hash,p.snapshotHash);assert.ok(phrase.includes('CASE=ichika-kiryu-inside'));assert.ok(phrase.includes('SNAPSHOT='+p.snapshotHash));
  await execute(opts(p,id,async()=>response(p)));rmSync(p.output,{recursive:true});await assert.rejects(execute(opts(p,id,async()=>{throw new Error('must not dispatch');})),/APPROVAL_USED/);
});
for(const mode of ['smoke-only','four-stage'])test(`ichika-only: approval cannot be reused for ${mode}`,async()=>{
  const p=plan(),id=await approve(p);let other=smoke(p);if(mode==='four-stage'){const {mode:m,serviceTier,store,outputTokens,...base}=other;other={...base,articleOutputTokens:12000,maxCalls:4};}
  await assert.rejects(execute(opts(other,id,async()=>{throw new Error('must not dispatch');})),/INVALID_APPROVAL/);assert.equal(used(p,id),false);
});
test('ichika-only: missing approval stops before reservation or transport',async()=>{
  const p=plan();let n=0;await assert.rejects(execute(opts(p,undefined,async()=>{n++;})),/APPROVAL_REQUIRED/);assert.equal(n,0);assert.equal(existsSync(p.stateDir),false);
});
test('ichika-only: over-budget stops before transport, retaining previous reservations',async()=>{
  const p=plan();reserveBudget(smoke(p),randomUUID());for(let i=0;i<20;i++)reserveBudget(p,randomUUID());const before=readFileSync(join(p.stateDir,'budget.json'),'utf8');let n=0;const id=await approve(p);
  await assert.rejects(execute(opts(p,id,async()=>{n++;})),/BUDGET_EXCEEDED/);assert.equal(n,0);assert.equal(used(p,id),true);assert.equal(readFileSync(join(p.stateDir,'budget.json'),'utf8'),before);
});
for(const bad of [undefined,true,null,'false'])test(`ichika-only: store ${JSON.stringify(bad)} is rejected before transport`,async()=>{
  const p=plan();let n=0;const t=createGuardedTransport({plan:p,apiKey:KEY,runId:'MOCK',confirm:yes,fetchImpl:async()=>{n++;return response(p);}}),args=request(p,bad);
  if(bad===undefined){const b=JSON.parse(args[1].body);delete b.store;args[1].body=JSON.stringify(b);}await assert.rejects(t.fetch(...args),/TRANSPORT_STOPPED/);assert.equal(n,0);
});
test('ichika-only: missing snapshot prevents approval and leaves no state',async()=>{
  const p=plan();rmSync(p.snapshotPath);await assert.rejects(approve(p),/SNAPSHOT_MISSING/);assert.equal(existsSync(p.stateDir),false);
});
test('ichika-only: changed snapshot file stops before consuming approval or reserving',async()=>{
  const p=plan(),id=await approve(p);writeFileSync(p.snapshotPath,readFileSync(p.snapshotPath,'utf8')+' ');let n=0;await assert.rejects(execute(opts(p,id,async()=>{n++;})),/SNAPSHOT_FILE_HASH/);assert.equal(n,0);assert.equal(used(p,id),false);assert.equal(existsSync(join(p.stateDir,'budget.json')),false);
});
test('ichika-only: expired, forged count and incomplete snapshots are refused',async()=>{
  const p=plan();assert.throws(()=>loadSnapshot(p,Date.now()+SNAPSHOT_MAX_AGE_MS+1),/SNAPSHOT_STALE/);
  const s=snapshot();s.count=2;rewriteSnapshot(p,s);await assert.rejects(approve(p),/SNAPSHOT_INCOMPLETE/);
  const incomplete=snapshot();incomplete.complete=false;rewriteSnapshot(p,incomplete);await assert.rejects(approve(p),/SNAPSHOT_INCOMPLETE/);
});
test('ichika-only: metadata/content hash tampering is refused even if file hash is changed',async()=>{
  const p=plan(),s=snapshot();s.articles[0].title='改ざん';rewriteSnapshot(p,s);await assert.rejects(approve(p),/SNAPSHOT_CONTENT_HASH/);
});
test('ichika-only: input data hash mismatch prevents approval',async()=>{
  const p=plan();p.inputDataHash='0'.repeat(64);await assert.rejects(approve(p),/ICHIKA_INPUT_HASH/);
});
test('ichika-only: a newly sealed replacement snapshot cannot reuse an old approval',async()=>{
  const p=plan(),id=await approve(p);rewriteSnapshot(p,snapshot([{...snapshot().articles[0],title:'別の新しい公開記事'}]));let n=0;
  await assert.rejects(execute(opts(p,id,async()=>{n++;})),/INVALID_APPROVAL/);assert.equal(n,0);assert.equal(used(p,id),false);
});
test('ichika-only: a smoke-only approval cannot authorize an article',async()=>{
  const p=plan(),id=await approve(smoke(p));let n=0;await assert.rejects(execute(opts(p,id,async()=>{n++;})),/INVALID_APPROVAL/);assert.equal(n,0);
});
test('ichika-only: snapshot is rechecked after stage confirmation before dispatch',async()=>{
  const p=plan(),id=await approve(p);let n=0;const r=await execute(opts(p,id,async()=>{n++;return response(p);},async s=>{writeFileSync(p.snapshotPath,'{}');return s;}));assert.deepEqual(r,{status:'HOLD',calls:0});assert.equal(n,0);assert.equal(used(p,id),true);assert.equal(ledger(p).reservations[0].amountYen,32.64);
});
for(const which of ['title','body'])test(`ichika-only: existing published ${which} duplication gives HOLD with no regeneration`,async()=>{
  const p=plan();const prepared=prepareIchika(p,REPO),ai=fixture();let title=ai.title,text='既存の別の本文';
  if(which==='body'){
    const catalogue={categoryId:'11111111-1111-4111-8111-111111111111',categoryName:'研究',authorIds:{ichika:'22222222-2222-4222-8222-222222222221'}};
    const doc=composeDocument({ai,pack:prepared.pack,topic:prepared.c.topic,catalogue,coverMediaId:'33333333-3333-4333-8333-333333333333',coverAlt:'表紙'}).document;
    title='まったく別のタイトル';text=articleText(doc);
  }
  rewriteSnapshot(p,snapshot([{...snapshot().articles[0],title,text}]));const id=await approve(p);let n=0;const r=await execute(opts(p,id,async()=>{n++;return response(p);}));assert.deepEqual(r,{status:'HOLD',calls:1});assert.equal(n,1);const report=JSON.parse(readFileSync(join(p.output,'report.json'),'utf8'));assert.equal(report.results[0].gates.duplicates.verdict,'HOLD');assert.equal(report.publishAllowed,false);
});
test('ichika-only: quality rejection never retries or publishes',async()=>{
  const p=plan(),id=await approve(p);let n=0;const ai=fixture();ai.sections=JSON.parse(JSON.stringify(ai.sections).replaceAll('44%','45%'));
  const r=await execute(opts(p,id,async()=>{n++;return response(p,ai);}));assert.deepEqual(r,{status:'HOLD',calls:1});assert.equal(n,1);const report=JSON.parse(readFileSync(join(p.output,'report.json'),'utf8'));assert.equal(report.results[0].gates.data_integrity.verdict,'HOLD');assert.equal(report.publishAllowed,false);
});
test('ichika-only: RETRY quality outcome becomes local HOLD, not a second generation',async()=>{
  const p=plan(),id=await approve(p);let n=0;const ai=fixture();ai.seo_description='短い説明';
  const r=await execute(opts(p,id,async()=>{n++;return response(p,ai);}));assert.deepEqual(r,{status:'HOLD',calls:1});assert.equal(n,1);const report=JSON.parse(readFileSync(join(p.output,'report.json'),'utf8'));assert.equal(report.results[0].gates.seo.verdict,'RETRY');assert.equal(report.publishAllowed,false);
});
for(const failure of ['http','timeout','usage','tier','incomplete','secret'])test(`ichika-only: ${failure} stops after one attempt and keeps reservation/used marker`,async()=>{
  const p=plan(),id=await approve(p);let n=0;const r=await execute(opts(p,id,async()=>{n++;if(failure==='http')return new Response('{}',{status:500});if(failure==='timeout')throw new DOMException('mock','AbortError');const ai=fixture();if(failure==='secret')ai.lead=KEY;return response(p,ai,failure==='usage'?{usage:null}:failure==='tier'?{service_tier:'priority'}:failure==='incomplete'?{status:'incomplete'}:{});}));
  assert.deepEqual(r,{status:'HOLD',calls:1});assert.equal(n,1);assert.equal(used(p,id),true);assert.equal(ledger(p).reservations[0].amountYen,32.64);assert.equal(JSON.parse(readFileSync(join(p.output,'report.json'),'utf8')).publishAllowed,false);
  assertSafe(readFileSync(join(p.output,'report.json'),'utf8'),[KEY]);
});
test('ichika-only: actual mock timeout prevents retry',async()=>{
  const p=plan();let n=0;const t=createGuardedTransport({plan:p,apiKey:KEY,runId:'MOCK',confirm:yes,timeoutMs:10,fetchImpl:async()=>{n++;return new Promise(()=>{});}}),timer=setInterval(()=>{},100);
  try{await assert.rejects(t.fetch(...request(p)),/TRANSPORT_STOPPED/);await assert.rejects(t.fetch(...request(p)),/RUN_STOPPED/);assert.equal(n,1);}finally{clearInterval(timer);}
});

// Read-only Supabase adapter mock: only the SELECT/query methods below exist.
function mockClient({size=1,failCount=false,changeInventory=false,missingRevision=false,truncate=false,permissionDenied=false}={}){
  const calls=[];let inventories=0;const at='2026-10-01T00:00:00Z';
  const posts=Array.from({length:size},(_,i)=>({id:'p'+i,slug:'post-'+i,state:'published',published_revision_id:'r'+i,first_published_at:at,last_published_at:at}));
  const revisions=posts.map((p,i)=>({id:'r'+i,post_id:p.id,state:'sealed',title:'公開記事 '+i,excerpt:'抜粋'}));
  const blocks=posts.map((_,i)=>({id:'b'+i,revision_id:'r'+i,position:0,type:'TEXT',data:{text:'公開済み記事の本文です。タイトルや抜粋だけではなく、比較対象となる本文が存在します。'}}));
  return {calls,from(table){const ops=[];return new Proxy({}, {get(_t,name){
    if(name==='then')return (yes,no)=>{calls.push({table,ops});let rows=(table==='blog_posts'?posts:table==='blog_post_revisions'?revisions:blocks).map(x=>({...x}));
      if(permissionDenied)return Promise.resolve({data:null,error:{code:'42501'},count:null}).then(yes,no);
      for(const [op,...a]of ops){if(op==='eq')rows=rows.filter(r=>r[a[0]]===a[1]);if(op==='not')rows=rows.filter(r=>r[a[0]]!==null);if(op==='lte')rows=rows.filter(r=>Date.parse(r[a[0]])<=Date.parse(a[1]));}
      if(table==='blog_posts'&&changeInventory&&inventories++>0&&rows[0])rows[0].last_published_at='2026-10-02T00:00:00Z';
      if(table==='blog_post_revisions'&&missingRevision)rows=[];
      const count=failCount?null:rows.length,range=ops.find(x=>x[0]==='range');rows=rows.slice(range[1],range[2]+1);if(truncate)rows=rows.slice(0,199);
      return Promise.resolve({data:rows,error:null,count}).then(yes,no);};
    if(!['select','eq','not','lte','order','range'].includes(name))throw new Error('MUTATION_METHOD_FORBIDDEN');
    return (...args)=>{ops.push([name,...args]);return new Proxy({},this);};
  }});}};
}
test('snapshot capture: all published titles and bodies are paginated with exact counts using SELECT only',async()=>{
  const client=mockClient({size:201}),s=await capturePublishedSnapshot({client,databaseOrigin:source.url});assert.equal(s.count,201);assert.equal(s.complete,true);assert.equal(s.source.kind,'blog-anon-readonly-select');assert.equal(new Set(s.articles.map(a=>a.id)).size,201);assert.ok(s.articles.every(a=>a.title&&a.text));assert.ok(client.calls.every(c=>c.ops.some(o=>o[0]==='select')));
});
for(const problem of ['failCount','changeInventory','missingRevision','truncate','permissionDenied'])test(`snapshot capture: ${problem} stops without accepting partial data`,async()=>{
  await assert.rejects(capturePublishedSnapshot({client:mockClient({size:problem==='truncate'?201:1,[problem]:true}),databaseOrigin:source.url}),/HOLD/);
});
test('snapshot capture: empty inventory, credential-shaped content, Git output and overwrite are rejected',async()=>{
  await assert.rejects(capturePublishedSnapshot({client:mockClient({size:0}),databaseOrigin:source.url}),/SNAPSHOT_EMPTY/);
  const p=plan();assert.throws(()=>writeSnapshot(snapshot(),join(REPO,'snapshot.json')),/PATH_INSIDE_GIT/);assert.throws(()=>writeSnapshot(snapshot(),p.snapshotPath),/SNAPSHOT_EXISTS/);
  assert.throws(()=>snapshot([{...snapshot().articles[0],text:'Bearer fake-secret'}]),/SECRET_CONTENT/);
});
