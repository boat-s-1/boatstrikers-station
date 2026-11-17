import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// Evaluate only the exported completion function. No Supabase client,
// environment secrets, network, production data or package install.
const source=readFileSync(new URL('../lib/hatsuneCronLog.js',import.meta.url),'utf8');
const match=source.match(/export async function finishHatsuneCronRun\([\s\S]*$/);
assert.ok(match,'completion function must exist');
function makeHarness({data,error,throws}={}){
 const calls=[],logs=[];
 const supabase={from(table){calls.push(['from',table]);return {update(payload){calls.push(['update',payload]);return {eq(field,value){calls.push(['eq',field,value]);return {select(columns){calls.push(['select',columns]);return {async maybeSingle(){calls.push(['maybeSingle']);if(throws)throw throws;return {data,error}}}}}}}}}}};
 const context=vm.createContext({Date,Number,String,Math,console:{error:(...args)=>logs.push(args)}});
 const fn=vm.runInContext('('+match[0].replace(/^export /,'')+')',context);
 return {calls,logs,invoke:()=>fn({supabase,run:{id:123,started_at:'2026-11-17T00:00:00Z'},status:'success',metrics:{inserted:2,errorCount:0}})};
}
test('confirmed update emits no warning',async()=>{
 const h=makeHarness({data:{id:123},error:null});await h.invoke();
 assert.equal(h.logs.length,0);
 assert.equal(h.calls.find(x=>x[0]==='eq')[2],123);
 assert.equal(h.calls.find(x=>x[0]==='update')[1].inserted_count,2);
});
test('PostgREST returned error is logged with bounded code',async()=>{
 const h=makeHarness({data:null,error:{code:'42501',message:'SECRET SHOULD NOT BE LOGGED'}});await h.invoke();
 assert.equal(h.logs.length,1);assert.equal(h.logs[0][1].code,'42501');
 assert.ok(!JSON.stringify(h.logs).includes('SECRET SHOULD NOT BE LOGGED'));
});
test('zero matching rows is logged',async()=>{
 const h=makeHarness({data:null,error:null});await h.invoke();
 assert.equal(h.logs[0][1].code,'NO_MATCHING_ROW');
});
test('unexpected thrown transport failure propagates to caller',async()=>{
 const h=makeHarness({throws:new Error('network down')});await assert.rejects(h.invoke(),/network down/);
});
test('invalid missing context is a no-op',async()=>{
 const context=vm.createContext({Date,Number,String,Math,console:{error(){throw Error('should not log')}}});
 const fn=vm.runInContext('('+match[0].replace(/^export /,'')+')',context);
 await fn({supabase:null,run:null,status:'success'});
});
