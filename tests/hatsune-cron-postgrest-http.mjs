// PR #301 isolated PostgREST wire test. Never use production credentials.
// Usage: PR301_BRANCH_REF=<disposable ref> PR301_BRANCH_SERVICE_KEY=<secret>
//        PR301_BRANCH_ANON_KEY=<optional publishable/anon key> node tests/hatsune-cron-postgrest-http.mjs
import assert from 'node:assert/strict';

const ref = process.env.PR301_BRANCH_REF;
const serviceKey = process.env.PR301_BRANCH_SERVICE_KEY;
const anonKey = process.env.PR301_BRANCH_ANON_KEY;
const productionRef = 'rzosrbkyniyedolhkgxo';
assert.ok(ref && /^[a-z]{20}$/.test(ref) && ref !== productionRef, 'A nonproduction branch ref is required');
assert.ok(serviceKey, 'An isolated branch service key is required');
const base = `https://${ref}.supabase.co/rest/v1/hatsune_news_cron_runs`;
const headers = (key, extra = {}) => ({
  apikey: key, Authorization: `Bearer ${key}`,
  'Content-Type': 'application/json', ...extra,
});
async function request(method, suffix, key, payload, extra = {}) {
  const response = await fetch(base + suffix, {
    method, headers: headers(key, extra),
    body: payload === undefined ? undefined : JSON.stringify(payload),
    signal: AbortSignal.timeout(15000),
  });
  const body = await response.text();
  let data;
  try { data = body ? JSON.parse(body) : null; } catch { data = null; }
  return { status: response.status, data };
}
let id;
try {
  const created = await request('POST', '?select=id%2Cstarted_at%2Cjob_name', serviceKey,
    { job_name: 'pipeline', status: 'running' }, { Prefer: 'return=representation' });
  assert.equal(created.status, 201, 'service insert must succeed');
  assert.ok(Array.isArray(created.data) && created.data.length === 1);
  id = created.data[0].id;
  assert.ok(Number.isSafeInteger(id) && id > 0);
  const updated = await request('PATCH', `?id=eq.${id}&select=id%2Cstatus%2Cinserted_count`,
    serviceKey, { status: 'success', inserted_count: 2, finished_at: new Date().toISOString() },
    { Prefer: 'return=representation' });
  assert.equal(updated.status, 200);
  assert.deepEqual(updated.data, [{ id, status: 'success', inserted_count: 2 }]);
  const missing = await request('PATCH', '?id=eq.-1&select=id', serviceKey,
    { status: 'success' }, { Prefer: 'return=representation' });
  assert.equal(missing.status, 200);
  assert.deepEqual(missing.data, []);
  if (anonKey) {
    const denied = await request('PATCH', `?id=eq.${id}&select=id`, anonKey,
      { status: 'error' }, { Prefer: 'return=representation' });
    assert.ok(denied.status === 401 || denied.status === 403, 'anon update must be denied');
  }
  console.log('PASS: isolated HTTP insert, update representation, zero-match' +
    (anonKey ? ', anon denied' : ' (anon test skipped: no key)'));
} finally {
  if (id !== undefined) {
    const deleted = await request('DELETE', `?id=eq.${id}`, serviceKey);
    assert.ok(deleted.status === 204 || deleted.status === 200, 'test row cleanup failed');
  }
}
