import test from 'node:test';
import assert from 'node:assert/strict';
import { claimDataLabGeneration, releaseDataLabClaim, COOLDOWN_MS, STALE_MS } from '../lib/dataLabSocialClaim.js';

// supabase-js の問い合わせを真似た偽クライアント。1つの問い合わせは await された時点で一括して実行される
// （DB の1文が原子的なのと同じ）。race_date は一意。
function fakeDb(rows = []) {
  const table = rows.map((r, i) => ({ id: i + 1, ...r }));
  let nextId = table.length + 1;
  const log = [];
  const match = (row, filters) => filters.every((f) => f(row));
  const cond = (expr) => {
    const [col, op, ...rest] = expr.split('.');
    const value = rest.join('.');
    if (op === 'eq') return (row) => String(row[col]) === value;
    if (op === 'lt') return (row) => new Date(row[col]).getTime() < new Date(value).getTime();
    throw new Error(`未対応 ${expr}`);
  };
  const parseOr = (s) => {
    const groups = [...s.matchAll(/and\(([^)]*)\)/g)].map((m) => m[1].split(',').map(cond));
    return (row) => groups.some((g) => g.every((c) => c(row)));
  };
  const client = {
    from() {
      const q = { filters: [], op: 'select' };
      const b = {
        select() { return b; },
        eq(col, val) { q.filters.push((row) => String(row[col]) === String(val)); return b; },
        or(s) { q.filters.push(parseOr(s)); return b; },
        maybeSingle() { q.single = true; return b; },
        upsert(row, opts) { q.op = 'upsert'; q.row = row; q.opts = opts; return b; },
        update(patch) { q.op = 'update'; q.patch = patch; return b; },
        delete() { q.op = 'delete'; return b; },
        then(resolve, reject) {
          // 実行の前に一度ほかの要求に順番を譲り、同時実行の割り込みを起こす
          setImmediate(() => {
            try {
              log.push(q.op);
              if (q.op === 'select') {
                const found = table.filter((r) => match(r, q.filters)).map((r) => ({ ...r }));
                return resolve({ data: q.single ? found[0] || null : found, error: null });
              }
              if (q.op === 'upsert') {
                const exists = table.find((r) => r.race_date === q.row.race_date);
                if (exists) {
                  if (q.opts?.ignoreDuplicates) return resolve({ data: [], error: null });
                  Object.assign(exists, q.row);
                  return resolve({ data: [{ ...exists }], error: null });
                }
                const row = { id: nextId++, x_post_text: null, ...q.row };
                table.push(row);
                return resolve({ data: [{ ...row }], error: null });
              }
              if (q.op === 'update') {
                const hit = table.filter((r) => match(r, q.filters));
                hit.forEach((r) => Object.assign(r, q.patch));
                return resolve({ data: hit.map((r) => ({ ...r })), error: null });
              }
              if (q.op === 'delete') {
                const hit = table.filter((r) => match(r, q.filters));
                hit.forEach((r) => table.splice(table.indexOf(r), 1));
                return resolve({ data: null, error: null });
              }
            } catch (e) { reject(e); }
          });
        },
      };
      return b;
    },
  };
  return { client, table, log };
}

const NOW = Date.parse('2026-10-26T04:00:00Z');
const ago = (ms) => new Date(NOW - ms).toISOString();
const DATE = '2026-10-24';

test('未生成の日：同時に10件届いても生成できるのは1件だけ', async () => {
  const { client, table } = fakeDb();
  const results = await Promise.all(Array.from({ length: 10 }, () => claimDataLabGeneration(client, DATE, { now: NOW })));
  assert.equal(results.filter((r) => r.ok).length, 1);
  assert.ok(results.filter((r) => !r.ok).every((r) => r.reason === 'busy'));
  assert.equal(table.length, 1);
  assert.equal(table[0].status, 'generating');
});

test('既存の下書き：同時に10件届いても生成できるのは1件だけ', async () => {
  const { client, table } = fakeDb([{ race_date: DATE, status: 'draft', updated_at: ago(10 * 60 * 1000), x_post_text: '本文' }]);
  const results = await Promise.all(Array.from({ length: 10 }, () => claimDataLabGeneration(client, DATE, { now: NOW })));
  assert.equal(results.filter((r) => r.ok).length, 1);
  assert.equal(table.length, 1);
  assert.equal(table[0].x_post_text, '本文');
});

test('60秒以内に生成・着手した下書きは作り直さない（書き込みなし）', async () => {
  const { client, log } = fakeDb([{ race_date: DATE, status: 'draft', updated_at: ago(COOLDOWN_MS - 1000), x_post_text: '本文' }]);
  const r = await claimDataLabGeneration(client, DATE, { now: NOW });
  assert.deepEqual([r.ok, r.reason], [false, 'recent']);
  assert.deepEqual(log, ['select']);
});

test('生成中の行は5分間ほかの要求に取らせない。処理落ちで残った行は5分後に取り直せる', async () => {
  const fresh = fakeDb([{ race_date: DATE, status: 'generating', updated_at: ago(STALE_MS - 1000) }]);
  assert.equal((await claimDataLabGeneration(fresh.client, DATE, { now: NOW })).reason, 'busy');
  const stale = fakeDb([{ race_date: DATE, status: 'generating', updated_at: ago(STALE_MS + 1000) }]);
  assert.equal((await claimDataLabGeneration(stale.client, DATE, { now: NOW })).ok, true);
});

test('下書き以外の状態は作り直さない', async () => {
  const { client, log } = fakeDb([{ race_date: DATE, status: 'posted', updated_at: ago(60 * 60 * 1000), x_post_text: '本文' }]);
  assert.equal((await claimDataLabGeneration(client, DATE, { now: NOW })).reason, 'locked');
  assert.deepEqual(log, ['select']);
});

test('読んだ後に別の要求が先に取った場合は busy（条件付き UPDATE が0件）', async () => {
  const db = fakeDb([{ race_date: DATE, status: 'draft', updated_at: ago(10 * 60 * 1000), x_post_text: '本文' }]);
  const [a, b] = await Promise.all([claimDataLabGeneration(db.client, DATE, { now: NOW }), claimDataLabGeneration(db.client, DATE, { now: NOW })]);
  assert.deepEqual([a.ok, b.ok].sort(), [false, true]);
  assert.equal([a, b].find((r) => !r.ok).reason, 'busy');
});

test('失敗時の後始末：仮の行は消し、既存の下書きは draft に戻す。他人の行は触らない', async () => {
  const fresh = fakeDb();
  const c1 = await claimDataLabGeneration(fresh.client, DATE, { now: NOW });
  await releaseDataLabClaim(fresh.client, c1);
  assert.equal(fresh.table.length, 0);

  const existing = fakeDb([{ race_date: DATE, status: 'draft', updated_at: ago(10 * 60 * 1000), x_post_text: '本文' }]);
  const c2 = await claimDataLabGeneration(existing.client, DATE, { now: NOW });
  await releaseDataLabClaim(existing.client, c2);
  assert.deepEqual([existing.table.length, existing.table[0].status, existing.table[0].x_post_text], [1, 'draft', '本文']);

  // 取れなかった要求の後始末は何もしない
  const other = fakeDb([{ race_date: DATE, status: 'generating', updated_at: ago(1000) }]);
  await releaseDataLabClaim(other.client, { ok: false, reason: 'busy' });
  assert.equal(other.table[0].status, 'generating');
});
