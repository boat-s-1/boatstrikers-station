import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('../app/api/home/realtime/route.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace(/export /g,'');
const response={json:(body,options={})=>({body,headers:options.headers||{}})};
function handler(result){
 const query={};for(const name of ['from','select','eq','lte','order'])query[name]=()=>query;
 query.limit=async()=>result;
 return new Function('NextResponse','getPublicScheduleSupabase','console',source+';return GET;')(response,()=>result===null?null:query,{error(){}});
}
test('public successful response can be cached without changing payload',async()=>{
 const r=await handler({data:[{id:1,title:'Latest',link_url:'/races'}],error:null})();
 assert.equal(r.headers['Cache-Control'],'public, max-age=0, s-maxage=30');assert.equal(r.body.item.url,'/races');
});
test('configuration and query failures never cache fallback responses',async()=>{
 for(const input of [null,{data:null,error:new Error('unavailable')}]){
  const r=await handler(input)();assert.equal(r.headers['Cache-Control'],'no-store');assert.deepEqual(r.body,{item:null});
 }
});
