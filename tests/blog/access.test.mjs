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
