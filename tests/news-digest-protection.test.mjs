import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { createClient } from './fixtures/supabase-fake.mjs';
import { saveDailyResultArticle, saveDailyResultDigestRow } from '../lib/dailyResultArticleWriter.js';
import { isAiRewriteTarget, isDailyResultSourceKey, dailyResultProtectionReason } from '../lib/newsRewritePolicy.js';

// 以降の動的 import では @supabase/supabase-js を偽クライアントに差し替える
register('./fixtures/supabase-fake-hooks.mjs', import.meta.url);
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://fake.invalid';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'fake';
process.env.OPENAI_API_KEY = 'fake';
const { generateDailyResultDigest } = await import('../lib/dailyResultDigest.js');
const { generatePendingHatsuneArticles, generateAndSaveHatsuneArticle } = await import('../lib/hatsuneNewsAi.js');

const OLD = '2026-10-15T14:10:36.976Z';
const NOW = '2026-10-21T14:10:00.000Z';
const KEY = 'bs-daily-result-2026-10-15';
const content = { title: '新タイトル', list_headline: '新見出し', summary: '新要約', article_body: '新本文', category: 'result', source_type: 'bs_data', source_name: 's', source_url: 'u', place: null, is_featured: false, priority: 6 };

function reset(newsRows = [], extra = {}) {
  globalThis.__supabaseFake = { tables: { hatsune_news: newsRows.map((r) => ({ ...r })), ...extra }, hooks: {}, writes: [] };
  return globalThis.__supabaseFake;
}
const article = (over = {}) => ({ id: 1967, source_key: KEY, title: '旧', list_headline: '旧', summary: '旧', article_body: '旧本文', article_body_source: 'bs_data_template', is_published: true, published_at: OLD, updated_at: OLD, ...over });
const row = (s, id) => s.tables.hatsune_news.find((r) => r.id === id);
const newsWrites = (s) => s.writes.filter((w) => w.table === 'hatsune_news');

test('新規日付：従来どおり公開状態で作成する', async () => {
  const s = reset();
  const r = await saveDailyResultArticle(createClient(), { sourceKey: KEY, content, now: NOW });
  assert.equal(r.action, 'inserted');
  const a = row(s, r.id);
  assert.equal(a.is_published, true);
  assert.equal(a.published_at, NOW);
  assert.equal(a.article_body_source, 'bs_data_template');
  assert.equal(a.article_body, '新本文');
});

test('既存の公開記事：内容は更新するが published_at と公開状態は維持する', async () => {
  const s = reset([article()]);
  const r = await saveDailyResultArticle(createClient(), { sourceKey: KEY, content, now: NOW });
  assert.equal(r.action, 'updated');
  const a = row(s, 1967);
  assert.equal(a.article_body, '新本文');
  assert.equal(a.published_at, OLD);
  assert.equal(a.is_published, true);
  assert.equal(a.updated_at, NOW);
  const w = newsWrites(s)[0];
  assert.equal('published_at' in w.payload, false);
  assert.equal('is_published' in w.payload, false);
});

test('manual 記事：再生成で上書きせず、article_body_source も変えない', async () => {
  const s = reset([article({ article_body_source: 'manual', article_body: '訂正済み本文' })]);
  const r = await saveDailyResultArticle(createClient(), { sourceKey: KEY, content, now: NOW });
  assert.deepEqual([r.action, r.reason, r.id], ['skipped', 'manual', 1967]);
  assert.deepEqual(row(s, 1967), article({ article_body_source: 'manual', article_body: '訂正済み本文' }));
  assert.equal(newsWrites(s).length, 0);
});

test('非公開記事：再生成で再公開せず、内容も変えない（記事1967）', async () => {
  const s = reset([article({ is_published: false })]);
  const r = await saveDailyResultArticle(createClient(), { sourceKey: KEY, content, now: NOW });
  assert.deepEqual([r.action, r.reason], ['skipped', 'unpublished']);
  assert.deepEqual(row(s, 1967), article({ is_published: false }));
  assert.equal(newsWrites(s).length, 0);
});

test('非公開かつ manual の記事も書き換えない', async () => {
  const s = reset([article({ is_published: false, article_body_source: 'manual' })]);
  const r = await saveDailyResultArticle(createClient(), { sourceKey: KEY, content, now: NOW });
  assert.equal(r.action, 'skipped');
  assert.equal(row(s, 1967).is_published, false);
  assert.equal(row(s, 1967).article_body_source, 'manual');
});

