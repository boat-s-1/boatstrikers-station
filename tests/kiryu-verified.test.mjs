import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchKiryuVerifiedOriginalTenji, parseKiryuOriginalTenji, validKiryuRace, verifyKiryuPageIdentity } from '../lib/kiryuVerifiedOriginalTenji.js';

const race={courseCode:1,raceDate:'2026-09-07',raceNo:3};
const page=`<p>本日開催中 09月07日(月)</p><select><option value="./?page=yosou-cyokuzen&race=3" selected>3R</option></select>`;
const timingRows=Array.from({length:6},(_,i)=>`<tr><td class="col1 im_color${i+1}" rowspan="2">${i+1}</td><td class="col4" rowspan="2">${(6.70+i/100).toFixed(2)}</td><td class="col5_1">${(14.10+i/100).toFixed(2)}</td><td class="col5_2">${(5.10+i/100).toFixed(2)}</td><td class="col5_3">${(7.10+i/100).toFixed(2)}</td></tr>`).join('');
const racerRows=Array.from({length:6},(_,i)=>`<tr><td class="im_color${i+1} bodyh_02 col1">${i+1}</td><td class="col2"><a href="https://www.boatrace.jp/owpc/pc/data/racersearch/season?toban=${4200+i}">選手</a></td></tr>`).join('');
const ajax=`<div><table><thead><th>展示タイム</th><th>オリジナル展示データ</th><th>半周</th><th>まわり足</th><th>直線</th></thead><tbody>${timingRows}</tbody></table></div><!--sep--><table>${racerRows}</table>`;

test('Kiryu parses six measured rows and keeps half-lap separate from lap',()=>{
 const rows=parseKiryuOriginalTenji(ajax);assert.equal(rows.length,6);assert.deepEqual(rows[0],{boatNo:1,racerNo:'4200',exhibitionTime:6.7,lapTime:null,halfLapTime:14.1,turnTime:5.1,straightTime:7.1});
});
test('Kiryu page identity requires the selected requested race and date',()=>{
 assert.equal(verifyKiryuPageIdentity(page,race),true);
 assert.equal(verifyKiryuPageIdentity(page,{...race,raceNo:4}),false);
 assert.equal(verifyKiryuPageIdentity(page.replace('09月07日','09月06日'),race),false);
});
test('Kiryu fails closed for blanks, five boats, duplicate boats, or invalid race',()=>{
 assert.equal(parseKiryuOriginalTenji(ajax.replace('6.70','-.--')).length,0);
 assert.equal(parseKiryuOriginalTenji(ajax.replace(timingRows.match(/<tr>[\s\S]*?<\/tr>/)[0],'')).length,0);
 assert.equal(parseKiryuOriginalTenji(ajax.replace('im_color6" rowspan="2">6','im_color6" rowspan="2">5')).length,0);
 assert.equal(validKiryuRace({...race,raceDate:'2026-02-30'}),false);
});

test('Kiryu opens the shell first and reuses its PHP session for Ajax', async()=>{
 const originalFetch=globalThis.fetch;
 const calls=[];
 globalThis.fetch=async(url,options={})=>{
  calls.push({url:String(url),headers:options.headers||{}});
  if(String(url).includes('boatrace.jp'))return new Response('unavailable',{status:503});
  if(String(url).includes('index.php'))return new Response(page,{status:200,headers:{'set-cookie':'PHPSESSID=session123; path=/; secure; HttpOnly'}});
  return new Response('unavailable',{status:503});
 };
 try{
  await fetchKiryuVerifiedOriginalTenji(race,{timeoutMs:1000});
  const ajaxCall=calls.find(call=>call.url.includes('ajax_cyokuzen.php'));
  assert.equal(ajaxCall.headers.cookie,'PHPSESSID=session123');
  assert.equal(ajaxCall.headers.referer,'https://www.kiryu-kyotei.com/sp/index.php?page=yosou-cyokuzen&race=3');
  assert.ok(calls.findIndex(call=>call.url.includes('index.php')) < calls.findIndex(call=>call.url.includes('ajax_cyokuzen.php')));
 }finally{globalThis.fetch=originalFetch;}
});
