import test from 'node:test';
import assert from 'node:assert/strict';
import { readPublicIndex, indexFilters, selectIndex } from '../../lib/blog/publicIndex.mjs';
const post = (id, slug, revision, first = '2026-01-01T00:00:00Z', last = first) => ({ id, slug, published_revision_id: revision.id, first_published_at:first,last_published_at:last,revision });
const revision = (id, post_id, title = 'イン逃げ', category_id = 'c1') => ({id,post_id,title,excerpt:'展示を考える',category_id,blog_post_authors:[{author_id:'a1',position:0}],blog_post_tags:[{tag_id:'t1'}]});
const index = {posts:[post('p1','inside',revision('r1','p1')),post('p2','women',revision('r2','p2','女子戦','c2'),'2026-02-01T00:00:00Z','2026-03-01T00:00:00Z')],categories:[{id:'c1',slug:'inside-course'},{id:'c2',slug:'women'}],authors:[{id:'a1',slug:'ichika'}],tags:[{id:'t1',slug:'exhibition'},{id:'t2',slug:'private-only'}]};
function mockClient(responses) {
  const calls=[];
  return { calls, from(table) {
    const call={table,operations:[]};calls.push(call);
    const builder = new Proxy({}, {get(_, name) {
      if(name==='then') return (resolve,reject)=>Promise.resolve(responses(table,call)).then(resolve,reject);
      return (...args)=>{call.operations.push([name,...args]);return builder;};
    }});return builder;
  }};
}
test('anon list selects only due published pointers and matching sealed revisions; no blocks/draft/template reads', async()=>{
  const client=mockClient(table=>({data:table==='blog_posts'?[{...index.posts[0],revision:undefined}]:table==='blog_post_revisions'?[index.posts[0].revision,revision('editing','p1','SECRET'),revision('r1','other','WRONG')]:[],error:null}));
  const data=await readPublicIndex(client,'2026-10-02T00:00:00Z');
  assert.equal(data.posts.length,1);assert.equal(data.posts[0].revision.title,'イン逃げ');
  const calls=client.calls;
  assert.deepEqual(calls.find(c=>c.table==='blog_posts').operations.slice(1,4),[['eq','state','published'],['not','published_revision_id','is',null],['lte','first_published_at','2026-10-02T00:00:00Z']]);
  const r=calls.find(c=>c.table==='blog_post_revisions');assert.ok(r.operations.some(x=>x[0]==='eq'&&x[1]==='state'&&x[2]==='sealed'));assert.deepEqual(r.operations.at(-1),['in','id',['r1']]);
  assert.ok(!JSON.stringify(calls).match(/editing_revision|scheduled_revision|blog_blocks|blog_templates|select","\*/));
});
test('missing public snapshot is omitted rather than replaced by an editing revision',async()=>{
  const client=mockClient(table=>({data:table==='blog_posts'?[{...index.posts[0],revision:undefined}]:table==='blog_post_revisions'?[revision('editing','p1','SECRET')]:[],error:null}));
  assert.equal((await readPublicIndex(client)).posts.length,0);
});
test('database errors propagate instead of returning partial public content',async()=>{
  const client=mockClient(table=>({data:[],error:table==='blog_posts'?new Error('permission'):null}));
  await assert.rejects(readPublicIndex(client),/permission/);
});
test('search normalizes literal text and combines category, author and tag filters',()=>{
  assert.equal(selectIndex(index,indexFilters({q:'展示',category:'inside-course',author:'ichika',tag:'exhibition'})).latest[0].slug,'inside');
  assert.equal(selectIndex(index,indexFilters({q:"%' OR 1=1"})).latest.length,0);
  assert.equal(selectIndex(index,indexFilters({category:'not-real'})).latest.length,0);
});
test('recommendations require explicitly chosen published slugs; template is never a fallback',()=>{
  assert.deepEqual(selectIndex(index,indexFilters({})).featured,[]);
  assert.deepEqual(selectIndex(index,indexFilters({}),['draft-template','inside']).featured.map(p=>p.slug),['inside']);
});
test('updated uses public publication time, tags only appear when attached to a public snapshot',()=>{
  const data=selectIndex(index,indexFilters({}));assert.deepEqual(data.updated.map(p=>p.slug),['women']);assert.deepEqual(data.tags.map(t=>t.slug),['exhibition']);
});
test('filters reject arrays, truncate inputs, and pagination keeps all query conditions',()=>{
  assert.equal(indexFilters({q:['a','b']}).q,'');assert.equal(indexFilters({q:'x'.repeat(200)}).q.length,100);
  const many={...index,posts:Array.from({length:25},(_,i)=>post(`p${i}`,`s${i}`,revision(`r${i}`,`p${i}`)))};
  const selected=selectIndex(many,indexFilters({page:'999'}));assert.equal(selected.pages,3);assert.equal(selected.page,3);assert.equal(selected.latest.length,1);
});
