import test from 'node:test';
import assert from 'node:assert/strict';
import { runTrinityShadow } from '../../app/lib/trinityShadowRunner.js';
import { GET } from '../../app/api/cron/trinity-shadow/route.js';

function fakeDb({ failTable = null } = {}) {
  const calls = [];
  return {
    calls,
    from(table) {
      calls.push(table);
      const q = {
        select() { return q; },
        gte() { return q; },
        lte() { return q; },
        eq() { return q; },
        order() { return q; },
        limit() { return q; },
        range() { return q; },
        then(resolve, reject) {
          return Promise.resolve(failTable === table
            ? { data: null, error: new Error('isolated mock read failure') }
            : { data: [], error: null }).then(resolve, reject);
        },
      };
      return q;
    },
  };
}

test('unauthorized request is rejected before database access', async () => {
  const old = process.env.CRON_SECRET;
  process.env.CRON_SECRET = 'offline-test-secret';
  try {
    for (const authorization of [null, 'Bearer wrong']) {
      const headers = authorization ? { authorization } : {};
      const response = await GET(new Request('http://localhost/api/cron/trinity-shadow', { headers }));
      assert.equal(response.status, 401);
      assert.equal((await response.json()).error, 'unauthorized');
    }
  } finally {
    if (old === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = old;
  }
});

test('isolated runner returns empty result without contacting Supabase', async () => {
  const db = fakeDb();
  const response = await runTrinityShadow({ db });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.eligible, 0);
  assert.equal(body.saved, 0);
  assert.equal(body.settled, 0);
  assert.deepEqual(body.errors, []);
  assert.deepEqual(db.calls, ['trinity_prediction_snapshots', 'bs_race_events']);
});

test('isolated runner reports database read errors without production credentials', async () => {
  const db = fakeDb({ failTable: 'trinity_prediction_snapshots' });
  const response = await runTrinityShadow({ db });
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { ok: false, error: 'isolated mock read failure' });
});