test('B：AI 本文の日次まとめ（公開中）は再生成で上書きせず、公開状態・公開日時も変えない', async () => {
  const s = reset([article({ id: 926, article_body_source: 'ai', article_body: 'AI本文' })]);
  const r = await saveDailyResultArticle(createClient(), { sourceKey: KEY, content, now: NOW });
  assert.deepEqual([r.action, r.reason, r.id], ['skipped', 'ai', 926]);
  assert.deepEqual(row(s, 926), article({ id: 926, article_body_source: 'ai', article_body: 'AI本文' }));
  assert.equal(newsWrites(s).length, 0);
});

test('B：未知の article_body_source の記事も保護側に倒す', async () => {
  const s = reset([article({ article_body_source: 'something_new' })]);
  const r = await saveDailyResultArticle(createClient(), { sourceKey: KEY, content, now: NOW });
  assert.deepEqual([r.action, r.reason], ['skipped', 'protected_source']);
  assert.equal(newsWrites(s).length, 0);
});

test('B：公開中の template 記事は従来どおり更新でき、article_body_source が NULL の記事は保護側に倒す', async () => {
  const s = reset([article({ article_body_source: 'template' })]);
  const r = await saveDailyResultArticle(createClient(), { sourceKey: KEY, content, now: NOW });
  assert.equal(r.action, 'updated');
  assert.equal(row(s, 1967).article_body_source, 'bs_data_template');
  assert.equal(row(s, 1967).published_at, OLD);
  const s2 = reset([article({ article_body_source: null })]);
  const r2 = await saveDailyResultArticle(createClient(), { sourceKey: KEY, content, now: NOW });
  assert.deepEqual([r2.action, r2.reason], ['skipped', 'protected_source']);
  assert.equal(newsWrites(s2).length, 0);
});

test('B 競合：読み取り後に AI 本文へ変わったら、更新の条件で弾いて上書きしない', async () => {
  const s = reset([article()]);
  let once = true;
  s.hooks.beforeUpdate = ({ tables }) => {
    if (once) { once = false; Object.assign(tables.hatsune_news[0], { article_body_source: 'ai', article_body: 'AI本文' }); }
  };
  const r = await saveDailyResultArticle(createClient(), { sourceKey: KEY, content, now: NOW });
  assert.deepEqual([r.action, r.reason], ['skipped', 'ai']);
  assert.equal(row(s, 1967).article_body, 'AI本文');
  assert.equal(row(s, 1967).published_at, OLD);
});

test('競合：読み取り後に manual 化されたら、更新の条件で弾いて上書きしない', async () => {
  const s = reset([article()]);
  let once = true;
  s.hooks.beforeUpdate = ({ tables }) => {
    if (once) { once = false; Object.assign(tables.hatsune_news[0], { article_body_source: 'manual', article_body: '人が直した本文' }); }
  };
  const r = await saveDailyResultArticle(createClient(), { sourceKey: KEY, content, now: NOW });
  assert.deepEqual([r.action, r.reason], ['skipped', 'manual']);
  assert.equal(row(s, 1967).article_body, '人が直した本文');
  assert.equal(row(s, 1967).article_body_source, 'manual');
});

test('競合：読み取り後に非公開化されたら、再公開も上書きもしない', async () => {
  const s = reset([article()]);
  let once = true;
  s.hooks.beforeUpdate = ({ tables }) => { if (once) { once = false; tables.hatsune_news[0].is_published = false; } };
  const r = await saveDailyResultArticle(createClient(), { sourceKey: KEY, content, now: NOW });
  assert.deepEqual([r.action, r.reason], ['skipped', 'unpublished']);
  assert.equal(row(s, 1967).is_published, false);
  assert.equal(row(s, 1967).article_body, '旧本文');
});

test('競合：同じ日付の記事が同時に作られたら、一意制約エラーから既存記事として扱い直す', async () => {
  const s = reset();
  let once = true;
  s.hooks.beforeInsert = () => { if (once) { once = false; s.tables.hatsune_news.push(article({ id: 2001, published_at: OLD })); } };
  const r = await saveDailyResultArticle(createClient(), { sourceKey: KEY, content, now: NOW });
  assert.deepEqual([r.action, r.id], ['updated', 2001]);
  assert.equal(s.tables.hatsune_news.length, 1);
  assert.equal(row(s, 2001).published_at, OLD);
});

