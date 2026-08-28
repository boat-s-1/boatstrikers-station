import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseNarutoKaratsu as parse} from '../lib/narutoKaratsuVerifiedTenji.js';
const now=new Date('2026-08-28T06:00:00Z');
for(const [name,code,first] of [['naruto',14,[6.74,37.04,5.90,7.11]],['karatsu',23,[6.80,36.90,5.37,7.93]]]){
 const html=fs.readFileSync(new URL(`./fixtures/original-tenji/${name}-identity-20260828.html`,import.meta.url),'utf8');
 const race={courseCode:code,raceDate:'2026-08-28',raceNo:10};
 test(`${name}: real data, identity and six boats`,()=>{const r=parse(html,race,now);assert.equal(r.ok,true,JSON.stringify(r));assert.equal(r.rows.length,6);assert.deepEqual(Object.values(r.rows[0]).slice(1),first);});
 test(`${name}: wrong date rejected`,()=>assert.equal(parse(html,{...race,raceDate:'2026-08-27'},now).ok,false));
 test(`${name}: wrong race rejected`,()=>assert.equal(parse(html,{...race,raceNo:11},now).ok,false));
 test(`${name}: wrong venue rejected`,()=>assert.equal(parse(html,{...race,courseCode:code===14?23:14},now).ok,false));
 test(`${name}: half lap rejected`,()=>assert.equal(parse(html.replaceAll('一周','半周'),race,now).ok,false));
 test(`${name}: missing values rejected`,()=>assert.equal(parse(html.replace(first[1].toFixed(2),'--.--'),race,now).ok,false));
 test(`${name}: boat identity mismatch rejected`,()=>assert.equal(parse(html.replace('tei_color1','tei_color2'),race,now).error,'boat_identity_mismatch'));
 test(`${name}: duplicate table rejected`,()=>assert.equal(parse(html+html,race,now).ok,false));
 test(`${name}: invalid input rejected`,()=>assert.equal(parse(html,{...race,raceNo:1.5},now).error,'invalid_race'));
}
