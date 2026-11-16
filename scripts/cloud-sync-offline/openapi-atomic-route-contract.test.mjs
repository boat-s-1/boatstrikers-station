import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const route=readFileSync(new URL('../../app/api/live/openapi-preview/route.js',import.meta.url),'utf8');
test('atomic route requires both existing and independent feature flags',()=>{
 const outer=route.indexOf('process.env.BS_OPENAPI_TODAY_SYNC_ENABLED !== "true"');
 const inner=route.indexOf('process.env.BS_OPENAPI_ATOMIC_SYNC_ENABLED === "true"');
 assert.ok(outer>=0 && inner>outer,'atomic branch must be after existing current-day gate');
 assert.match(route,/if \(date === jstDate\(\) &&\s*process\.env\.BS_OPENAPI_ATOMIC_SYNC_ENABLED === "true"\)/);
});
test('atomic route calls one RPC before legacy multi-RPC sequence',()=>{
 const atomic=route.indexOf('supabase.rpc("bs_apply_openapi_atomic_candidate"');
 const legacy=route.indexOf('supabase.rpc("bs_apply_openapi_bootstrap"');
 assert.ok(atomic>=0 && legacy>atomic);
 assert.ok(route.indexOf('return {',atomic)>atomic && route.indexOf('return {',atomic)<legacy,
  'atomic path must return before legacy writes');
});
test('atomic RPC receives all program, preview and result phases',()=>{
 for(const field of ['p_date','p_events','p_entries','p_preview_entries',
 'p_preview_events','p_results','p_result_entries','p_synced_at']) {
  assert.match(route,new RegExp('\\b'+field+':'));
 }
});
