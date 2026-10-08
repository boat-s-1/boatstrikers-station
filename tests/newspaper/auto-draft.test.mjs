// 前日版新聞の自動下書き（lib/newspaper/autoDraft.mjs）の安全性テスト。DB・AIはすべて偽物。
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ROOT, createFakeSupabase, NEWSPAPER_UNIQUE_KEYS, NEWSPAPER_UNIQUE_KEYS_WITH_SLOT } from "./helpers.mjs";
import {
  AUTO_DRAFT_GENERATOR, AUTO_DRAFT_LOG_TYPE, recordAutoDraftRun, resolveRunMode, runAutoDraft, jstDate, closingAt,
} from "../../lib/newspaper/autoDraft.mjs";

const DATE = "2026-10-08";
const NOW = new Date("2026-10-08T06:30:00+09:00");
const TABLE = "bs_newspaper_publications";
const ALLOWED_TABLES = new Set(["ai_v2_daily_rankings", "bsc_official_predictions", "bs_race_entries", "bs_race_events", "bs_race_results", TABLE, "bs_news_sync_logs"]);

function entries(courseCode, raceNo, rows) {
  return rows.map(([boat, nat, loc, st, motor, bt]) => ({
    race_date: DATE, course_code: courseCode, race_no: raceNo, boat_no: boat, national_win_rate: nat, local_win_rate: loc, average_st: st, motor_top2_rate: motor, race_boat_top2_rate: bt,
    // 展示データ（前日版では読まないことを確認するための値）
    official_exhibition_time: 6.66, official_exhibition_st: 0.01,
  }));
}

const FULL = [[1, 6.8, 7.1, 0.15, 42, 38], [2, 5.2, 7.4, 0.18, 35, 30], [3, 6.1, 6.6, 0.14, 55.5, 40], [4, 4.9, 5.0, 0.21, 31, 33], [5, 5.6, 4.8, 0.19, 28, 31], [6, 3.9, 3.2, 0.2, 30, 29]];

function baseTables() {
  return {
    ai_v2_daily_rankings: [
      { id: "r-i1", ranking_date: DATE, data_timing: "previous_day", character_code: "ichika", ranking_type: "ichika_escape_best10", rank_no: 1, course_code: 17, race_no: 1, probability: 0.842, social_comment: null, model_version: "m", updated_at: "2026-10-08T00:05:00Z" },
      { id: "r-i2", ranking_date: DATE, data_timing: "previous_day", character_code: "ichika", ranking_type: "ichika_escape_best10", rank_no: 2, course_code: 15, race_no: 3, probability: 0.8, social_comment: null, model_version: "m", updated_at: "2026-10-08T00:05:00Z" },
      { id: "r-h1", ranking_date: DATE, data_timing: "previous_day", character_code: "hatsune", ranking_type: "hatsune_dominant_best3", rank_no: 1, course_code: 17, race_no: 2, probability: 0.71, social_comment: null, model_version: "m", updated_at: "2026-10-08T00:05:00Z" },
      { id: "r-h2", ranking_date: DATE, data_timing: "previous_day", character_code: "hatsune", ranking_type: "hatsune_risky_best3", rank_no: 1, course_code: 15, race_no: 6, probability: 0.44, social_comment: null, model_version: "m", updated_at: "2026-10-08T00:05:00Z" },
      { id: "r-k1", ranking_date: DATE, data_timing: "previous_day", character_code: "kiina", ranking_type: "kiina_boat5_best5", rank_no: 1, course_code: 4, race_no: 11, probability: 0.162, social_comment: null, model_version: "m", updated_at: "2026-10-08T00:05:00Z" },
      // 直前版（展示後）は対象外
      { id: "r-x", ranking_date: DATE, data_timing: "after_exhibition", character_code: "ichika", ranking_type: "ichika_escape_best10", rank_no: 1, course_code: 2, race_no: 1, probability: 0.9 },
    ],
    bsc_official_predictions: [
      { race_date: DATE, course_code: 17, race_no: 1, character_code: "ichika", timing: "previous_day", source_table: "ai_v2_daily_rankings", ranking_type: "ichika_escape_best10", rank_no: 1, tickets: ["1-2-3", "1-3-2"], unit_stake: 100, investment: 200, prediction_label: "一果 公開買い目", published_at: "2026-10-08T00:10:00Z" },
    ],
    bs_race_entries: [...entries(17, 1, FULL), ...entries(15, 3, FULL), ...entries(17, 2, FULL), ...entries(15, 6, FULL), ...entries(4, 11, FULL)],
    bs_race_events: [[17, 1, "10:45"], [15, 3, "11:20"], [17, 2, "11:15"], [15, 6, "13:05"], [4, 11, "1612"]].map(([course_code, race_no, closing_time]) => ({ race_date: DATE, course_code, race_no, closing_time })),
    bs_race_results: [],
    bs_newspaper_publications: [],
    bs_news_sync_logs: [],
  };
}

