// 自動下書きCronルート（app/api/cron/newspaper-previous-day-drafts/route.js）を、
// Supabase と OpenAI を偽物にして実際のルートファイルごと動かす。
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { ROOT, FakeNextResponse, loadRouteModule, createFakeSupabase, NEWSPAPER_UNIQUE_KEYS } from "./helpers.mjs";
import { jstDate } from "../../lib/newspaper/autoDraft.mjs";
import { loadDraftReview } from "../../lib/newspaper/draftReview.mjs";
import * as channels from "../../lib/newspaper/channels.mjs";

const ROUTE = path.join(ROOT, "app/api/cron/newspaper-previous-day-drafts/route.js");
const TODAY = jstDate();
const ENV_KEYS = ["CRON_SECRET", "VERCEL_ENV", "NEWSPAPER_AUTO_DRAFT_ENABLED", "NEWSPAPER_AUTO_DRAFT_ALLOW_PRODUCTION", "OPENAI_API_KEY", "OPENAI_NEWSPAPER_MODEL", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];

function tables() {
  const full = [[1, 6.8, 7.1, 0.15, 42, 38], [2, 5.2, 7.4, 0.18, 35, 30], [3, 6.1, 6.6, 0.14, 55.5, 40], [4, 4.9, 5.0, 0.21, 31, 33], [5, 5.6, 4.8, 0.19, 28, 31], [6, 3.9, 3.2, 0.2, 30, 29]];
  return {
    ai_v2_daily_rankings: [{ id: "r1", ranking_date: TODAY, data_timing: "previous_day", character_code: "kiina", ranking_type: "kiina_boat5_best5", rank_no: 1, course_code: 17, race_no: 12, probability: 0.162 }],
    bsc_official_predictions: [],
    bs_race_entries: full.map(([boat_no, national_win_rate, local_win_rate, average_st, motor_top2_rate, race_boat_top2_rate]) => ({ race_date: TODAY, course_code: 17, race_no: 12, boat_no, national_win_rate, local_win_rate, average_st, motor_top2_rate, race_boat_top2_rate })),
    bs_race_events: [{ race_date: TODAY, course_code: 17, race_no: 12, closing_time: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString() }],
    bs_race_results: [],
    bs_newspaper_publications: [],
    bs_news_sync_logs: [],
  };
}

async function run({ env, query = "", authorization = "Bearer test-secret", aiText }) {
  const saved = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
  for (const key of ENV_KEYS) delete process.env[key];
  Object.assign(process.env, { CRON_SECRET: "test-secret", NEXT_PUBLIC_SUPABASE_URL: "https://fake.supabase.test", SUPABASE_SERVICE_ROLE_KEY: "service", OPENAI_API_KEY: "sk-test", ...env });
  const state = { clients: 0, fetches: [], db: createFakeSupabase(tables(), { uniqueKeys: NEWSPAPER_UNIQUE_KEYS }) };
  const savedFetch = globalThis.fetch;
  const savedInfo = console.info;
  console.info = () => {};
  globalThis.fetch = async (url, options) => {
    state.fetches.push({ url, body: JSON.parse(options.body) });
    const text = aiText ?? "## 前日版｜キイナの穴チェック\n宮島12Rは5号艇の穴狙い期待度16.2%！展開がハマるか注目。";
    return { ok: true, status: 200, json: async () => ({ output_text: JSON.stringify({ summary: "宮島12Rの前日版です。", articleBody: text, noteTitle: "宮島12Rをチェック", noteBody: text }) }) };
  };
  try {
    const route = await loadRouteModule({
      sourcePath: ROUTE,
      stubs: {
        "next/server": { NextResponse: FakeNextResponse },
        "@supabase/supabase-js": { createClient: () => { state.clients += 1; return state.db; } },
      },
    });
    const headers = new Map(authorization ? [["authorization", authorization]] : []);
    const response = await route.GET({ url: `https://example.test/api/cron/newspaper-previous-day-drafts${query}`, headers });
    return { response, state };
  } finally {
    globalThis.fetch = savedFetch;
    console.info = savedInfo;
    for (const key of ENV_KEYS) { if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key]; }
  }
}

test("CRON_SECRET が無い・違う場合は401でDBに触れない", async () => {
  for (const authorization of [null, "Bearer wrong", "test-secret"]) {
    const { response, state } = await run({ env: { NEWSPAPER_AUTO_DRAFT_ENABLED: "true" }, authorization });
    assert.deepStrictEqual(response, { status: 401, body: { ok: false, error: "unauthorized" } });
    assert.equal(state.clients, 0);
  }
  const { response } = await run({ env: { CRON_SECRET: "" }, authorization: "Bearer " });
  assert.equal(response.status, 401);
});

test("本番環境では許可フラグが無い限り、dry_run も含めて何もしない", async () => {
  for (const query of ["", "?dry_run=1"]) {
    const { response, state } = await run({ env: { VERCEL_ENV: "production", NEWSPAPER_AUTO_DRAFT_ENABLED: "true" }, query });
    assert.equal(response.body.mode, "blocked");
    assert.equal(response.body.reason, "production_blocked");
    assert.equal(state.clients, 0);
    assert.equal(state.fetches.length, 0);
  }
});

test("NEWSPAPER_AUTO_DRAFT_ENABLED 未設定なら書き込まない（DB接続もしない）", async () => {
  const { response, state } = await run({ env: {} });
  assert.deepStrictEqual(response.body, { ok: true, mode: "disabled", reason: "auto_draft_disabled", date: TODAY });
  assert.equal(state.clients, 0);
  assert.equal(state.fetches.length, 0);
});

