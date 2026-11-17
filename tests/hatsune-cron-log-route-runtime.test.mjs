import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Execute the actual GET handler body with in-memory dependencies only.
// No HTTP requests, secrets, Supabase calls, or publishing are possible.
const source = readFileSync(new URL('../app/api/cron/hatsune-news-pipeline/route.js', import.meta.url), 'utf8');
const start = source.indexOf('export async function GET(request) {');
assert.ok(start >= 0, 'GET handler exists');
const handlerSource = source.slice(start).replace(/^export /, '');

function harness({ collection = { inserted: 1, errors: [] }, finishError = null, startError = null, aiKey = true } = {}) {
  const calls = [];
  const logs = [];
  const context = vm.createContext({
    process: { env: { OPENAI_API_KEY: aiKey ? 'offline-test-present' : '' } },
    console: { error: (...args) => logs.push(args) },
    NextResponse: { json: (body, options = {}) => ({ status: options.status ?? 200, body }) },
    isAuthorized: async () => true,
    startHatsuneCronRun: async () => { if (startError) throw startError; return { supabase: {}, run: { id: 7 } }; },
    finishHatsuneCronRun: async (payload) => {
      calls.push(payload);
      if (finishError) throw finishError;
    },
    collectHatsuneNews: async () => {
      if (collection instanceof Error) throw collection;
      return collection;
    },
    syncHatsuneMediaNews: async () => ({ inserted: 0, errors: [] }),
    syncBoatstrikersGeneralNews: async () => ({ inserted: 0, errors: [] }),
    ensureHatsuneDailyMinimum: async () => ({ inserted: false }),
    generatePendingHatsuneArticles: async () => [],
    countValue: (value) => Array.isArray(value) ? value.length : Number(value) || 0,
  });
  const GET = vm.runInContext('(' + handlerSource + ')', context);
  return { calls, logs, run: () => GET({}) };
}

test('success remains HTTP 200 when completion log transport throws', async () => {
  const h = harness({ finishError: Object.assign(new Error('private credentials'), { code: 'ECONNRESET' }) });
  const response = await h.run();
  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].status, 'success');
  assert.equal(h.logs[0][1].code, 'ECONNRESET');
  assert.ok(!JSON.stringify(h.logs).includes('private credentials'));
});

test('partial remains HTTP 200 and ok=false when completion log transport throws', async () => {
  const h = harness({ aiKey: false, finishError: new Error('network down') });
  const response = await h.run();
  assert.equal(response.status, 200);
  assert.equal(response.body.ok, false);
  assert.equal(h.calls[0].status, 'partial');
  assert.equal(h.logs[0][1].code, 'TRANSPORT_FAILURE');
});

test('original pipeline failure remains HTTP 500 when completion log transport throws', async () => {
  const h = harness({ collection: new Error('collector failure'), finishError: new Error('log network down') });
  const response = await h.run();
  assert.equal(response.status, 500);
  assert.equal(response.body.ok, false);
  assert.equal(response.body.error, 'collector failure');
  assert.equal(h.calls[0].status, 'error');
  assert.ok(!JSON.stringify(response.body).includes('log network down'));
});


test('start-log failure cannot disclose raw exception and pipeline still succeeds', async () => {
  const h = harness({ startError: Object.assign(new Error('private credentials'), { code: 'START_UNAVAILABLE' }) });
  const response = await h.run();
  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(h.calls.length, 0);
  assert.equal(h.logs[0][1].code, 'START_UNAVAILABLE');
  assert.ok(!JSON.stringify(h.logs).includes('private credentials'));
});