// 既定は「1日・1キャラ・1件」の制約を作成済みのDBを想定する。
function db(tables = baseTables(), options = {}) {
  return createFakeSupabase(tables, { uniqueKeys: NEWSPAPER_UNIQUE_KEYS_WITH_SLOT, ...options });
}

// AIの代わり：渡された材料（sourcePayload）の数値だけを使った記事を返す。
function honestAi(calls = []) {
  return async (body) => {
    calls.push(body);
    const v = body.sourcePayload;
    const race = `${v.course}${v.raceNo}R`;
    let text;
    if (body.character === "ichika") text = `## 前日版｜一果の注目ポイント\n${race}はイン逃げ率${v.escapeRate}%。1号艇を軸に見ていきます。${v.aiTickets ? `公式買い目は${v.aiTickets.join("、")}の${v.aiTickets.length}点、1点${v.aiUnitStake}円、合計${v.aiInvestment}円です。` : ""}`;
    else if (body.character === "hatsune") text = `## 前日版｜初音の女子戦チェック\n${race}の女子戦期待度は${v.expectation}%。注目は${v.featuredBoat}号艇。\n${v.checkpoints.join("。\n")}。`;
    else text = `## 前日版｜キイナの穴チェック\n${race}は5号艇の穴狙い期待度${v.holeChance}%！展開がハマるか注目。`;
    return { status: 200, body: { ok: true, length: "standard", result: { summary: `${race}の前日版です。`, articleBody: text, noteTitle: `${race}をチェック`, noteBody: `${text}\nBoatStrikersで直前版も確認できます。` } } };
  };
}

function writes(fake) {
  return fake.calls.filter((call) => call.action !== "select");
}

// ---- 実行モード ----

test("実行モード：本番は明示許可なしでは blocked、未設定なら書き込み禁止、dry_run は読み取りのみ", () => {
  const params = (q = "") => new URLSearchParams(q);
  assert.equal(resolveRunMode({ env: { VERCEL_ENV: "production", NEWSPAPER_AUTO_DRAFT_ENABLED: "true" }, searchParams: params(), now: NOW }).mode, "blocked");
  assert.equal(resolveRunMode({ env: { VERCEL_ENV: "production" }, searchParams: params("dry_run=1"), now: NOW }).mode, "blocked");
  assert.equal(resolveRunMode({ env: {}, searchParams: params(), now: NOW }).mode, "disabled");
  assert.equal(resolveRunMode({ env: { NEWSPAPER_AUTO_DRAFT_ENABLED: "1" }, searchParams: params(), now: NOW }).mode, "disabled");
  assert.deepStrictEqual(resolveRunMode({ env: { NEWSPAPER_AUTO_DRAFT_ENABLED: "true" }, searchParams: params(), now: NOW }), { mode: "blocked", reason: "slot_constraint_required", date: DATE });
  assert.deepStrictEqual(resolveRunMode({ env: { NEWSPAPER_AUTO_DRAFT_ENABLED: "true", NEWSPAPER_AUTO_DRAFT_SLOT_CONSTRAINT: "true" }, searchParams: params(), now: NOW }), { mode: "write", date: DATE, slotConstraint: true });
  assert.deepStrictEqual(resolveRunMode({ env: {}, searchParams: params("dry_run=1"), now: NOW }), { mode: "dry_run", date: DATE });
  assert.deepStrictEqual(resolveRunMode({ env: { NEWSPAPER_AUTO_DRAFT_ENABLED: "true" }, searchParams: params("dry_run=true&date=2026-10-01"), now: NOW }), { mode: "dry_run", date: "2026-10-01" });
  assert.equal(resolveRunMode({ env: {}, searchParams: params("dry_run=1&date=bad"), now: NOW }).mode, "blocked");
  // date 指定は dry_run 以外では無視（書き込みは当日のみ）
  assert.equal(resolveRunMode({ env: { NEWSPAPER_AUTO_DRAFT_ENABLED: "true", NEWSPAPER_AUTO_DRAFT_SLOT_CONSTRAINT: "true" }, searchParams: params("date=2026-10-01"), now: NOW }).date, DATE);
  assert.equal(jstDate(new Date("2026-10-07T21:40:00Z")), "2026-10-08");
});

