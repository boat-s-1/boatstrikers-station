import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../lib/hatsuneCronLog.js',import.meta.url),'utf8');
const fnSource=source.match(/export async function finishHatsuneCronRun\([\s\S]*$/)?.[0];
assert.ok(fnSource);
function harness(rows,{deny=false}={}){
 const logs=[],calls=[];
 const supabase={from(name){
  assert.equal(name,'hatsune_news_cron_runs');
  return {update(patch){
   calls.push({operation:'update',patch});
   return {eq(column,id){
    assert.equal(column,'id');
    return {select(fields){
     assert.equal(fields,'id');
     return {async maybeSingle(){
      if(deny)return {data:null,error:{code:'42501',message:'private-db-details'}};
      const row=rows.find(x=>x.id===id);
      if(!row)return {data:null,error:null};
      Object.assign(row,patch);
      return {data:{id:row.id},error:null};
     }};
    }};
   }};
  }};
 }};
 const context=vm.createContext({Date,Number,String,Math,console:{error:(...args)=>logs.push(args)}});
 const fn=vm.runInContext('('+fnSource.replace(/^export /,'')+')',context);
 return {logs,calls,run:(id,metrics={})=>fn({supabase,run:{id,started_at:'2026-11-17T00:00:00Z'},status:'partial',metrics,errorMessage:'test-only',details:{test:true}})};
}
test('existing running row becomes partial and retains counters',async()=>{
 const rows=[{id:1,status:'running'}],h=harness(rows);
 await h.run(1,{collected:5,inserted:2,skipped:3,aiGenerated:1,errorCount:1});
 assert.equal(rows[0].status,'partial');assert.equal(rows[0].inserted_count,2);
 assert.equal(rows[0].error_count,1);assert.ok(rows[0].finished_at);assert.equal(h.logs.length,0);
});
test('unknown id leaves existing rows unchanged and emits missing-row log',async()=>{
 const rows=[{id:1,status:'running'}],h=harness(rows);await h.run(999);
 assert.equal(rows[0].status,'running');assert.equal(h.logs[0][1].code,'NO_MATCHING_ROW');
});
test('RLS-like denial leaves row running and emits code without error details',async()=>{
 const rows=[{id:1,status:'running'}],h=harness(rows,{deny:true});await h.run(1);
 assert.equal(rows[0].status,'running');assert.equal(h.logs[0][1].code,'42501');
 assert.ok(!JSON.stringify(h.logs).includes('private-db-details'));
});
test('repeated update of same row changes only targeted record',async()=>{
 const rows=[{id:1,status:'running'},{id:2,status:'running'}],h=harness(rows);
 await h.run(1,{inserted:3});await h.run(1,{inserted:3});
 assert.equal(rows[0].inserted_count,3);assert.equal(rows[1].status,'running');
 assert.equal(h.logs.length,0);
});
