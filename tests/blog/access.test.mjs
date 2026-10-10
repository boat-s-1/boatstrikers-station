import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBlogGuard } from '../../lib/blog/access.mjs';
import { blogBody, blogResponse } from '../../lib/blog/http.mjs';
const req = origin => new Request('https://preview.example/api/admin/blog/posts',{method:'POST',headers:origin?{origin}:{}});
test('BLOG disabled by default; no auth or DB access is attempted',async()=>{
 let called=false;const guard=createBlogGuard({configuration:()=>({enabled:false}),authenticate:async()=>{called=true;return true;}});
 await assert.rejects(()=>guard(req(),{write:true}),e=>e.status===503);assert.equal(called,false);
});
test('unauthenticated and cross-origin admin writes are rejected before mutation',async()=>{
 const guard=authenticated=>createBlogGuard({configuration:()=>({enabled:true,writesEnabled:true}),authenticate:async()=>authenticated});
 await assert.rejects(()=>guard(false)(req('https://preview.example'),{write:true}),e=>e.status===401);
 for(const origin of [undefined,'https://other.example'])await assert.rejects(()=>guard(true)(req(origin),{write:true}),e=>e.status===403);
 await guard(true)(req('https://preview.example'),{write:true});
});
test('write switch blocks mutations while authorized editor reads remain available',async()=>{
 const guard=createBlogGuard({configuration:()=>({enabled:true,writesEnabled:false}),authenticate:async()=>true});
 await guard(req());await assert.rejects(()=>guard(req('https://preview.example'),{write:true}),e=>e.status===503);
});
test('body parsing checks actual byte count, JSON type and malformed payloads',async()=>{
 const request=body=>new Request('https://preview.example',{method:'POST',headers:{'Content-Type':'application/json'},body});
 assert.deepEqual(await blogBody(request('{"version":1}')),{version:1});
 for(const body of ['null','[]','{invalid'])await assert.rejects(()=>blogBody(request(body)),e=>e.status===400);
 await assert.rejects(()=>blogBody(request('x'.repeat(1000001))),e=>e.status===413);
 await assert.rejects(()=>blogBody(new Request('https://preview.example',{method:'POST',body:'{}'})),e=>e.status===415);
});
test('conflict/errors are no-store/noindex and never expose database messages',async()=>{
 const r=await blogResponse(async()=>{throw{code:'40001',message:'private connection details'};});
 assert.equal(r.status,409);assert.equal(r.headers.get('Cache-Control'),'private, no-store');assert.equal(r.headers.get('X-Robots-Tag'),'noindex, nofollow');assert.ok(!(await r.text()).includes('private connection'));
 const e=await blogResponse(async()=>{throw new Error('secret key details');});assert.equal(e.status,500);assert.ok(!(await e.text()).includes('secret key'));
});

test('409: a reason the app wrote for the reader is shown; real conflicts and database errors keep the general guidance',async()=>{
 const body=async r=>(await r.json()).error;
 const GENERAL='別の保存や公開操作が先に完了しました。未保存の内容を保持して、最新版を確認してください。';
 // Explicit app reasons (generation stopped, comparison drafts, approval of an older version).
 for(const message of ['よく似た記事があります：「常滑のコース別1着率を確認する｜数字の読み方」。テーマを見直してください。','比較用に再生成した下書きです。承認・公開・予約公開はできません（正式に採用するには、別途の採用操作が必要です）。（公開）']){
  const r=await blogResponse(async()=>{throw Object.assign(new Error(message),{status:409});});
  assert.equal(r.status,409);assert.equal(await body(r),message);assert.equal(r.headers.get('Cache-Control'),'private, no-store');
 }
 // A database update conflict and the editor's version conflict on save: the general guidance.
 assert.equal(await body(await blogResponse(async()=>{throw{code:'40001',message:'could not serialize access'};})),GENERAL);
 assert.equal(await body(await blogResponse(async()=>{throw Object.assign(new Error('最新版と競合しています。'),{status:409,editConflict:true});})),GENERAL);
 // Database or library errors that carry a 409 never show their text.
 for(const error of [Object.assign(new Error('duplicate key value violates unique constraint "blog_posts_slug_key"'),{status:409,code:'23505'}),
   Object.assign(new Error('internal'),{status:409,details:'Key (slug)=(x) already exists.'}),Object.assign(new Error('internal'),{status:409,hint:'secret hint'}),
   {status:409,message:'plain object, not an app Error'},Object.assign(new Error('x'.repeat(501)),{status:409})]){
  const r=await blogResponse(async()=>{throw error;});
  assert.equal(r.status,409);assert.equal(await body(r),GENERAL);
 }
 // Other statuses behave as before: app reasons shown, internal errors hidden.
 assert.equal(await body(await blogResponse(async()=>{throw Object.assign(new Error('テーマを選んでください。'),{status:400});})),'テーマを選んでください。');
 const e=await blogResponse(async()=>{throw new Error('secret key details');});assert.equal(e.status,500);assert.ok(!(await e.text()).includes('secret'));
});