test("runAutoDraft は blocked/disabled では動かず、書き込みは当日分のみ・DB制約が必要", async () => {
  for (const mode of ["blocked", "disabled"]) await assert.rejects(runAutoDraft({ supabase: db(), mode, date: DATE, now: NOW, aiWrite: honestAi() }));
  const fake = db();
  await assert.rejects(runAutoDraft({ supabase: fake, mode: "write", date: DATE, now: NOW, aiWrite: honestAi() }), /DB制約が必要/);
  assert.equal(fake.calls.length, 0);
  await assert.rejects(runAutoDraft({ supabase: db(), mode: "write", slotConstraint: true, date: "2026-10-09", now: NOW, aiWrite: honestAi() }), /当日分のみ/);
});

// ---- dry_run ----

test("dry_run：AIを呼ばず、DBに一切書き込まない", async () => {
  const fake = db();
  const aiCalls = [];
  const result = await runAutoDraft({ supabase: fake, mode: "dry_run", date: DATE, now: NOW, aiWrite: honestAi(aiCalls) });
  assert.equal(aiCalls.length, 0);
  assert.deepStrictEqual(writes(fake), []);
  assert.deepStrictEqual(result.results.map((r) => [r.character, r.outcome, r.courseCode, r.raceNo]), [
    ["ichika", "would_generate", 17, 1], ["hatsune", "would_generate", 17, 2], ["kiina", "would_generate", 4, 11],
  ]);
});

// ---- 書き込み ----

test("write：3キャラ各1件の下書きを作り、公開しない", async () => {
  const fake = db();
  const aiCalls = [];
  const result = await runAutoDraft({ supabase: fake, mode: "write", slotConstraint: true, date: DATE, now: NOW, aiWrite: honestAi(aiCalls) });
  assert.deepStrictEqual(result.results.map((r) => r.outcome), ["created", "created", "created"]);
  assert.equal(result.summary.created, 3);
  const rows = fake.tables[TABLE];
  assert.equal(rows.length, 3);
  for (const row of rows) {
    assert.equal(row.status, "draft");
    assert.equal(row.published_at, null);
    assert.equal(row.edition, "previous_day");
    assert.equal(row.source_payload.generator, AUTO_DRAFT_GENERATOR);
    assert.equal(row.source_payload.data_timing, "previous_day");
    assert.equal(row.image_url, null);
  }
  assert.deepStrictEqual(rows.map((r) => [r.character_key, r.course_name, r.race_no]), [["ichika", "宮島", 1], ["hatsune", "宮島", 2], ["kiina", "平和島", 11]]);
  assert.equal(aiCalls.length, 3);
  const inserts = fake.calls.filter((c) => c.action === "insert" && c.table === TABLE);
  assert.ok(inserts.every((c) => c.values.auto_draft_generator === AUTO_DRAFT_GENERATOR && c.values.status === "draft"));
  assert.ok(!fake.calls.some((c) => c.table === TABLE && (c.action === "update" || c.action === "upsert")));
  assert.ok(fake.calls.every((c) => ALLOWED_TABLES.has(c.table)), "参照するテーブルは決まったものだけ");
});

