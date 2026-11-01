import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {phase13ContractSql} from '../scripts/gamagori-phase13-contract.mjs';
const {PGlite}=await import(process.env.GAMAGORI_TEST_PGLITE_URL??'@electric-sql/pglite');
test('isolated PostgreSQL executes the same role/atomic-save/latest-negative contract matrix prepared for managed Preview DB',async()=>{
 const db=new PGlite();try{
  await db.exec('create role anon;create role authenticated;create role service_role bypassrls;');
  for(const path of ['tests/sql/gamagori-phase13-isolated-schema.sql','supabase/migrations/20261031051251_gamagori_append_only_observations.sql','supabase/migrations/20261031063142_gamagori_observed_chart_transaction.sql'])await db.exec(readFileSync(new URL('../'+path,import.meta.url),'utf8'));
  const r=await db.exec(phase13ContractSql()),e=r.at(-1).rows[0].evidence;assert(e.checks.length>=30);assert(e.checks.every(c=>c.passed));assert.equal(e.charts,6);assert.equal(e.receipts,1);console.log('SQL contract checks:',e.checks.length);
 }finally{await db.close();}
});