test('競合：同時に作られた記事が非公開なら、そのまま残す', async () => {
  const s = reset();
  let once = true;
  s.hooks.beforeInsert = () => { if (once) { once = false; s.tables.hatsune_news.push(article({ id: 2002, is_published: false })); } };
  const r = await saveDailyResultArticle(createClient(), { sourceKey: KEY, content, now: NOW });
  assert.deepEqual([r.action, r.reason], ['skipped', 'unpublished']);
  assert.equal(row(s, 2002).is_published, false);
});

test('保護判定と AI リライト対象の判定', () => {
  assert.equal(dailyResultProtectionReason(article({ article_body_source: 'manual' })), 'manual');
  assert.equal(dailyResultProtectionReason(article({ is_published: false })), 'unpublished');
  assert.equal(dailyResultProtectionReason(article({ is_published: null })), 'unpublished');
  assert.equal(dailyResultProtectionReason(article()), null);
  assert.equal(dailyResultProtectionReason(article({ article_body_source: 'template' })), null);
  assert.equal(dailyResultProtectionReason(article({ article_body_source: null })), 'protected_source');
  assert.equal(dailyResultProtectionReason(article({ article_body_source: 'ai' })), 'ai');
  assert.equal(dailyResultProtectionReason(article({ article_body_source: 'ai', is_published: false })), 'ai');
  assert.equal(dailyResultProtectionReason(article({ article_body_source: 'something_new' })), 'protected_source');
  assert.equal(isDailyResultSourceKey('bs-daily-result-2026-10-15'), true);
  assert.equal(isDailyResultSourceKey('bs:result:2026-10-15:1:1'), false);
  assert.equal(isDailyResultSourceKey(null), false);
  assert.equal(isAiRewriteTarget({ source_key: KEY, article_body_source: 'bs_data_template' }), false);
  assert.equal(isAiRewriteTarget({ source_key: 'official:https://x', article_body_source: 'template' }), true);
  assert.equal(isAiRewriteTarget({ source_key: null, article_body_source: null }), true);
  assert.equal(isAiRewriteTarget({ source_key: 'general:a:b', article_body_source: 'manual' }), false);
  assert.equal(isAiRewriteTarget({ source_key: 'general:a:b', article_body_source: 'ai' }), false);
});

// ── generateDailyResultDigest（日付指定の再生成）を通した確認 ──
const DATE = '2026-10-15';
function raceTables() {
  const events = [1, 2].map((race_no) => ({ race_date: DATE, course_code: 1, course_name: '桐生', race_no, race_name: null, race_kind_code: '0001', trifecta: '123', trifecta_payout: 1000, result_available: true, race_cancel_code: null }));
  const entries = [1, 2].flatMap((race_no) => [1, 2, 3, 4, 5, 6].map((b) => ({ race_date: DATE, course_code: 1, race_no, boat_no: b, racer_name: `選手${b}`, arrival_order: b, result_code: `0${b}`, result_note: null })));
  const results = [1, 2].map((race_no) => ({ race_date: DATE, course_code: 1, race_no, winning_technique: '逃げ', winning_method: '逃げ', result_status: 'confirmed', race_status: 'finished' }));
  return { bs_race_events: events, bs_race_entries: entries, bs_race_results: results, bs_daily_result_digests: [], bs_news_sync_logs: [] };
}

test('日付指定の再生成：manual の記事1967は上書き・再公開されず、digest は更新される', async () => {
  const s = reset([article({ is_published: false, article_body_source: 'manual', article_body: '訂正済み本文' })], raceTables());
  const r = await generateDailyResultDigest({ date: DATE });
  assert.deepEqual([r.newsAction, r.newsSkipReason, r.newsId], ['skipped', 'manual', 1967]);
  assert.deepEqual(row(s, 1967), article({ is_published: false, article_body_source: 'manual', article_body: '訂正済み本文' }));
  assert.equal(newsWrites(s).length, 0);
  const digest = s.writes.find((w) => w.table === 'bs_daily_result_digests');
  assert.equal(digest.payload.news_id, 1967);
  const log = s.writes.find((w) => w.table === 'bs_news_sync_logs');
  assert.equal(log.row.details.news_action, 'skipped');
});

test('日付指定の再生成：既存の公開記事は本文だけ更新し、公開日時と公開状態を維持する', async () => {
  const s = reset([article()], raceTables());
  const r = await generateDailyResultDigest({ date: DATE });
  assert.equal(r.newsAction, 'updated');
  const a = row(s, 1967);
  assert.equal(a.published_at, OLD);
  assert.equal(a.is_published, true);
  assert.match(a.article_body, /逃げ決着：2R/);
});

