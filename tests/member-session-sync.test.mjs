import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../app/lib/memberSessionSync.js', import.meta.url), 'utf8');
let sequence = 0;
async function setup(storage = new Map()) {
  globalThis.window = { sessionStorage: {
    getItem: key => storage.get(key) || null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: key => storage.delete(key),
  }};
  const calls = [];
  globalThis.fetch = async (url, options) => { calls.push(options); return { ok: true }; };
  const mod = await import(`data:text/javascript;base64,${Buffer.from(source + `\n// ${sequence++}`).toString('base64')}`);
  return { ...mod, calls, storage };
}
const session = (token = 'token-a', user = 'user-a') => ({access_token: token, user: {id: user}, expires_at: Date.now() / 1000 + 3600});
test('40 concurrent login/INITIAL_SESSION/consumer calls send one POST', async () => {
  const m = await setup();
  await Promise.all(Array.from({length: 40}, () => m.syncMemberSession(session())));
  assert.equal(m.calls.length, 1);
  await m.syncMemberSession(session());
  assert.equal(m.calls.length, 1);
});
test('reload and page navigation reuse successful fingerprint without storing bearer', async () => {
  let m = await setup(); await m.syncMemberSession(session());
  assert.equal(JSON.stringify([...m.storage]).includes('token-a'), false);
  m = await setup(m.storage); await m.syncMemberSession(session());
  assert.equal(m.calls.length, 0);
});
test('refresh and account switch each synchronize the new token', async () => {
  const m = await setup();
  await Promise.all([m.syncMemberSession(session()), m.syncMemberSession(session('token-b')), m.syncMemberSession(session('token-c', 'user-b'))]);
  assert.deepEqual(m.calls.map(c => c.headers.Authorization), ['Bearer token-a', 'Bearer token-b', 'Bearer token-c']);
});
test('POST then logout then login is serialized and logout is shared', async () => {
  const m = await setup(); let release; const calls = [];
  globalThis.fetch = async (_, opts) => { calls.push(opts.method); if (calls.length === 1) await new Promise(r => release = r); return {ok: true}; };
  const first = m.syncMemberSession(session());
  while (!release) await new Promise(r => setImmediate(r));
  const logout = m.clearMemberSession();
  assert.equal(m.clearMemberSession(), logout);
  const login = m.syncMemberSession(session('token-b'));
  release(); await Promise.all([first, logout, login]);
  assert.deepEqual(calls, ['POST', 'DELETE', 'POST']);
});
test('queued pre-logout token cannot restore cookie', async () => {
  const m = await setup();
  await Promise.all([m.syncMemberSession(session()), m.clearMemberSession()]);
  assert.deepEqual(m.calls.map(c => c.method), ['DELETE']);
});
test('failed POST is not cached; later call retries', async () => {
  const m = await setup(); let count = 0;
  globalThis.fetch = async () => ({ok: ++count > 1, status: 503});
  await assert.rejects(m.syncMemberSession(session()));
  await m.syncMemberSession(session());
  assert.equal(count, 2);
});
test('storage disabled still deduplicates', async () => {
  const m = await setup(); window.sessionStorage.getItem = () => {throw Error('disabled');};
  window.sessionStorage.setItem = () => {throw Error('disabled');};
  await m.syncMemberSession(session()); await m.syncMemberSession(session());
  assert.equal(m.calls.length, 1);
});
test('40 minute TTL renews cookie on next event', async () => {
  const m = await setup(); const realNow = Date.now; let now = realNow();
  Date.now = () => now;
  try { await m.syncMemberSession(session()); now += m.MEMBER_SESSION_SYNC_TTL_MS + 1;
    await m.syncMemberSession(session()); assert.equal(m.calls.length, 2);
  } finally {Date.now = realNow;}
});
test('failed DELETE remains retryable and new login waits for clear', async () => {
  const m = await setup(); let count = 0;
  globalThis.fetch = async () => ({ok: ++count > 1, status: 500});
  await assert.rejects(m.clearMemberSession());
  await m.clearMemberSession(); assert.equal(count, 2);
});