test("AIに渡す材料にダミー値・展示データ・ランキング外の情報が入らない", async () => {
  const aiCalls = [];
  await runAutoDraft({ supabase: db(), mode: "write", slotConstraint: true, date: DATE, now: NOW, aiWrite: honestAi(aiCalls) });
  const [ichika, hatsune, kiina] = aiCalls;
  assert.deepStrictEqual(ichika.sourcePayload, {
    date: DATE, course: "宮島", raceNo: "1", edition: "previous_day", mainCopy: "宮島1R、1号艇中心に相手比較！", escapeRate: "84.2", honmeiBoat: "1", ichikaComment: "",
    aiTickets: ["1-2-3", "1-3-2"], aiUnitStake: 100, aiInvestment: 200,
  });
  assert.equal(hatsune.sourcePayload.expectation, "71.0");
  assert.equal(hatsune.sourcePayload.featuredBoat, "1");
  assert.equal(hatsune.sourcePayload.checkpoints.length, 3);
  assert.ok(!("aiTickets" in hatsune.sourcePayload), "凍結買い目が無ければ買い目を渡さない");
  assert.deepStrictEqual(Object.keys(kiina.sourcePayload).sort(), ["callout", "course", "date", "edition", "headline", "holeBoat", "holeChance", "kiinaComment", "raceNo"].sort());
  const serialized = JSON.stringify(aiCalls);
  for (const forbidden of ["nationalAverage", "scores", "exhibition", "6.66", "\"73\"", "\"84\"", "\"70\"", "\"16\"", "honmeiComment", "speech"]) {
    assert.ok(!serialized.includes(forbidden), forbidden);
  }
  assert.ok(aiCalls.every((body) => body.sourcePayload.edition === "previous_day" && body.length === "standard"));
});

test("既存の新聞（公開済み・手動下書き）があるレースは上書きせず、次の候補へ進む", async () => {
  const tables = baseTables();
  const published = { id: "pub-1", slug: "p", race_date: DATE, course_name: "宮島", race_no: 1, character_key: "ichika", edition: "previous_day", title: "公開中", status: "published", published_at: "2026-10-07T22:00:00Z", updated_at: "2026-10-07T22:00:00Z", source_payload: { manual: true } };
  tables[TABLE].push({ ...published });
  const fake = db(tables);
  const result = await runAutoDraft({ supabase: fake, mode: "write", slotConstraint: true, date: DATE, now: NOW, aiWrite: honestAi() });
  assert.deepStrictEqual(fake.tables[TABLE][0], published);
  const ichika = result.results[0];
  assert.equal(ichika.outcome, "created");
  assert.deepStrictEqual([ichika.courseCode, ichika.raceNo], [15, 3]);
  assert.deepStrictEqual(ichika.skipped.map((s) => s.reason), ["exists"]);
  assert.ok(!fake.calls.some((c) => c.action === "update"));
});

test("自動下書きが既にあるキャラは1日1件の上限で止まる（再実行しても増えない）", async () => {
  const fake = db();
  await runAutoDraft({ supabase: fake, mode: "write", slotConstraint: true, date: DATE, now: NOW, aiWrite: honestAi() });
  const aiCalls = [];
  const second = await runAutoDraft({ supabase: fake, mode: "write", slotConstraint: true, date: DATE, now: NOW, aiWrite: honestAi(aiCalls) });
  assert.deepStrictEqual(second.results.map((r) => r.outcome), ["limit_reached", "limit_reached", "limit_reached"]);
  assert.equal(aiCalls.length, 0);
  assert.equal(fake.tables[TABLE].length, 3);
});

test("同時実行しても同じレースの新聞は1件だけ（上書きもしない）", async () => {
  const fake = db();
  const [a, b] = await Promise.all([
    runAutoDraft({ supabase: fake, mode: "write", slotConstraint: true, date: DATE, now: NOW, aiWrite: honestAi() }),
    runAutoDraft({ supabase: fake, mode: "write", slotConstraint: true, date: DATE, now: NOW, aiWrite: honestAi() }),
  ]);
  assert.equal(fake.tables[TABLE].length, 3);
  const outcomes = [...a.results, ...b.results].map((r) => r.outcome).sort();
  assert.deepStrictEqual(outcomes, ["created", "created", "created", "exists_concurrent", "exists_concurrent", "exists_concurrent"]);
  assert.ok(!fake.calls.some((c) => c.action === "update" || c.action === "upsert"));
});

// ---- データ不足 ----