test('新規日付の生成：従来どおり公開記事を作る', async () => {
  const s = reset([], raceTables());
  const r = await generateDailyResultDigest({ date: DATE });
  assert.equal(r.newsAction, 'inserted');
  const a = row(s, r.newsId);
  assert.equal(a.is_published, true);
  assert.equal(a.source_key, KEY);
  assert.equal(a.article_body_source, 'bs_data_template');
  assert.equal(s.tables.bs_daily_result_digests[0].news_id, r.newsId);
});

test('B 日付指定の再生成：AI 本文の公開記事は上書きされず、digest は既存記事を参照する', async () => {
  const s = reset([article({ id: 926, article_body_source: 'ai', article_body: 'AI本文' })], raceTables());
  const r = await generateDailyResultDigest({ date: DATE });
  assert.deepEqual([r.newsAction, r.newsSkipReason, r.newsId], ['skipped', 'ai', 926]);
  assert.deepEqual(row(s, 926), article({ id: 926, article_body_source: 'ai', article_body: 'AI本文' }));
  assert.equal(newsWrites(s).length, 0);
  assert.equal(s.tables.bs_daily_result_digests[0].news_id, 926);
});

// ── A：digest.news_id の保護 ──
const digest = (over = {}) => ({ id: 38, race_date: DATE, status: 'complete', race_count: 99, article_body: '旧集計', news_id: 1967, generated_at: OLD, updated_at: OLD, ...over });
const digestRow = { race_date: DATE, status: 'complete', race_count: 2, article_body: '新集計', generated_at: NOW, updated_at: NOW };
const digestWrites = (s) => s.writes.filter((w) => w.table === 'bs_daily_result_digests');

test('A：記事IDが取れたときは従来どおり upsert し、news_id を設定する', async () => {
  const s = reset([], { bs_daily_result_digests: [digest({ news_id: null })] });
  const r = await saveDailyResultDigestRow(createClient(), digestRow, 2001);
  assert.equal(r.action, 'upserted');
  assert.equal(s.tables.bs_daily_result_digests.length, 1);
  assert.equal(s.tables.bs_daily_result_digests[0].news_id, 2001);
  assert.equal(s.tables.bs_daily_result_digests[0].race_count, 2);
});

test('A 競合：記事IDが取れなくても既存 digest の news_id を null で上書きしない', async () => {
  const s = reset([], { bs_daily_result_digests: [digest()] });
  const r = await saveDailyResultDigestRow(createClient(), digestRow, null);
  assert.equal(r.action, 'updated_keep_news_id');
  const d = s.tables.bs_daily_result_digests[0];
  assert.equal(d.news_id, 1967);
  assert.equal(d.race_count, 2);
  assert.equal(d.article_body, '新集計');
  assert.equal(digestWrites(s).some((w) => 'news_id' in (w.payload || w.row || {})), false);
  assert.equal(digestWrites(s).some((w) => w.op === 'upsert'), false);
});

test('A 新規：記事IDが取れず digest もまだ無い日は、news_id なしで新規作成する', async () => {
  const s = reset([], { bs_daily_result_digests: [] });
  const r = await saveDailyResultDigestRow(createClient(), digestRow, null);
  assert.equal(r.action, 'inserted_without_news_id');
  assert.equal(s.tables.bs_daily_result_digests.length, 1);
  assert.equal(s.tables.bs_daily_result_digests[0].news_id ?? null, null);
});

test('A 競合：digest が同時に作られたら、一意制約エラーから UPDATE し直し news_id を残す', async () => {
  const s = reset([], { bs_daily_result_digests: [] });
  let once = true;
  s.hooks.beforeInsert = ({ table }) => {
    if (table === 'bs_daily_result_digests' && once) { once = false; s.tables.bs_daily_result_digests.push(digest()); }
  };
  const r = await saveDailyResultDigestRow(createClient(), digestRow, null);
  assert.equal(r.action, 'updated_keep_news_id');
  assert.equal(s.tables.bs_daily_result_digests.length, 1);
  assert.equal(s.tables.bs_daily_result_digests[0].news_id, 1967);
  assert.equal(s.tables.bs_daily_result_digests[0].race_count, 2);
});

