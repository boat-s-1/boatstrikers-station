import test from 'node:test';import assert from 'node:assert/strict';
import {gamagoriAuthorized} from './gamagori-chart-http.mjs';
test('Cron auth accepts either configured secret, rejects empty/wrong credentials without DB work',()=>{
 const prev={CRON_SECRET:process.env.CRON_SECRET,GAMAGORI_COLLECTOR_SECRET:process.env.GAMAGORI_COLLECTOR_SECRET};
 try{
  process.env.CRON_SECRET='unit-cron';process.env.GAMAGORI_COLLECTOR_SECRET='unit-preview';
  for(const key of ['unit-cron','unit-preview'])assert(gamagoriAuthorized(new Request('https://example.test',{headers:{authorization:'Bearer '+key}})));
  for(const key of ['', 'Bearer invalid'])assert.equal(gamagoriAuthorized(new Request('https://example.test',{headers:{authorization:key}})),false);
  delete process.env.CRON_SECRET;delete process.env.GAMAGORI_COLLECTOR_SECRET;assert.equal(gamagoriAuthorized(new Request('https://example.test')),false);
 }finally{for(const [key,value] of Object.entries(prev))if(value===undefined)delete process.env[key];else process.env[key]=value;}
});