test("dry_run はAI呼び出し・DB書き込み・ログ記録をしない", async () => {
  const { response, state } = await run({ env: { NEWSPAPER_AUTO_DRAFT_ENABLED: "true" }, query: "?dry_run=1" });
  assert.equal(response.status, 200);
  assert.equal(response.body.mode, "dry_run");
  assert.equal(response.body.results[2].outcome, "would_generate");
  assert.equal(state.fetches.length, 0);
  assert.ok(state.db.calls.every((c) => c.action === "select"));
});

test("有効時は下書きを1件作り、実行ログを残す（公開しない）", async () => {
  const { response, state } = await run({ env: { NEWSPAPER_AUTO_DRAFT_ENABLED: "true", OPENAI_NEWSPAPER_MODEL: "test-model" } });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.deepStrictEqual(response.body.results.map((r) => r.outcome), ["no_candidates", "no_candidates", "created"]);
  const [row] = state.db.tables.bs_newspaper_publications;
  assert.equal(row.status, "draft");
  assert.equal(row.published_at, null);
  assert.equal(row.source_payload.ai.model, "test-model");
  assert.equal(state.fetches.length, 1);
  assert.equal(state.fetches[0].body.model, "test-model");
  assert.match(state.fetches[0].body.input, /"holeChance": "16.2"/);
  assert.equal(state.db.tables.bs_news_sync_logs.length, 1);
  assert.equal(state.db.tables.bs_news_sync_logs[0].verified_count, 1);
});

test("AIが数値を作ったら保存せず、実行ログで知らせる", async () => {
  const { response, state } = await run({ env: { NEWSPAPER_AUTO_DRAFT_ENABLED: "true" }, aiText: "宮島12Rは5号艇の穴狙い期待度16.2%。前走は3連勝。" });
  assert.equal(response.status, 200);
  assert.equal(response.body.results[2].outcome, "fact_guard_rejected");
  assert.equal(state.db.tables.bs_newspaper_publications.length, 0);
  assert.equal(state.db.tables.bs_news_sync_logs[0].rejected_count, 1);
});

test("閲覧画面のデータは自動下書きと実行ログを日付で絞る", async () => {
  const fake = createFakeSupabase({
    bs_newspaper_publications: [
      { id: "a", race_date: "2026-10-08", edition: "previous_day", character_key: "kiina", race_no: 1, source_payload: { generator: "auto-previous-day-v1" } },
      { id: "m", race_date: "2026-10-08", edition: "previous_day", character_key: "ichika", race_no: 2, source_payload: { manual: true } },
      { id: "j", race_date: "2026-10-08", edition: "just_before", character_key: "ichika", race_no: 3, source_payload: {} },
      { id: "o", race_date: "2026-10-07", edition: "previous_day", character_key: "ichika", race_no: 3, source_payload: {} },
    ],
    bs_news_sync_logs: [
      { id: 1, run_type: "newspaper_auto_draft", run_at: "2026-10-08T06:00:00+09:00", details: { date: "2026-10-08", results: [] } },
      { id: 2, run_type: "newspaper_auto_draft", run_at: "2026-10-07T06:00:00+09:00", details: { date: "2026-10-07", results: [] } },
      { id: 3, run_type: "x_generate", run_at: "2026-10-08T06:00:00+09:00", details: { date: "2026-10-08" } },
    ],
  });
  const review = await loadDraftReview(fake, "2026-10-08");
  assert.deepStrictEqual(review.newspapers.map((r) => [r.id, r.isAuto]), [["m", false], ["a", true]]);
  assert.deepStrictEqual(review.runs.map((r) => r.id), [1]);
  assert.ok(fake.calls.every((c) => c.action === "select"));
});

test("閲覧画面は閲覧専用（保存・公開・削除の操作やAPI呼び出しが無い）", async () => {
  const page = await readFile(path.join(ROOT, "app/admin/newspaper-drafts/page.js"), "utf8");
  assert.doesNotMatch(page, /"use client"|method="post"|fetch\(|\.insert\(|\.update\(|\.upsert\(|\.delete\(|\.rpc\(/i);
  assert.match(page, /<form className=\{styles\.filter\} method="get">/);
  const review = await readFile(path.join(ROOT, "lib/newspaper/draftReview.mjs"), "utf8");
  assert.doesNotMatch(review, /\.insert\(|\.update\(|\.upsert\(|\.delete\(|\.rpc\(/);
});

test("新聞パネルの入力変換（inputFor）を共通化しても出力は変更前と同じ", async () => {
  const legacy = await readFile(path.join(ROOT, "tests/newspaper/legacy/newspaper-publishing-panel.js.txt"), "utf8");
  const start = legacy.indexOf("function inputFor(character, value) {");
  const source = legacy.slice(start, legacy.indexOf("\n}\n", start) + 3);
  const legacyInputFor = (await import(`data:text/javascript;base64,${Buffer.from(`export ${source}`).toString("base64")}`)).inputFor;
  const values = [
    { date: "2026-10-08", course: "宮島", raceNo: "1", edition: "previous_day", mainCopy: "見出し", escapeRate: "84.2", nationalAverage: "73", honmeiBoat: "1", honmeiComment: "c", ichikaComment: "i" },
    { date: "2026-10-08", course: "丸亀", raceNo: "6", edition: "just_before", headline: "h", expectation: "", featuredBoat: "2", checkpoints: ["a", "b"], comment: "c" },
    { date: "2026-10-08", course: "戸田", raceNo: "12", edition: "previous_day", headline: "k", holeChance: "16.2", holeBoat: "5", callout: "x", kiinaComment: "y" },
    { date: "", course: "", raceNo: "", edition: "" },
  ];
  for (const character of ["ichika", "hatsune", "kiina", "grade"]) for (const value of values) {
    assert.deepStrictEqual(channels.newspaperChannelInput(character, value), legacyInputFor(character, value));
  }
});
