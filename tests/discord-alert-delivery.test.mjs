import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CLAIM_TTL_MS, MAX_ATTEMPTS, SEND_MARGIN_MS, claimDelivery, classifySendError, deliverOnce, finishedDeliveryKeys, isDeliverable, parseDeliveryState } from '../app/lib/discordAlertDelivery.js';

// bs_discord_notification_deliveries だけを持つ、メモリ上の Supabase クライアントの代用。
// 一意キー (alert_type, alert_id, channel_key) と、条件付き UPDATE を本物と同じ意味で再現する。
// 各操作の前に await を挟み、並行して呼んだ処理が交互に進むようにする。
function fakeDb(initial = []) {
  const rows = initial.map((row, i) => ({ id: i + 1, sent_at: null, error: null, discord_message_id: null, updated_at: new Date(0).toISOString(), ...row }));
  let nextId = rows.length + 1;
  const failures = []; // [{ op, when(state) }] … 該当する操作を1回だけ DB エラーにする
  const tick = () => new Promise((resolve) => setImmediate(resolve));
  const from = () => {
    const state = { op: 'select', filters: [], patch: null, row: null, opts: null, wantRows: false, single: false };
    const match = (row) => state.filters.every(([kind, col, val]) => (kind === 'is' ? row[col] == null : kind === 'in' ? val.map(String).includes(String(row[col])) : String(row[col]) === String(val)));
    const run = async () => {
      await tick();
      const failure = failures.findIndex((f) => f.op === state.op && (!f.when || f.when(state)));
      if (failure >= 0) { failures.splice(failure, 1); return { data: null, error: { message: `injected ${state.op} failure` } }; }
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
      in(col, vals) { state.filters.push(['in', col, vals]); return builder; },
      maybeSingle() { state.single = true; return run(); },
      then(resolve, reject) { return run().then(resolve, reject); },
    };
    return builder;
  };
  return { rows, from, failNext: (op, when) => failures.push({ op, when }) };
}

const NOW = new Date('2026-10-29T03:00:00Z'); // JST 10/29 12:00
const key = { alertType: 'kiina_double_top', alertId: 101, channelKey: 'DISCORD_KIINA_CHANNEL_ID' };

test('締切前の当日分だけ送る。締切後・別の日は送らない。締切が無いものは検出15分以内だけ', () => {
  const base = { race_date: '2026-10-29', detected_at: '2026-10-29T02:55:00Z' };
  assert.equal(isDeliverable({ ...base, closing_time: '12:30:00' }, NOW), true);
  // 締切の30秒前を切ったら送らない（届くまでの遅れを見込む）
  assert.equal(isDeliverable({ ...base, closing_time: '12:00:31' }, NOW), true);
  assert.equal(isDeliverable({ ...base, closing_time: '12:00:20' }, NOW), false);
  assert.equal(SEND_MARGIN_MS, 30_000);
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
  assert.deepEqual(await deliverOnce(db, { ...key, send, now: NOW }), { sent: true, attempt: 1, recorded: true });
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
  const send = async () => { calls += 1; throw new Error('Discord Webhook failed: 500'); };
  await deliverOnce(db, { ...key, send, now: NOW });
  await deliverOnce(db, { ...key, send, now: NOW });
  assert.equal((await deliverOnce(db, { ...key, send, now: NOW })).reason, 'exhausted');
  assert.equal(calls, 2);
});

