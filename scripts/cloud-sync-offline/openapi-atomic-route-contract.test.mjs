import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const route=readFileSync(new URL('../../app/api/live/openapi-preview/route.js',import.meta.url),'utf8');
test('atomic route requires both existing and independent feature flags',()=>{
 const outer=route.indexOf('process.env.BS_OPENAPI_TODAY_SYNC_ENABLED !== "true"');
 const inner=route.indexOf('process.env.BS_OPENAPI_ATOMIC_SYNC_ENABLED === "true"');
 assert.ok(outer>=route.indexOf('async function handler(request)') && inner>=0,
  'handler must retain current-day gate and syncPreview must retain atomic opt-in');
 assert.ok(route.indexOf('const result = await syncPreview(date);')>outer,
  'handler must reject disabled current-day calls before invoking syncPreview');
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

test('handler accepts production-compatible zero-prefixed five-digit racer IDs',()=>{
 assert.match(route,/\^\(\?:\[0-9\]\{4\}\|0\[0-9\]\{4\}\)\$/);
 assert.doesNotMatch(route,/\/\^\[0-9\]\{4\}\$\/\.test\(String\(entry\.racer_registration_no/);
});

test('historical requests cannot invoke current-day bootstrap or atomic writer',()=>{
 const atomic=route.match(/if \(date === jstDate\(\) &&\s*process\.env\.BS_OPENAPI_ATOMIC_SYNC_ENABLED === "true"\)/);
 assert.ok(atomic,'atomic branch must remain current-day only');
 assert.match(route,/if \(date === jstDate\(\) && bootstrapEventRows\.length && bootstrapEntryRows\.length\)/,
  'legacy bootstrap must remain current-day only');
 assert.match(route,/if \(date === jstDate\(\)\) \{\s*if \(bootstrapEventRows\.length === 0/,
  'strict program validation must remain current-day gated');
});
test('GET and POST share authenticated write handler, never a read-only probe',()=>{
 assert.match(route,/if \(!secret \|\| request\.headers\.get\("authorization"\) !== `Bearer \$\{secret\}`\)/);
 assert.match(route,/export async function GET\(request\) \{\s*return handler\(request\);\s*\}/);
 assert.match(route,/export async function POST\(request\) \{\s*return handler\(request\);\s*\}/);
 assert.match(route,/const result = await syncPreview\(date\);/);
});