test("データ不足のレースは作らない（理由を記録して次の候補へ）", async () => {
  const scenarios = [
    ["確率なし", (t) => { t.ai_v2_daily_rankings[0].probability = null; }, "invalid_probability"],
    ["確率が範囲外", (t) => { t.ai_v2_daily_rankings[0].probability = 1.4; }, "invalid_probability"],
    ["出走表が5艇", (t) => { t.bs_race_entries = t.bs_race_entries.filter((e) => !(e.course_code === 17 && e.race_no === 1 && e.boat_no === 6)); }, "entries_incomplete"],
    ["締切時刻なし", (t) => { t.bs_race_events[0].closing_time = null; }, "closing_time_unknown"],
    ["レース情報なし", (t) => { t.bs_race_events.shift(); }, "race_event_missing"],
    ["締切直前", (t) => { t.bs_race_events[0].closing_time = "06:45"; }, "race_closed"],
    ["結果確定", (t) => { t.bs_race_results.push({ race_date: DATE, course_code: 17, race_no: 1 }); }, "race_finished"],
  ];
  for (const [label, mutate, reason] of scenarios) {
    const tables = baseTables();
    mutate(tables);
    const result = await runAutoDraft({ supabase: db(tables), mode: "write", slotConstraint: true, date: DATE, now: NOW, aiWrite: honestAi() });
    const ichika = result.results[0];
    assert.deepStrictEqual(ichika.skipped.map((s) => s.reason), [reason], label);
    assert.equal(ichika.outcome, "created", label);
    assert.deepStrictEqual([ichika.courseCode, ichika.raceNo], [15, 3], label);
  }
});

test("初音：艇別データが足りず代替文になるレースは作らない", async () => {
  const tables = baseTables();
  for (const entry of tables.bs_race_entries.filter((e) => e.course_code === 17 && e.race_no === 2)) {
    Object.assign(entry, { national_win_rate: null, local_win_rate: null, average_st: null, motor_top2_rate: null });
  }
  const result = await runAutoDraft({ supabase: db(tables), mode: "write", slotConstraint: true, date: DATE, now: NOW, aiWrite: honestAi() });
  const hatsune = result.results[1];
  assert.deepStrictEqual(hatsune.skipped.map((s) => s.reason), ["insights_fallback"]);
  assert.deepStrictEqual([hatsune.outcome, hatsune.courseCode, hatsune.raceNo], ["created", 15, 6]);
});

test("候補がすべて条件外なら作らない", async () => {
  const tables = baseTables();
  tables.bs_race_events = [];
  const aiCalls = [];
  const fake = db(tables);
  const result = await runAutoDraft({ supabase: fake, mode: "write", slotConstraint: true, date: DATE, now: NOW, aiWrite: honestAi(aiCalls) });
  assert.deepStrictEqual(result.results.map((r) => r.outcome), ["no_eligible_race", "no_eligible_race", "no_eligible_race"]);
  assert.equal(aiCalls.length, 0);
  assert.equal(fake.tables[TABLE].length, 0);
  const empty = baseTables();
  empty.ai_v2_daily_rankings = [];
  const none = await runAutoDraft({ supabase: db(empty), mode: "write", slotConstraint: true, date: DATE, now: NOW, aiWrite: honestAi() });
  assert.deepStrictEqual(none.results.map((r) => r.outcome), ["no_candidates", "no_candidates", "no_candidates"]);
});

// ---- 失敗時 ----

test("AIが元データに無い数値を書いたら保存しない（次の候補にも進まない）", async () => {
  const fake = db();
  const liar = async (body) => {
    const ok = await honestAi()(body);
    ok.body.result.articleBody += "\n全国平均73%と比べても高い数字です。";
    return ok;
  };
  const result = await runAutoDraft({ supabase: fake, mode: "write", slotConstraint: true, date: DATE, now: NOW, aiWrite: liar });
  assert.deepStrictEqual(result.results.map((r) => r.outcome), ["fact_guard_rejected", "fact_guard_rejected", "fact_guard_rejected"]);
  assert.ok(result.results[0].violations.some((v) => /73/.test(v.snippet)));
  assert.equal(fake.tables[TABLE].length, 0);
  assert.equal(result.summary.rejected, 3);
});

test("AIが項目と数値の対応を変えたら保存しない", async () => {
  const fake = db();
  const swapped = async (body) => {
    const ok = await honestAi()(body);
    if (body.character === "hatsune") ok.body.result.noteBody = ok.body.result.noteBody.replace("1号艇 当地勝率", "4号艇 当地勝率");
    return ok;
  };
  const result = await runAutoDraft({ supabase: fake, mode: "write", slotConstraint: true, date: DATE, now: NOW, aiWrite: swapped });
  assert.equal(result.results[1].outcome, "fact_guard_rejected");
  assert.deepStrictEqual(fake.tables[TABLE].map((r) => r.character_key), ["ichika", "kiina"]);
});

