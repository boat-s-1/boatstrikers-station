import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {VENUES,diagnosticStatus} from '../lib/exhibitionStatusCatalog.js';
test('all 24 venues have unique codes',()=>assert.deepEqual(VENUES.map(v=>v.code),Array.from({length:24},(_,i)=>i+1)));
test('diagnostics only enabled for connected verified or staging adapters',()=>assert.deepEqual(VENUES.filter(v=>v.endpoint).map(v=>v.code),[5,12,14,15,18,23,24]));
test('staging never labelled connected',()=>assert.ok(VENUES.filter(v=>[12,18,24].includes(v.code)).every(v=>v.stage==='検証用実装')));
test('only confirmed straight absence displayed',()=>assert.deepEqual(VENUES.filter(v=>v.straightAbsent).map(v=>v.code),[12,13,18]));
test('unverified success cannot become green',()=>assert.notEqual(diagnosticStatus({ok:true,rows:Array(6).fill({})}).tone,'good'));
test('six verified rows show acquisition success, not notification success',()=>assert.equal(diagnosticStatus({ok:true,identity:{verified:true},rows:Array(6).fill({})}).label,'取得成功'));
test('six candidate rows remain staging',()=>assert.equal(diagnosticStatus({ok:true,candidateRows:Array(6).fill({})}).label,'検証データ取得'));
for(const [error,label] of [['source_identity_mismatch','照合不一致'],['current_day_only','照合不一致'],['measurements_incomplete_or_invalid','欠測・要確認'],['upstream_timeout','取得失敗'],['retry_later','取得失敗'],['exhibition_pending','展示待ち']])test(error,()=>assert.equal(diagnosticStatus({ok:false,error}).label,label));
test('admin homepage moves notification center into alert hub',()=>{
 const home=readFileSync(new URL('../app/admin/page.js',import.meta.url),'utf8');
 assert.ok(home.includes('/admin/alerts'));assert.ok(!home.includes('LINE ALERT CENTER'));assert.ok(!home.includes('href: "/admin/exhibition-alerts"'));
 const hub=readFileSync(new URL('../app/admin/alerts/page.js',import.meta.url),'utf8');
 for(const href of ['/admin/exhibition-alerts','/admin/ichika-hidden-escape','/admin/hatsune-womens-inner-break','/admin/alerts/exhibition','#notifications'])assert.ok(hub.includes(href));
});
test('status screen is read-only and avoids automatic venue scans',()=>{
 const page=readFileSync(new URL('../app/admin/alerts/exhibition/page.js',import.meta.url),'utf8');
 assert.ok(!page.includes('/api/cron'));assert.ok(!page.includes('SUPABASE'));assert.ok(!page.includes('setInterval'));
});
