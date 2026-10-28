import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CLAIM_TTL_MS, MAX_ATTEMPTS, claimDelivery, deliverOnce, isDeliverable, parseDeliveryState } from '../app/lib/discordAlertDelivery.js';

// bs_discord_notification_deliveries だけを持つ、メモリ上の Supabase クライアントの代用。
// 一意キー (alert_type, alert_id, channel_key) と、条件付き UPDATE を本物と同じ意味で再現する。
// 各操作の前に await を挟み、並行して呼んだ処理が交互に進むようにする。
function fakeDb(initial = []) {
  const rows = initial.map((row, i) => ({ id: i + 1, sent_at: null, error: null, discord_message_id: null, updated_at: new Date(0).toISOString(), ...row }));
  let nextId = rows.length + 1;
  const tick = () => new Promise((resolve) => setImmediate(resolve));
  const from = () => {
    const state = { op: 'select', filters: [], patch: null, row: null, opts: null, wantRows: false, single: false };
    const match = (row) => state.filters.every(([kind, col, val]) => (kind === 'is' ? row[col] == null : String(row[col]) === String(val)));
    const run = async () => {
      await tick();
      if (state.op === 'upsert') {
        const dup = rows.find((r) => r.alert_type === state.row.alert_type && r.alert_id === state.row.alert_id && r.channel_key === state.row.channel_key);
        if (dup) return { data: [], error: null };
        const created = { id: nextId++, sent_at: null, discord_message_id: null, ...state.row };
        rows.push(created);
        return { data: [{ id: created.id }], error: null };
      }
      if (state.op === 'update') {
        const hit = rows.filter(match);
        hit.forEach((row) => Object.assign(row, state.patch));
        return { data: state.wantRows ? hit.map((r) => ({ id: r.id })) : null, error: null };
      }
      const hit = rows.filter(match).map((r) => ({ ...r }));
      return { data: state.single ? hit[0] || null : hit, error: null };
    };
    const builder = {
      upsert(row, opts) { state.op = 'upsert'; state.row = row; state.opts = opts; assert.equal(opts.ignoreDuplicates, true); return builder; },
      update(patch) { state.op = 'update'; state.patch = patch; return builder; },
      select() { state.wantRows = true; return builder; },
      eq(col, val) { state.filters.push(['eq', col, val]); return builder; },
      is(col) { state.filters.push(['is', col]); return builder; },
      maybeSingle() { state.single = true; return run(); },
      then(resolve, reject) { return run().then(resolve, reject); },
    };
    return builder;
  };
  return { rows, from };
}

const NOW = new Date('2026-10-29T03:00:00Z'); // JST 10/29 12:00
const key = { alertType: 'kiina_double_top', alertId: 101, channelKey: 'DISCORD_KIINA_CHANNEL_ID' };

test('締切前の当日分だけ送る。締切後・別の日は送らない。締切が無いものは検出15分以内だけ', () => {
  const base = { race_date: '2026-10-29', detected_at: '2026-10-29T02:55:00Z' };
  assert.equal(isDeliverable({ ...base, closing_time: '12:30:00' }, NOW), true);
  assert.equal(isDeliverable({ ...base, closing_time: '12:00:00' }, NOW), false); // ちょうど締切
  assert.equal(isDeliverable({ ...base, closing_time: '11:59' }, NOW), false);
  assert.equal(isDeliverable({ ...base, race_date: '2026-10-28', closing_time: '23:59:00' }, NOW), false);
  assert.equal(isDeliverable({ ...base, race_date: '2026-10-30', closing_time: '12:30:00' }, NOW), false);
  assert.equal(isDeliverable({ ...base, closing_time: null }, NOW), true);
  assert.equal(isDeliverable({ ...base, closing_time: null, detected_at: '2026-10-29T02:40:00Z' }, NOW), false);
  assert.equal(isDeliverable({ ...base, closing_time: null, detected_at: null }, NOW), false);
  // JST の日付で判断する（UTC では前日の 10/28 15:30 ＝ JST 10/29 00:30）
  assert.equal(isDeliverable({ race_date: '2026-10-29', closing_time: '10:00:00' }, new Date('2026-10-28T15:30:00Z')), true);
});

test('停止中に溜まった過去の未送信114件は、1件も送らない', () => {
  const backlog = Array.from({ length: 114 }, (_, i) => ({ id: i + 1, race_date: ['2026-10-26', '2026-10-27', '2026-10-28'][i % 3], closing_time: '20:00:00', detected_at: '2026-10-26T10:00:00Z' }));
  assert.equal(backlog.filter((alert) => isDeliverable(alert, NOW)).length, 0);
  // 当日でも、再開時点で締切を過ぎているものは送らない
  const todayClosed = { race_date: '2026-10-29', closing_time: '10:15:00', detected_at: '2026-10-29T01:00:00Z' };
  assert.equal(isDeliverable(todayClosed, NOW), false);
});

test('1回目は送って記録する。2回目以降は送らない', async () => {
  const db = fakeDb();
  let sends = 0;
  const send = async () => { sends += 1; return { id: 'm1' }; };
  assert.deepEqual(await deliverOnce(db, { ...key, send, now: NOW }), { sent: true, attempt: 1 });
  assert.deepEqual(await deliverOnce(db, { ...key, send, now: NOW }), { skipped: true, reason: 'sent' });
  assert.equal(sends, 1);
  assert.equal(db.rows.length, 1);
  assert.equal(db.rows[0].discord_message_id, 'm1');
  assert.equal(db.rows[0].error, null);
  assert.ok(db.rows[0].sent_at);
});

