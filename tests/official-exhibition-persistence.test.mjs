import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildOfficialEntryUpdate, validateOfficialRowsAgainstRoster } from '../lib/officialExhibitionPersistence.js';

const source = { ok:true, source:'hamanako_official_verified', rows:Array.from({length:6},(_,i)=>({boatNo:i+1,racerNo:String(4200+i),exhibitionTime:6.7+i/100,lapTime:37+i/10,turnTime:5+i/10,straightTime:8+i/100})) };
const roster = source.rows.map(row=>({boat_no:row.boatNo,racer_registration_no:row.racerNo}));

test('six official rows match the saved boat and racer roster',()=>assert.deepEqual(validateOfficialRowsAgainstRoster(source,roster),{ok:true}));
test('five boats, duplicate boats, incomplete saved roster, and racer mismatch fail closed',()=>{
  assert.equal(validateOfficialRowsAgainstRoster({...source,rows:source.rows.slice(0,5)},roster).error,'six_unique_boats_required');
  assert.equal(validateOfficialRowsAgainstRoster({...source,rows:[...source.rows.slice(0,5),source.rows[0]]},roster).error,'six_unique_boats_required');
  assert.equal(validateOfficialRowsAgainstRoster(source,roster.slice(0,5)).error,'saved_roster_incomplete');
  assert.deepEqual(validateOfficialRowsAgainstRoster(source,roster.map((row,i)=>i?row:{...row,racer_registration_no:'9999'})),{ok:false,error:'saved_roster_mismatch',boatNo:1});
});
test('only present official measurements are written, so blanks cannot erase stored values',()=>{
  const update=buildOfficialEntryUpdate({...source.rows[0],straightTime:null,exhibitionSymbol:undefined},source,'2026-09-01T01:00:00Z');
  assert.equal(update.official_exhibition_time,6.7);assert.equal(update.official_lap,37);assert.equal(update.official_turn,5);
  assert.equal('official_straight' in update,false);assert.equal('official_exhibition_symbol' in update,false);
});
test('production collector uses roster-verified persistence and evaluates PC fallback',()=>{
  const code=readFileSync(new URL('../app/api/cron/exhibition-alerts/route.js',import.meta.url),'utf8');
  assert.ok(code.includes('persistOfficialExhibition(supabase,race,source)'));
  assert.ok(code.includes('pcFallbackEvaluated:true'));
  assert.ok(code.includes('evaluate_boat4_double_top_alerts'));
  assert.equal(code.includes('.eq("boat_no",row.boatNo)'),false);
});
