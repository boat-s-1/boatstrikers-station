import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const src=await readFile(new URL('../app/lib/visiblePolling.js',import.meta.url),'utf8');
const {startVisiblePolling}=await import(`data:text/javascript;base64,${Buffer.from(src).toString('base64')}`);
const settle=()=>new Promise(resolve=>setImmediate(resolve));
function env(){let tick,visibility,cleared=false;globalThis.document={hidden:false,addEventListener:(_,f)=>visibility=f,removeEventListener:()=>visibility=null};globalThis.window={setInterval:f=>(tick=f,1),clearInterval:()=>cleared=true};return{tick:()=>tick(),visible:()=>visibility?.(),cleared:()=>cleared};}
test('hidden tabs do not fetch; visible overdue tab refreshes once and cleans up',async()=>{const e=env();let calls=0;document.hidden=true;const stop=startVisiblePolling(async()=>calls++,5000);await e.tick();assert.equal(calls,0);document.hidden=false;e.visible();await settle();assert.equal(calls,1);e.visible();await settle();assert.equal(calls,1);stop();assert.equal(e.cleared(),true);await e.tick();assert.equal(calls,1);});
test('slow requests never overlap even across visibility changes',async()=>{const e=env();let calls=0,release;const stop=startVisiblePolling(()=>{calls++;return new Promise(r=>release=r);},0);await e.tick();e.visible();assert.equal(calls,1);release();await settle();void e.tick();assert.equal(calls,2);release();await settle();stop();});
test('failure releases lock and retry waits for normal interval',async()=>{const e=env();const real=Date.now;let now=1000,calls=0;Date.now=()=>now;try{const stop=startVisiblePolling(async()=>{calls++;throw Error('offline');},5000);await settle();await e.tick();assert.equal(calls,1);now+=5000;await e.tick();assert.equal(calls,2);stop();}finally{Date.now=real;}});