test("AIの失敗・例外では保存せず、エラーとして返す", async () => {
  for (const aiWrite of [
    async () => ({ status: 502, body: { error: "AI記事生成に失敗しました。" } }),
    async () => { throw new Error("timeout"); },
  ]) {
    const fake = db();
    const result = await runAutoDraft({ supabase: fake, mode: "write", slotConstraint: true, date: DATE, now: NOW, aiWrite });
    assert.deepStrictEqual(result.results.map((r) => r.outcome), ["ai_failed", "ai_failed", "ai_failed"]);
    assert.equal(result.ok, false);
    assert.equal(fake.tables[TABLE].length, 0);
  }
});

test("保存エラーでも公開済み新聞を変更しない", async () => {
  const tables = baseTables();
  const published = { id: "pub-9", slug: "p9", race_date: DATE, course_name: "宮島", race_no: 7, character_key: "ichika", edition: "previous_day", title: "公開中", status: "published", published_at: "x", updated_at: "x", source_payload: {} };
  tables[TABLE].push({ ...published });
  const fake = db(tables, { failures: { [`${TABLE}:insert`]: { message: "write failed" } } });
  const result = await runAutoDraft({ supabase: fake, mode: "write", slotConstraint: true, date: DATE, now: NOW, aiWrite: honestAi() });
  assert.deepStrictEqual(result.results.map((r) => r.outcome), ["save_failed", "save_failed", "save_failed"]);
  assert.deepStrictEqual(fake.tables[TABLE], [published]);
});

test("同じレースで2回失敗したら、その日はそのレースを見送る", async () => {
  const tables = baseTables();
  const failure = { character: "ichika", outcome: "ai_failed", courseCode: 17, raceNo: 1 };
  tables.bs_news_sync_logs.push(
    { run_type: AUTO_DRAFT_LOG_TYPE, run_at: "2026-10-08T06:00:00+09:00", details: { date: DATE, results: [failure] } },
    { run_type: AUTO_DRAFT_LOG_TYPE, run_at: "2026-10-08T06:20:00+09:00", details: { date: DATE, results: [failure] } },
  );
  const result = await runAutoDraft({ supabase: db(tables), mode: "write", slotConstraint: true, date: DATE, now: NOW, aiWrite: honestAi() });
  assert.deepStrictEqual(result.results[0].skipped.map((s) => s.reason), ["retry_limit"]);
  assert.deepStrictEqual([result.results[0].courseCode, result.results[0].raceNo], [15, 3]);
});

test("時間の予算を超えたら、AIを呼ばずに次回へ回す", async () => {
  let t = 0;
  const aiCalls = [];
  const fake = db();
  const result = await runAutoDraft({
    supabase: fake, mode: "write", slotConstraint: true, date: DATE, now: NOW, timeBudgetMs: 1000, startedAt: 0, clock: () => t,
    aiWrite: async (body) => { t += 5000; return honestAi(aiCalls)(body); },
  });
  assert.deepStrictEqual(result.results.map((r) => r.outcome), ["created", "deferred_time_budget", "deferred_time_budget"]);
  assert.equal(aiCalls.length, 1);
});

test("読み取りエラーは例外として上に返す（新聞テーブルには書かない）", async () => {
  const fake = db(baseTables(), { failures: { "bs_race_events:select": { message: "boom" } } });
  await assert.rejects(runAutoDraft({ supabase: fake, mode: "write", slotConstraint: true, date: DATE, now: NOW, aiWrite: honestAi() }), /レース情報/);
  assert.deepStrictEqual(writes(fake), []);
});

// ---- 実行ログ ----

test("実行ログは bs_news_sync_logs にだけ記録する", async () => {
  const fake = db();
  const result = await runAutoDraft({ supabase: fake, mode: "write", slotConstraint: true, date: DATE, now: NOW, aiWrite: honestAi() });
  await recordAutoDraftRun(fake, result);
  await recordAutoDraftRun(fake, { date: DATE, mode: "write" }, { error: "boom" });
  const logWrites = writes(fake).filter((c) => c.table === "bs_news_sync_logs");
  assert.equal(logWrites.length, 2);
  assert.equal(logWrites[0].values.run_type, AUTO_DRAFT_LOG_TYPE);
  assert.equal(logWrites[0].values.verified_count, 3);
  assert.equal(logWrites[0].values.details.date, DATE);
  assert.equal(logWrites[1].values.error_count, 1);
  assert.equal(logWrites[1].values.details.error, "boom");
});

// ---- 静的な確認 ----