test('処理中の印は期限内なら他の実行は触らない。期限切れは「結果不明」として二度と送らない', async () => {
  const claimedAt = new Date(NOW.getTime() - 10_000).toISOString();
  const db = fakeDb([{ alert_type: key.alertType, alert_id: key.alertId, channel_key: key.channelKey, error: 'claim:other:1', updated_at: claimedAt }]);
  assert.deepEqual(await claimDelivery(db, { ...key, now: NOW }), { skip: 'in_progress' });
  const later = new Date(NOW.getTime() + CLAIM_TTL_MS);
  assert.deepEqual(await claimDelivery(db, { ...key, now: later, token: 'mine' }), { skip: 'unknown_outcome' });
  assert.equal(db.rows[0].error, 'claim:other:1');
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

test('discord-alerts route：送信前に判定と配信の権利の取得を行い、当日分だけを読む。キャラ別通知先とロールを維持する', () => {
  const route = readFileSync('app/api/cron/discord-alerts/route.js', 'utf8');
  assert.match(route, /import \{ deliverOnce, finishedDeliveryKeys, isDeliverable \} from "\.\.\/\.\.\/\.\.\/lib\/discordAlertDelivery"/);
  assert.match(route, /if\(isDeliverable\(rawAlert\)\)return true;/);
  assert.match(route, /return deliverOnce\(admin,\{/);
  assert.doesNotMatch(route, /alreadySent/);
  assert.doesNotMatch(route, /upsert\(\{alert_type/); // 送信後の上書き upsert は使わない
  assert.match(route, /\.from\(source\.table\)\.select\(source\.select\)\.eq\("race_date",raceDate\)/);
  assert.match(route, /const targets=\[\[source\.channel,process\.env\[source\.channel\],roles\[source\.roleKey\]\]\];/);
  for (const channel of ['DISCORD_KIINA_CHANNEL_ID', 'DISCORD_ICHIKA_CHANNEL_ID', 'DISCORD_HATSUNE_CHANNEL_ID']) assert.match(route, new RegExp(channel));
  assert.match(route, /DISCORD_ADMIN_ALERTS_CHANNEL_ID/);
});

test('送信の失敗の分類：429・5xx は再送、4xx は恒久的な拒否、応答なし（通信断・タイムアウト）は結果不明', () => {
  assert.equal(classifySendError(new Error('Discord Webhook failed: 429 {"retry_after":1}')), 'retry');
  assert.equal(classifySendError(new Error('Discord Webhook failed: 502 bad gateway')), 'retry');
  assert.equal(classifySendError(Object.assign(new Error('Discordのアクセス制限中です。'), { status: 429 })), 'retry');
  assert.equal(classifySendError(new Error('Discord API failed: 403 Missing Access')), 'final');
  assert.equal(classifySendError(new Error('Discord Webhook failed: 404 Unknown Webhook')), 'final');
  assert.equal(classifySendError(new TypeError('fetch failed')), 'unknown');
  assert.equal(classifySendError(Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' })), 'unknown');
});

test('応答が無い失敗（届いた可能性がある）は再送しない', async () => {
  const db = fakeDb();
  let calls = 0;
  const send = async () => { calls += 1; throw new TypeError('fetch failed'); };
  const first = await deliverOnce(db, { ...key, send, now: NOW });
  assert.equal(first.kind, 'unknown');
  assert.match(db.rows[0].error, /^final=unknown; fetch failed/);
  assert.deepEqual(await deliverOnce(db, { ...key, send, now: NOW }), { skipped: true, reason: 'final' });
  assert.equal(calls, 1);
});

test('恒久的な拒否（403 など）は1回で打ち切る', async () => {
  const db = fakeDb();
  let calls = 0;
  const send = async () => { calls += 1; throw new Error('Discord Webhook failed: 403 Missing Permissions'); };
  await deliverOnce(db, { ...key, send, now: NOW });
  assert.match(db.rows[0].error, /^final=rejected; /);
  assert.equal((await deliverOnce(db, { ...key, send, now: NOW })).reason, 'final');
  assert.equal(calls, 1);
});

test('送信は成功したが記録に失敗した場合：その後は期限内も期限後も再送しない（重複より取りこぼしを選ぶ）', async () => {
  const db = fakeDb();
  let calls = 0;
  const send = async () => { calls += 1; return { id: 'm1' }; };
  db.failNext('update', (st) => 'sent_at' in (st.patch || {}));
  const result = await deliverOnce(db, { ...key, send, now: NOW });
  assert.deepEqual(result, { sent: true, attempt: 1, recorded: false });
  assert.match(db.rows[0].error, /^claim:/); // 送信中の印が残る
  assert.deepEqual(await deliverOnce(db, { ...key, send, now: NOW }), { skipped: true, reason: 'in_progress' });
  const later = new Date(NOW.getTime() + CLAIM_TTL_MS + 1000);
  assert.deepEqual(await deliverOnce(db, { ...key, send, now: later }), { skipped: true, reason: 'unknown_outcome' });
  assert.equal(calls, 1);
});

test('権利の取得で DB エラー：送らず、例外も投げず、回数にも数えない（次の実行で取り直す）', async () => {
  const db = fakeDb();
  let calls = 0;
  const send = async () => { calls += 1; return { id: 'm' }; };
  db.failNext('upsert');
  const failed = await deliverOnce(db, { ...key, send, now: NOW });
  assert.equal(failed.sent, false);
  assert.match(failed.error, /^claim_failed: injected upsert failure/);
  assert.equal(calls, 0);
  assert.equal(db.rows.length, 0);
  // 再送時の条件付き UPDATE の失敗も同じ
  const retryDb = fakeDb([{ alert_type: key.alertType, alert_id: key.alertId, channel_key: key.channelKey, error: 'attempt=1; Discord Webhook failed: 500', updated_at: '2026-10-29T02:58:00.000Z' }]);
  retryDb.failNext('update');
  assert.match((await deliverOnce(retryDb, { ...key, send, now: NOW })).error, /^claim_failed/);
  assert.equal(retryDb.rows[0].error, 'attempt=1; Discord Webhook failed: 500');
  assert.equal(calls, 0);
  // 次の実行では送れる
  assert.equal((await deliverOnce(retryDb, { ...key, send, now: NOW })).sent, true);
  assert.equal(calls, 1);
});

test('判定後、送る直前に締切を過ぎていたら送らず、以後も送らない', async () => {
  const db = fakeDb();
  let calls = 0;
  const send = async () => { calls += 1; return { id: 'm' }; };
  const alert = { race_date: '2026-10-29', closing_time: '12:01:00' };
  assert.equal(isDeliverable(alert, NOW), true); // 判定の時点では送れる
  const atSend = new Date(NOW.getTime() + 40_000); // 予想の計算などで40秒たった
  const result = await deliverOnce(db, { ...key, send, now: NOW, stillDeliverable: () => isDeliverable(alert, atSend) });
  assert.deepEqual(result, { skipped: true, reason: 'expired' });
  assert.match(db.rows[0].error, /^final=expired/);
  assert.equal((await deliverOnce(db, { ...key, send, now: NOW })).reason, 'final');
  assert.equal(calls, 0);
});

test('先読み：送信済み・確定・結果不明・上限到達だけを「完了」とし、取得に失敗したら空集合', async () => {
  const t = key.alertType;
  const db = fakeDb([
    { alert_type: t, alert_id: 1, channel_key: 'all', sent_at: NOW.toISOString() },
    { alert_type: t, alert_id: 2, channel_key: 'all', error: 'final=expired; x' },
    { alert_type: t, alert_id: 3, channel_key: 'all', error: 'claim:a:1', updated_at: new Date(NOW.getTime() - CLAIM_TTL_MS - 1).toISOString() },
    { alert_type: t, alert_id: 4, channel_key: 'all', error: 'attempt=3; Discord Webhook failed: 500' },
    { alert_type: t, alert_id: 5, channel_key: 'all', error: 'attempt=1; Discord Webhook failed: 500' },
    { alert_type: t, alert_id: 6, channel_key: 'all', error: 'claim:a:1', updated_at: NOW.toISOString() },
    { alert_type: 'other', alert_id: 7, channel_key: 'all', sent_at: NOW.toISOString() },
  ]);
  const keys = await finishedDeliveryKeys(db, t, [1, 2, 3, 4, 5, 6, 7], NOW);
  assert.deepEqual([...keys].sort(), ['1:all', '2:all', '3:all', '4:all']);
  db.failNext('select');
  assert.equal((await finishedDeliveryKeys(db, t, [1], NOW)).size, 0);
});

test('discord-alerts route：送信直前の再判定・時間の予算・Webhook のタイムアウト', () => {
  const route = readFileSync('app/api/cron/discord-alerts/route.js', 'utf8');
  assert.match(route, /stillDeliverable:source\.type===QUALITY_SOURCE\.type\?\(\)=>true:\(\)=>isDeliverable\(alert\)/);
  assert.match(route, /signal:AbortSignal\.timeout\(WEBHOOK_TIMEOUT_MS\)/);
  assert.match(route, /const RUN_BUDGET_MS=18_000;/);
  assert.match(route, /if\(outOfTime\(\)\)\{summary\.deferred\+=1;continue;\}/);
  assert.match(route, /export const maxDuration=30;/);
  assert.match(route, /finishedDeliveryKeys\(admin,source\.type,deliverable\.map\(a=>a\.id\)\)/);
});

test('管理者向けデータ欠損通知：Bot のメッセージで管理者チャンネルへ送る。明示された管理者チャンネルが無ければ送らない', () => {
  const route = readFileSync('app/api/cron/discord-alerts/route.js', 'utf8');
  // キャラ用 Webhook（キャラ設定が必要）ではなく、Bot のメッセージで送る
  assert.match(route, /const targetKeys=\[source\.channel\]/);
  assert.doesNotMatch(route, /const targets=\[\["all"/);
  assert.match(route, /: sendDiscordMessage\(channelId,source\.build\(alert\),\{roleId\}\)/);
  // 管理者向けは明示された管理者チャンネルにのみ送る
  assert.match(route, /const adminChannel=process\.env\.DISCORD_ADMIN_ALERTS_CHANNEL_ID;\n\s*if\(adminChannel&&String\(adminChannel\)!==String\(allChannel\|\|""\)\)\{/);
  assert.doesNotMatch(route, /DISCORD_ADMIN_ALERTS_CHANNEL_ID\|\|allChannel/);
  // メンションなし（ロールは渡さない）
  assert.match(route, /deliver\(admin,QUALITY_SOURCE,alert,"admin",adminChannel,null\)/);
  // 会員向けのアラートを先に処理し、管理者向けはその後（時間の予算を会員向けに優先して使う）
  assert.ok(route.indexOf('for(const source of SOURCES)') < route.indexOf('from("bs_race_data_quality_alerts")'));
});

test('管理者向けデータ欠損通知：翌日に前日の日付で作られるため、前日分と当日分だけを読む（それより古いものは読まない）', () => {
  const route = readFileSync('app/api/cron/discord-alerts/route.js', 'utf8');
  const quality = route.slice(route.indexOf('from("bs_race_data_quality_alerts")'));
  assert.match(quality, /\.gte\("race_date",jstYesterday\(\)\)\s*\.lte\("race_date",raceDate\)/);
  assert.doesNotMatch(quality.slice(0, 400), /\.eq\("race_date",raceDate\)/);
  // 会員向けのアラートは従来どおり当日分だけ
  assert.match(route, /\.from\(source\.table\)\.select\(source\.select\)\.eq\("race_date",raceDate\)/);
  // 前日の計算は JST
  assert.match(route, /function jstYesterday\(\)\{return new Intl\.DateTimeFormat\("en-CA",\{timeZone:"Asia\/Tokyo"/);
});


test('DiscordがメッセージIDを返さない場合は成功扱いせず再送もしない', async () => {
  const db = fakeDb();
  let sends = 0;
  const send = async () => { sends++; return null; };
  const first = await deliverOnce(db, { ...key, alertId: 987654, send });
  assert.equal(first.sent, false);
  assert.equal(first.kind, 'unknown');
  assert.equal(db.rows[0].sent_at, null);
  assert.match(db.rows[0].error, /^final=unknown;/);
  const second = await deliverOnce(db, { ...key, alertId: 987654, send });
  assert.equal(second.skipped, true);
  assert.equal(sends, 1);
});

test('全体通知は送信対象から除外しキャラ別Webhook送信は維持する', () => {
  const route = readFileSync(new URL('../app/api/cron/discord-alerts/route.js', import.meta.url), 'utf8');
  assert.match(route, /channelKey==="all" \? discordApi\(/);
  assert.match(route, /logWebhookStage\("lookup"/);
  assert.match(route, /logWebhookStage\("create"/);
  assert.match(route, /logWebhookStage\("send"/);
});