test('同時に5本動いても1回だけ送る（初回・再送の両方）', async () => {
  const db = fakeDb();
  let sends = 0;
  const send = async () => { sends += 1; await new Promise((r) => setTimeout(r, 20)); return { id: 'm' }; };
  const results = await Promise.all(Array.from({ length: 5 }, (_, i) => deliverOnce(db, { ...key, send, now: NOW, token: `t${i}` })));
  assert.equal(sends, 1);
  assert.equal(results.filter((r) => r.sent).length, 1);
  assert.equal(db.rows.length, 1);

  // 1回失敗した後の再送でも、同時に動いた中で1本だけが送る
  const failedDb = fakeDb([{ ...{ alert_type: key.alertType, alert_id: key.alertId, channel_key: key.channelKey }, error: 'attempt=1; Discord Webhook failed: 500', updated_at: '2026-10-29T02:58:00.000Z' }]);
  let retrySends = 0;
  const retry = async () => { retrySends += 1; await new Promise((r) => setTimeout(r, 20)); return { id: 'r' }; };
  await Promise.all(Array.from({ length: 5 }, (_, i) => deliverOnce(failedDb, { ...key, send: retry, now: NOW, token: `r${i}` })));
  assert.equal(retrySends, 1);
  assert.ok(failedDb.rows[0].sent_at);
});

test(`失敗は最大${MAX_ATTEMPTS}回まで。それ以降は送らない`, async () => {
  const db = fakeDb();
  let calls = 0;
  const send = async () => { calls += 1; throw new Error('Discord Webhook failed: 503'); };
  for (let i = 1; i <= MAX_ATTEMPTS; i += 1) {
    const result = await deliverOnce(db, { ...key, send, now: NOW });
    assert.equal(result.sent, false);
    assert.equal(result.attempt, i);
    assert.match(db.rows[0].error, new RegExp(`^attempt=${i}; Discord Webhook failed: 503`));
  }
  assert.deepEqual(await deliverOnce(db, { ...key, send, now: NOW }), { skipped: true, reason: 'exhausted' });
  assert.equal(calls, MAX_ATTEMPTS);
  assert.equal(db.rows[0].sent_at, null);
});

test('変更前の形式の失敗は1回失敗として扱い、残り2回まで再送する', async () => {
  const db = fakeDb([{ alert_type: key.alertType, alert_id: key.alertId, channel_key: key.channelKey, error: 'Discord Webhook failed: 500 old', updated_at: '2026-10-25T10:00:00.000Z' }]);
  assert.equal(parseDeliveryState(db.rows[0], NOW).attempts, 1);
  let calls = 0;
  const send = async () => { calls += 1; throw new Error('x'); };
  await deliverOnce(db, { ...key, send, now: NOW });
  await deliverOnce(db, { ...key, send, now: NOW });
  assert.equal((await deliverOnce(db, { ...key, send, now: NOW })).reason, 'exhausted');
  assert.equal(calls, 2);
});

test('処理中の印は期限内なら他の実行は触らない。期限切れなら失敗1回として再送できる', async () => {
  const claimedAt = new Date(NOW.getTime() - 10_000).toISOString();
  const db = fakeDb([{ alert_type: key.alertType, alert_id: key.alertId, channel_key: key.channelKey, error: 'claim:other:1', updated_at: claimedAt }]);
  assert.deepEqual(await claimDelivery(db, { ...key, now: NOW }), { skip: 'in_progress' });
  const later = new Date(NOW.getTime() + CLAIM_TTL_MS);
  const claimed = await claimDelivery(db, { ...key, now: later, token: 'mine' });
  assert.deepEqual(claimed, { id: 1, claim: 'claim:mine:2', attempt: 2 });
});

test('送信済みの行は、失敗の記録で上書きしない（処理中の印が一致する場合だけ更新）', async () => {
  const db = fakeDb();
  const sentAt = NOW.toISOString();
  // 送信中に、別の実行（期限切れ後に権利を取り直したもの）が送信済みにした場合
  const send = async () => { Object.assign(db.rows[0], { sent_at: sentAt, error: null, discord_message_id: 'other' }); throw new Error('late failure'); };
  const result = await deliverOnce(db, { ...key, send, now: NOW, token: 'a' });
  assert.equal(result.sent, false);
  assert.equal(db.rows[0].error, null);
  assert.equal(db.rows[0].sent_at, sentAt);
  assert.equal(db.rows[0].discord_message_id, 'other');
});

test('discord-alerts route：送信前に判定と配信の権利の取得を行い、当日分だけを読む。通知先とロールは変えない', () => {
  const route = readFileSync('app/api/cron/discord-alerts/route.js', 'utf8');
  assert.match(route, /import \{ deliverOnce, isDeliverable \} from "\.\.\/\.\.\/\.\.\/lib\/discordAlertDelivery"/);
  assert.match(route, /if\(!isDeliverable\(rawAlert\)\)\{summary\.expired\+=1;continue;\}/);
  assert.match(route, /return deliverOnce\(admin,\{/);
  assert.doesNotMatch(route, /alreadySent/);
  assert.doesNotMatch(route, /upsert\(\{alert_type/); // 送信後の上書き upsert は使わない
  assert.match(route, /\.from\(source\.table\)\.select\(source\.select\)\.eq\("race_date",raceDate\)/);
  assert.match(route, /const targets=\[\["all",allChannel,roles\.all_alerts\],\[source\.channel,process\.env\[source\.channel\],roles\[source\.roleKey\]\]\];/);
  for (const channel of ['DISCORD_KIINA_CHANNEL_ID', 'DISCORD_ICHIKA_CHANNEL_ID', 'DISCORD_HATSUNE_CHANNEL_ID']) assert.match(route, new RegExp(channel));
  assert.match(route, /DISCORD_ADMIN_ALERTS_CHANNEL_ID/);
});