test("前夜取得の公式出走表（TRINITY）を参照せず、Cronも登録していない", async () => {
  const sources = await Promise.all(["lib/newspaper/autoDraft.mjs", "lib/newspaper/factGuard.mjs", "app/api/cron/newspaper-previous-day-drafts/route.js"].map((file) => readFile(path.join(ROOT, file), "utf8")));
  for (const source of sources) assert.doesNotMatch(source, /trinity_|from\("trinity/i);
  const vercel = JSON.parse(await readFile(path.join(ROOT, "vercel.json"), "utf8"));
  assert.ok(!vercel.crons.some((cron) => cron.path.includes("newspaper")));
});

test("締切時刻の解釈は既存の予想生成と同じ", () => {
  assert.equal(closingAt(DATE, "10:45").toISOString(), "2026-10-08T01:45:00.000Z");
  assert.equal(closingAt(DATE, "1612").toISOString(), "2026-10-08T07:12:00.000Z");
  assert.equal(closingAt(DATE, "2026-10-08T10:45:00+09:00").toISOString(), "2026-10-08T01:45:00.000Z");
  assert.equal(closingAt(DATE, "未定"), null);
  assert.equal(closingAt(DATE, ""), null);
});

// ---- 並列実行で別レースを選んだ場合（PHASE 2.5） ----

function divergentRuns(fake) {
  // 実行Aは宮島1Rがまだ締切前、実行Bは締切直前（＝丸亀3Rを選ぶ）。同時に走らせる。
  const late = new Date("2026-10-08T10:30:00+09:00");
  return Promise.all([
    runAutoDraft({ supabase: fake, mode: "write", slotConstraint: true, date: DATE, now: NOW, aiWrite: honestAi() }),
    runAutoDraft({ supabase: fake, mode: "write", slotConstraint: true, date: DATE, now: late, aiWrite: honestAi() }),
  ]);
}

test("並列実行で別レースを選んでも、DB制約があれば1キャラ1件に収まる", async () => {
  const fake = db();
  const [a, b] = await divergentRuns(fake);
  const ichikaRows = fake.tables[TABLE].filter((row) => row.character_key === "ichika");
  assert.equal(ichikaRows.length, 1);
  assert.deepStrictEqual([a.results[0].outcome, b.results[0].outcome].sort(), ["created", "exists_concurrent"]);
  assert.notDeepStrictEqual([a.results[0].raceNo], [b.results[0].raceNo], "2つの実行が別レースを選んだことの確認");
  for (const character of ["ichika", "hatsune", "kiina"]) {
    assert.ok(fake.tables[TABLE].filter((row) => row.character_key === character).length <= 1, character);
  }
});

test("（参考）DB制約が無いと、並列実行で1キャラ2件になりうる（制約が必要な理由）", async () => {
  const fake = db(baseTables(), { uniqueKeys: NEWSPAPER_UNIQUE_KEYS });
  await divergentRuns(fake);
  assert.equal(fake.tables[TABLE].filter((row) => row.character_key === "ichika").length, 2);
});

test("制約用の列が本番DBに無いまま書き込もうとしても、行は作られず保存エラーになる", async () => {
  const fake = db(baseTables(), { failures: { [`${TABLE}:insert`]: { message: "Could not find the 'auto_draft_generator' column", code: "PGRST204" } } });
  const result = await runAutoDraft({ supabase: fake, mode: "write", slotConstraint: true, date: DATE, now: NOW, aiWrite: honestAi() });
  assert.deepStrictEqual(result.results.map((r) => r.outcome), ["save_failed", "save_failed", "save_failed"]);
  assert.equal(fake.tables[TABLE].length, 0);
});

test("手動で編集された自動下書き（source_payload が上書き済み）も、その日の1件として数える", async () => {
  const tables = baseTables();
  tables[TABLE].push({ id: "x1", slug: "x1", race_date: DATE, course_name: "丸亀", race_no: 9, character_key: "ichika", edition: "previous_day", status: "draft", source_payload: { manual: true }, auto_draft_generator: AUTO_DRAFT_GENERATOR });
  const aiCalls = [];
  const result = await runAutoDraft({ supabase: db(tables), mode: "write", slotConstraint: true, date: DATE, now: NOW, aiWrite: honestAi(aiCalls) });
  assert.equal(result.results[0].outcome, "limit_reached");
  assert.equal(aiCalls.length, 2);
});
