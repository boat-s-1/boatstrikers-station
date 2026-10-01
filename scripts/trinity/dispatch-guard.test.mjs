import assert from 'node:assert/strict';
import test from 'node:test';
import { dispatchPreviousDayCollector, previousEveningJst } from '../../app/lib/trinityGitHubDispatch.mjs';

test('only the previous evening in JST can dispatch', () => {
  assert.equal(previousEveningJst(new Date('2026-10-01T11:59:00Z')), false);
  assert.equal(previousEveningJst(new Date('2026-10-01T12:00:00Z')), true);
  assert.equal(previousEveningJst(new Date('2026-10-01T14:59:00Z')), true);
  assert.equal(previousEveningJst(new Date('2026-10-01T15:00:00Z')), false);
});

test('a late call makes no network request', async () => {
  const result = await dispatchPreviousDayCollector({
    token: 'example', now: new Date('2026-10-01T19:00:00Z'),
    fetcher: () => { throw new Error('must not dispatch'); },
  });
  assert.equal(result.status, 'outside_previous_evening_window');
});

test('dispatches the fixed workflow on main as a live shadow run', async () => {
  let request;
  const result = await dispatchPreviousDayCollector({
    token: 'example', now: new Date('2026-10-01T12:05:00Z'),
    fetcher: async (url, options) => { request = { url, options }; return { status: 204 }; },
  });
  assert.equal(result.status, 'dispatched');
  assert.match(request.url, /trinity-official-previous-day\.yml\/dispatches$/);
  assert.equal(request.options.headers.authorization, 'Bearer example');
  assert.deepEqual(JSON.parse(request.options.body), { ref: 'main', inputs: { dry_run: 'false' } });
});

test('rejects absent credentials and failed dispatch', async () => {
  const now = new Date('2026-10-01T12:05:00Z');
  await assert.rejects(dispatchPreviousDayCollector({ now }), /not configured/);
  await assert.rejects(dispatchPreviousDayCollector({ token: 'example', now,
    fetcher: async () => ({ status: 403 }) }), /HTTP 403/);
});
