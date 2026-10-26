import test from 'node:test';
import assert from 'node:assert/strict';
import { checkSameOrigin, validDateInRange, intInRange, jstToday } from '../lib/adminApiInput.js';
import { acquireAdminJobLock, releaseAdminJobLock, resetAdminJobLocksForTest } from '../lib/adminJobLock.js';

const req = (headers = {}, url = 'https://www.boat-strike.online/api/admin/engine-v3/refresh') => new Request(url, { method: 'POST', headers });

test('Origin：自サイトだけ通す。他サイト・欠落・不正は拒否', () => {
  assert.equal(checkSameOrigin(req({ origin: 'https://www.boat-strike.online' })).ok, true);
  assert.equal(checkSameOrigin(req({ origin: 'https://evil.example' })).ok, false);
  assert.equal(checkSameOrigin(req({ origin: 'null' })).ok, false);
  assert.equal(checkSameOrigin(req({ origin: 'https://boat-strike.online' })).ok, false); // www なしは別オリジン
  // プロキシ越し（Vercel）：転送ヘッダーのホストも自サイトとして扱う
  assert.equal(checkSameOrigin(req({ origin: 'https://preview.example.vercel.app', 'x-forwarded-host': 'preview.example.vercel.app', 'x-forwarded-proto': 'https' }, 'http://localhost:3000/api/x')).ok, true);
});

test('Origin が無いとき：Sec-Fetch-Site、次に Referer で判断。どれも無ければ拒否', () => {
  assert.equal(checkSameOrigin(req({ 'sec-fetch-site': 'same-origin' })).ok, true);
  assert.equal(checkSameOrigin(req({ 'sec-fetch-site': 'cross-site' })).ok, false);
  assert.equal(checkSameOrigin(req({ 'sec-fetch-site': 'same-site' })).ok, false);
  assert.equal(checkSameOrigin(req({ referer: 'https://www.boat-strike.online/admin/engine-v3' })).ok, true);
  assert.equal(checkSameOrigin(req({ referer: 'https://evil.example/x' })).ok, false);
  assert.equal(checkSameOrigin(req({ referer: 'not a url' })).ok, false);
  assert.deepEqual(checkSameOrigin(req({})), { ok: false, reason: 'origin_missing' });
});

test('日付：実在する YYYY-MM-DD で、JST の今日から指定範囲内だけ', () => {
  const now = new Date('2026-10-26T03:00:00Z'); // JST 10/26 12:00
  assert.equal(jstToday(now), '2026-10-26');
  const ok = (v, o = { daysBack: 7 }) => validDateInRange(v, { ...o, now });
  assert.equal(ok('2026-10-26'), true);
  assert.equal(ok('2026-10-19'), true);
  assert.equal(ok('2026-10-18'), false);
  assert.equal(ok('2026-10-27'), false);
  assert.equal(ok('2026-02-30'), false);
  assert.equal(ok('2026-10-26T00:00:00Z'), false);
  assert.equal(ok("2026-10-26' or 1=1"), false);
  assert.equal(ok(20261026), false);
  assert.equal(ok(null), false);
  // JST の日付で判断する（UTC では前日の 10/25 15:30 = JST 10/26 00:30）
  const midnight = new Date('2026-10-25T15:30:00Z');
  assert.equal(validDateInRange('2026-10-26', { daysBack: 1, now: midnight }), true);
  assert.equal(validDateInRange('2026-10-24', { daysBack: 1, now: midnight }), false);
});

test('整数の範囲：文字列・小数・範囲外は拒否', () => {
  assert.equal(intInRange(1, 1, 24), true);
  assert.equal(intInRange(24, 1, 24), true);
  assert.equal(intInRange(0, 1, 24), false);
  assert.equal(intInRange('1', 1, 24), false);
  assert.equal(intInRange(1.5, 1, 24), false);
  assert.equal(intInRange(NaN, 1, 24), false);
});

function fakeRpc(handler) {
  const calls = [];
  return { calls, rpc: async (fn, args) => { calls.push([fn, args]); return handler(fn, args); } };
}

test('ロック：DB 関数があればそれで1つだけ取れる。解放時に待ち時間を渡す', async () => {
  let holder = null;
  const db = fakeRpc((fn, args) => {
    if (fn === 'bs_admin_try_lock') { if (holder) return { data: false, error: null }; holder = args.p_holder; return { data: true, error: null }; }
    if (fn === 'bs_admin_release_lock') { if (holder === args.p_holder) holder = null; return { data: null, error: null }; }
  });
  const a = await acquireAdminJobLock(db, 'job', { ttlSeconds: 60 });
  const b = await acquireAdminJobLock(db, 'job', { ttlSeconds: 60 });
  assert.deepEqual([a.ok, a.mode, b.ok, b.reason], [true, 'db', false, 'locked']);
  await releaseAdminJobLock(db, a, { cooldownSeconds: 30 });
  assert.equal(db.calls.at(-1)[1].p_cooldown_seconds, 30);
  assert.equal((await acquireAdminJobLock(db, 'job', { ttlSeconds: 60 })).ok, true);
});

test('ロック：DB 関数が未適用（PGRST202）ならインスタンス内の防止に切り替える。その他の DB エラーは失敗扱い', async () => {
  resetAdminJobLocksForTest();
  const missing = fakeRpc(() => ({ data: null, error: { code: 'PGRST202', message: 'not found' } }));
  const a = await acquireAdminJobLock(missing, 'job2', { ttlSeconds: 60 });
  const b = await acquireAdminJobLock(missing, 'job2', { ttlSeconds: 60 });
  assert.deepEqual([a.ok, a.mode, b.ok], [true, 'memory', false]);
  await releaseAdminJobLock(missing, a);
  assert.equal((await acquireAdminJobLock(missing, 'job2', { ttlSeconds: 60 })).ok, true);

  const broken = fakeRpc(() => ({ data: null, error: { code: '57014', message: 'timeout' } }));
  assert.equal((await acquireAdminJobLock(broken, 'job3', { ttlSeconds: 60 })).reason, 'error');
});
