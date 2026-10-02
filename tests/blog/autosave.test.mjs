import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAutosave, saveStatusLabel } from '../../lib/blog/autosave.mjs';
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};}
const timer={setTimer:()=>1,clearTimer:()=>{}};
test('autosave reports dirty/saving/saved timestamp and only acknowledges saved changes',async()=>{
 const gate=deferred();const backup=[];const states=[];
 const a=createAutosave({...timer,version:3,save:()=>gate.promise,backup:async x=>backup.push(x)});a.subscribe(s=>states.push(s.status));
 a.change({text:'first'});assert.equal(saveStatusLabel(a.getState()),'未保存変更あり');
 const pending=a.flush();assert.equal(saveStatusLabel(a.getState()),'保存中');
 gate.resolve({version:4,saved_at:'2026-10-02T14:00:00Z'});await pending;
 assert.equal(a.getState().dirty,false);assert.match(saveStatusLabel(a.getState()),/保存済み 23:00:00/);assert.deepEqual(states,['dirty','saving','saved']);assert.ok(backup.length>=2);a.dispose();
});
test('edits during a request stay dirty and next request uses the returned version',async()=>{
 const gate=deferred(),calls=[];
 const a=createAutosave({...timer,version:1,save:async(document,version)=>{calls.push({document,version});return calls.length===1?gate.promise:{version:3,saved_at:'2026-10-02T14:00:00Z'};}});
 a.change({text:'first'});const pending=a.flush();a.change({text:'newest'});
 gate.resolve({version:2,saved_at:'2026-10-02T14:00:00Z'});await pending;assert.equal(a.getState().dirty,true);
 await a.flush();assert.equal(calls[1].version,2);assert.equal(calls[1].document.text,'newest');assert.equal(a.getState().dirty,false);a.dispose();
});
test('offline failure preserves recovery; explicit retry can save it',async()=>{
 let fail=true;const snapshots=[];
 const a=createAutosave({...timer,version:1,backup:async s=>snapshots.push(s),save:async()=>{if(fail)throw new Error('offline');return{version:2,saved_at:'2026-10-02T14:00:00Z'};}});
 a.change({text:'keep'});await a.flush();assert.equal(a.getState().status,'error');assert.equal(a.getState().dirty,true);assert.match(saveStatusLabel(a.getState()),/保存失敗/);assert.equal(snapshots[0].document.text,'keep');
 fail=false;await a.retry();assert.equal(a.getState().dirty,false);a.dispose();
});
test('409 conflict blocks automatic retries and retains unsaved edits',async()=>{
 let calls=0;const a=createAutosave({...timer,version:1,save:async()=>{calls++;throw Object.assign(new Error('conflict'),{status:409});}});
 a.change({text:'mine'});await a.flush();a.change({text:'still mine'});await a.retry();assert.equal(calls,1);assert.equal(a.getState().status,'conflict');assert.equal(a.getState().dirty,true);a.dispose();
});
test('manual flush during an in-flight save drains pending edits without parallel requests',async()=>{
 const gate=deferred();let calls=0;const a=createAutosave({...timer,version:1,save:async()=>{calls++;return calls===1?gate.promise:{version:3,saved_at:'2026-10-02T14:00:00Z'};}});
 a.change({text:'first'});const first=a.flush();a.change({text:'second'});const second=a.flush();assert.equal(calls,1);
 gate.resolve({version:2,saved_at:'2026-10-02T14:00:00Z'});await Promise.all([first,second]);assert.equal(calls,2);assert.equal(a.getState().dirty,false);a.dispose();
});
test('re-subscribing after React Strict Mode cleanup restores notifications',async()=>{
 const a=createAutosave({...timer,version:1,save:async()=>({version:2,saved_at:'2026-10-02T14:00:00Z'})});const unsub=a.subscribe(()=>{});unsub();a.dispose();let notified=false;a.subscribe(()=>{notified=true;});a.change({text:'safe'});await a.flush();assert.equal(notified,true);a.dispose();
});
