import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readPrivateMedia} from '../../lib/blog/privateMedia.mjs';
const id='80000000-0000-4000-8000-000000000001';
function client({publicBucket=false,status='private',path=`drafts/2026-10-03/${id}.png`}={}) {
 let downloaded=false;
 const query={select(){return this;},eq(){return this;},async maybeSingle(){return {data:{storage_path:path,status}};}};
 return {from:()=>query,storage:{getBucket:async()=>({data:{public:publicBucket}}),from:()=>({download:async()=>{downloaded=true;return {data:new Blob(['image'])};}})},downloaded:()=>downloaded};
}
test('private media rejects public buckets, published assets, unsafe paths and invalid IDs before download',async()=>{
 for(const options of [{publicBucket:true},{status:'public'},{path:'../secret.png'}]){const c=client(options);await assert.rejects(()=>readPrivateMedia(c,'drafts',id));assert.equal(c.downloaded(),false);}
 await assert.rejects(()=>readPrivateMedia(client(),'drafts','invalid'));
 await assert.rejects(()=>readPrivateMedia(client(),null,id));
});
test('authorized private media response never exposes storage URL and cannot be cached/indexed',async()=>{
 const response=await readPrivateMedia(client(),'drafts',id);
 assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store');assert.match(response.headers.get('x-robots-tag'),/noindex/);assert.equal(response.headers.get('content-type'),'image/png');assert.equal(response.headers.get('location'),null);
});
test('upload remains private, admin auth precedes media access, admin tags match schema and private images bypass Next cache',()=>{
 const read=p=>readFileSync(new URL(`../../${p}`,import.meta.url),'utf8');
 const upload=read('app/api/admin/blog/media/route.js');assert.match(upload,/BLOG_PRIVATE_MEDIA_BUCKET/);assert.match(upload,/status:'private',public_path:null/);assert.ok(!upload.includes('getPublicUrl'));
 const route=read('app/api/admin/blog/media/[id]/route.js');assert.ok(route.indexOf('await requireBlogAdmin')<route.indexOf('await readPrivateMedia'));
 const admin=read('lib/blog/adminData.js');assert.match(admin,/rows\('blog_tags','id,slug,name,active'/);assert.match(admin,/public_path:`\/api\/admin\/blog\/media\//);
 assert.match(read('app/blog/ArticleBlocks.js'),/unoptimized=.*startsWith\('\/api\/admin\/'\)/);
});