test('A 日付指定の再生成：記事の更新が競合し続けても、digest の既存参照（news_id）を維持する', async () => {
  const s = reset([article()], { ...raceTables(), bs_daily_result_digests: [digest()] });
  // 毎回、UPDATE の直前に manual 化され、直後に戻る（3回とも更新できない）
  s.hooks.beforeUpdate = ({ table, tables }) => { if (table === 'hatsune_news') tables.hatsune_news[0].article_body_source = 'manual'; };
  s.hooks.afterUpdate = ({ table, tables }) => { if (table === 'hatsune_news') tables.hatsune_news[0].article_body_source = 'bs_data_template'; };
  const r = await generateDailyResultDigest({ date: DATE });
  assert.deepEqual([r.newsAction, r.newsSkipReason, r.newsId], ['skipped', 'concurrent_change', null]);
  assert.equal(row(s, 1967).article_body, '旧本文');
  const d = s.tables.bs_daily_result_digests[0];
  assert.equal(d.news_id, 1967);
  assert.equal(d.race_count, 2);
  const log = s.writes.find((w) => w.table === 'bs_news_sync_logs');
  assert.equal(log.row.details.digest_action, 'updated_keep_news_id');
});

test('A 日付指定の再生成：digest の既存参照は、記事を保護した場合も同じ記事IDのまま', async () => {
  const s = reset([article({ is_published: false })], { ...raceTables(), bs_daily_result_digests: [digest()] });
  const r = await generateDailyResultDigest({ date: DATE });
  assert.deepEqual([r.newsAction, r.newsSkipReason], ['skipped', 'unpublished']);
  assert.equal(s.tables.bs_daily_result_digests.length, 1);
  assert.equal(s.tables.bs_daily_result_digests[0].news_id, 1967);
});

// ── AI 本文リライト ──
function stubOpenAi() {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push(JSON.parse(init.body));
    return { ok: true, json: async () => ({ output_text: JSON.stringify({ summary: 'AI要約', article_body: 'AI本文' }) }) };
  };
  return calls;
}
const news = (id, over = {}) => ({ id, source_key: `official:https://example.com/${id}`, title: `記事${id}`, summary: '要約', category: 'topic', source_type: 'news', article_body: '本文', article_body_source: 'template', is_published: true, published_at: OLD, ...over });

test('AI リライト：日次結果まとめは対象外、通常 NEWS は従来どおり AI 生成される', async () => {
  const s = reset([
    news(1, { source_key: 'bs-daily-result-2026-10-16', article_body_source: 'bs_data_template' }),
    news(2),
    news(3, { article_body_source: 'manual' }),
    news(4, { article_body_source: 'ai' }),
    news(5, { source_key: null, article_body_source: null }),
  ]);
  const calls = stubOpenAi();
  const results = await generatePendingHatsuneArticles({ limit: 5 });
  assert.deepEqual(results.map((x) => x.id).sort(), [2, 5]);
  assert.equal(calls.length, 2);
  assert.equal(row(s, 2).article_body, 'AI本文');
  assert.equal(row(s, 2).article_body_source, 'ai');
  assert.equal(row(s, 5).article_body_source, 'ai');
  assert.equal(row(s, 1).article_body_source, 'bs_data_template');
  assert.equal(row(s, 1).article_body, '本文');
});

test('AI リライト：日次結果まとめの単独指定も force なしでは書き換えない（管理画面の明示的な再生成は可能）', async () => {
  const s = reset([news(1, { source_key: 'bs-daily-result-2026-10-16', article_body_source: 'bs_data_template' })]);
  stubOpenAi();
  const skipped = await generateAndSaveHatsuneArticle(1);
  assert.deepEqual([skipped.skipped, skipped.reason], [true, 'daily_result_digest']);
  assert.equal(row(s, 1).article_body, '本文');
  const forced = await generateAndSaveHatsuneArticle(1, { force: true });
  assert.equal(forced.skipped, false);
  assert.equal(row(s, 1).article_body_source, 'ai');
});

test('AI リライト：生成中に manual 化された通常 NEWS は上書きしない', async () => {
  const s = reset([news(2)]);
  stubOpenAi();
  s.hooks.beforeUpdate = ({ tables }) => { Object.assign(tables.hatsune_news[0], { article_body_source: 'manual', article_body: '人が直した本文' }); };
  const r = await generateAndSaveHatsuneArticle(2);
  assert.deepEqual([r.skipped, r.reason], [true, 'manual']);
  assert.equal(row(s, 2).article_body, '人が直した本文');
});
