// 認証不足だった管理API 7本の修正テスト。
// - 未認証・不正な認証情報は 401 で、DB接続・外部取得・RPC を一切行わない。
// - 管理者Cookie / CRON_SECRET で呼んだ場合は、変更前の原本と同じ応答・同じDB操作になる。
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import crypto from "node:crypto";
import { readFile } from "node:fs/promises";
import { ROOT, FakeNextResponse, loadRouteModule, createFakeSupabase } from "../newspaper/helpers.mjs";
import { hasInternalCronCredential, isAdminOrInternalRequest, SUPABASE_CRON_TOKEN_SHA256 } from "../../lib/security/requestAuth.mjs";

const TODAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const ENV = { NEXT_PUBLIC_SUPABASE_URL: "https://fake.supabase.test", SUPABASE_URL: "https://fake.supabase.test", SUPABASE_SERVICE_ROLE_KEY: "service", CRON_SECRET: "cron-secret" };

function entries(courseCode, raceNo, extra = {}) {
  return [1, 2, 3, 4, 5, 6].map((boat_no) => ({ race_date: TODAY, course_code: courseCode, race_no: raceNo, boat_no, official_lap: null, official_straight: null, official_exhibition_time: null, arrival: boat_no, ...extra }));
}

function tables() {
  return {
    bs_race_events: [
      { race_date: TODAY, course_code: 2, course_name: "戸田", race_no: 1, closing_time: "10:30" },
      { race_date: TODAY, course_code: 2, course_name: "戸田", race_no: 2, closing_time: "11:00" },
      { race_date: TODAY, course_code: 17, course_name: "宮島", race_no: 5, closing_time: "12:00" },
    ],
    bs_race_entries: [...entries(2, 1), ...entries(2, 2, { official_lap: 37.1, official_straight: 7.0 }), ...entries(17, 5)],
    stadium_data_snapshots: [{ course_code: 2, period_start: "2026-07-01", period_end: "2026-09-30", generated_at: "2026-10-01T00:00:00Z" }],
    boatstrikers_engine_v3_runs: [{ id: 9, run_type: "single", course_code: 2, as_of_date: "2026-10-01", success: true, race_count: 120, message: "ok", started_at: "2026-10-01T00:00:00Z", finished_at: "2026-10-01T00:01:00Z" }],
    bs_exhibition_alerts: [{ id: 1, race_date: TODAY, course_code: 2, course_name: "戸田", race_no: 1, closing_time: "10:30", notified: false }],
    bs_ichika_hidden_escape_alerts: [{ id: 2, race_date: TODAY, course_code: 17, course_name: "宮島", race_no: 5, closing_time: "12:00" }],
    bs_hatsune_womens_inner_break_alerts: [{ id: 3, race_date: TODAY, course_code: 17, course_name: "宮島", race_no: 5, closing_time: "12:00", result_top3: [2, 3, 4] }],
    bs_ai_predictions: [
      { id: 11, race_date: TODAY, course_code: 2, race_no: 1, timing: "previous_day", character_code: "ichika", detail_json: { top_first_probability_boats: [1, 2, 3, 4] } },
      { id: 12, race_date: TODAY, course_code: 2, race_no: 1, timing: "after_exhibition", character_code: "ichika", detail_json: { top_first_probability_boats: [1, 3, 2, 5] } },
    ],
    bs_race_results: [{ race_date: TODAY, course_code: 2, race_no: 1, trifecta_result: "1-2-3", trifecta_payout: 1230 }],
    bs_ai_bet_results: [],
  };
}

const RPC_RESULTS = {
  bs_engine_v3_status: { ready: true },
  bs_engine_v3_refresh_all: [{ course_code: 1, success: true }],
  bs_engine_v3_refresh_stadium: { success: true },
  bs_refresh_all_stadium_ai_v2: { refreshed: 24 },
  bs_refresh_stadium_ai_v2: { refreshed: 1 },
  evaluate_boat4_double_top_alerts: 2,
  evaluate_ichika_hidden_escape_alerts: 1,
  evaluate_hatsune_womens_inner_break_alerts: 3,
};

const ROUTES = [
  { name: "exhibition-backfill", file: "app/api/admin/exhibition-backfill/route.js", calls: [["POST", "", { date: TODAY, cursor: 0, batchSize: 3 }]] },
  { name: "engine-v3-refresh", file: "app/api/admin/engine-v3/refresh/route.js", calls: [["GET", ""], ["POST", "", { scope: "all", asOf: "2026-10-05" }], ["POST", "", { courseCode: 3, asOf: "2026-10-05" }]] },
  { name: "stadium-ai-v2-refresh", file: "app/api/admin/stadium-ai-v2/refresh/route.js", calls: [["POST", "", { courseCode: 5, asOf: "2026-10-01" }], ["POST", "", { asOf: "2026-10-01" }]] },
  { name: "exhibition-alerts", file: "app/api/admin/exhibition-alerts/route.js", calls: [["GET", `?date=${TODAY}`], ["GET", `?date=${TODAY}&mode=month`], ["POST", ""]] },
  { name: "ichika-hidden-escape", file: "app/api/admin/ichika-hidden-escape/route.js", calls: [["GET", `?date=${TODAY}`], ["GET", `?date=${TODAY}&mode=month`], ["POST", ""]] },
  { name: "hatsune-womens-inner-break", file: "app/api/admin/hatsune-womens-inner-break/route.js", calls: [["GET", `?date=${TODAY}`], ["GET", `?date=${TODAY}&mode=month`], ["POST", ""]] },
  { name: "settle-bets", file: "app/api/ai-v2/settle-bets/route.js", calls: [["GET", ""]] },
];

// 時刻が入る値は比較から外す
function normalize(value) {
  return JSON.parse(JSON.stringify(value ?? null).replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z/g, "<ts>"));
}

function request(method, query, body, headers = {}) {
  return { method, url: `https://example.test/api${query}`, headers: new Headers(headers), json: async () => JSON.parse(JSON.stringify(body ?? {})) };
}

async function withEnv(fn) {
  const saved = Object.fromEntries(Object.keys(ENV).map((key) => [key, process.env[key]]));
  Object.assign(process.env, ENV);
  try { return await fn(); } finally {
    for (const [key, value] of Object.entries(saved)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
}

async function load(route, { admin = false } = {}) {
  const state = { clients: 0, db: null, external: 0 };
  const createClient = () => { state.clients += 1; state.db = createFakeSupabase(tables(), { rpcResults: RPC_RESULTS }); return state.db; };
  const external = {
    fetchBoatersOriginalTenji: async () => { state.external += 1; return { ok: true, rows: [1, 2, 3, 4, 5, 6].map((boatNo) => ({ boatNo, exhibitionTime: 6.7 + boatNo / 100, lapTime: 37 + boatNo / 10, exhibitionSt: 0.1 })) }; },
    fetchOfficialOriginalTenji: async () => { state.external += 1; return { ok: false, error: "unavailable" }; },
  };
  const isAdminAuthenticated = async () => { if (admin === "throw") throw new Error("ADMIN_DASHBOARD_PASSWORD が未設定です。"); return admin === true; };
  const guard = await loadRouteModule({
    sourcePath: path.join(ROOT, "app/api/_lib/adminGuard.js"),
    stubs: { "next/server": { NextResponse: FakeNextResponse }, "/admin/sync/_lib/adminAuth": { isAdminAuthenticated } },
  });
  const stubs = {
    "next/server": { NextResponse: FakeNextResponse },
    "@supabase/supabase-js": { createClient },
    "/lib/boatersOriginalTenji": { fetchBoatersOriginalTenji: external.fetchBoatersOriginalTenji },
    "/lib/officialOriginalTenji": { fetchOfficialOriginalTenji: external.fetchOfficialOriginalTenji },
    "/_lib/adminGuard": { rejectUnlessAdminOrInternal: guard.rejectUnlessAdminOrInternal },
  };
  const current = await loadRouteModule({ sourcePath: path.join(ROOT, route.file), stubs });
  const legacy = await loadRouteModule({ sourcePath: path.join(ROOT, "tests/security/legacy", `${route.name}.js.txt`), stubs });
  return { current, legacy, state };
}

for (const route of ROUTES) {
  for (const [method, query, body] of route.calls) {
    const label = `${route.name} ${method}${query}${body ? ` ${JSON.stringify(body)}` : ""}`;

    test(`${label}：未認証・不正な認証情報は401で、DB・外部取得・RPCに触れない`, async () => {
      await withEnv(async () => {
        for (const [admin, headers] of [
          [false, {}],
          [false, { authorization: "Bearer wrong" }],
          [false, { authorization: "cron-secret" }],
          [false, { "x-supabase-cron-token": "guess" }],
          ["throw", {}],
        ]) {
          const { current, state } = await load(route, { admin });
          const response = await current[method](request(method, query, body, headers));
          assert.deepStrictEqual(response, { status: 401, body: { ok: false, error: "unauthorized" } }, JSON.stringify(headers));
          assert.equal(state.clients, 0);
          assert.equal(state.external, 0);
        }
      });
    });

    for (const [how, admin, headers] of [["管理者Cookie", true, {}], ["CRON_SECRET", false, { authorization: "Bearer cron-secret" }]]) {
      test(`${label}：${how}では変更前と同じ応答・同じDB操作`, async () => {
        await withEnv(async () => {
          const before = await load(route, { admin });
          const after = await load(route, { admin });
          const legacyResponse = await before.legacy[method](request(method, query, body, headers));
          const currentResponse = await after.current[method](request(method, query, body, headers));
          assert.deepStrictEqual(normalize(currentResponse), normalize(legacyResponse));
          assert.deepStrictEqual(normalize(after.state.db?.calls), normalize(before.state.db?.calls));
          assert.deepStrictEqual(normalize(after.state.db?.tables), normalize(before.state.db?.tables));
          assert.equal(after.state.external, before.state.external);
        });
      });
    }
  }
}

test("変更前の原本は未認証でもDBを更新できた（修正対象の再現）", async () => {
  await withEnv(async () => {
    const backfill = await load(ROUTES[0]);
    await backfill.legacy.POST(request("POST", "", { date: TODAY, cursor: 0, batchSize: 3 }));
    assert.ok(backfill.state.db.calls.some((c) => c.action === "update" && c.table === "bs_race_entries"));
    const settle = await load(ROUTES.at(-1));
    await settle.legacy.GET(request("GET", ""));
    assert.ok(settle.state.db.calls.some((c) => c.action === "upsert" && c.table === "bs_ai_bet_results"));
  });
});

test("settle-bets：認証付きPOSTでも精算でき、GETと同じ結果になる", async () => {
  await withEnv(async () => {
    const viaGet = await load(ROUTES.at(-1));
    const viaPost = await load(ROUTES.at(-1));
    const getResponse = await viaGet.current.GET(request("GET", "", null, { authorization: "Bearer cron-secret" }));
    const postResponse = await viaPost.current.POST(request("POST", "", null, { authorization: "Bearer cron-secret" }));
    assert.equal(getResponse.status, 200);
    assert.deepStrictEqual(normalize(postResponse), normalize(getResponse));
    assert.ok(viaPost.state.db.tables.bs_ai_bet_results.length > 0);
    const anonymous = await load(ROUTES.at(-1));
    assert.equal((await anonymous.current.POST(request("POST", ""))).status, 401);
    assert.equal(anonymous.state.clients, 0);
  });
});

// ---- 認証判定の共通処理 ----

test("内部呼び出しの判定：CRON_SECRET と Supabaseトークン", () => {
  const env = { CRON_SECRET: "s3cret" };
  assert.equal(hasInternalCronCredential(new Headers({ authorization: "Bearer s3cret" }), env), true);
  assert.equal(hasInternalCronCredential(new Headers({ authorization: "Bearer s3cre" }), env), false);
  assert.equal(hasInternalCronCredential(new Headers({ authorization: "s3cret" }), env), false);
  assert.equal(hasInternalCronCredential(new Headers({ authorization: "Bearer " }), { CRON_SECRET: "" }), false);
  assert.equal(hasInternalCronCredential(new Headers({ authorization: "Bearer undefined" }), {}), false);
  assert.equal(hasInternalCronCredential(new Headers({}), env), false);
  assert.equal(hasInternalCronCredential(new Headers({ "x-supabase-cron-token": "wrong" }), env), false);
  assert.equal(hasInternalCronCredential(undefined, env), false);
});

test("Supabaseトークンの照合値は既存のCronルートと同じ", async () => {
  for (const file of ["app/api/cron/exhibition-alerts/route.js", "app/api/cron/ichika-hidden-escape/route.js", "app/api/cron/ai-previous-day-health/route.js", "app/api/cron/exhibition-alert-lines/route.js", "app/api/cron/ichika-escape-surge/route.js"]) {
    const source = await readFile(path.join(ROOT, file), "utf8");
    assert.ok(source.includes(SUPABASE_CRON_TOKEN_SHA256), file);
  }
  assert.equal(crypto.createHash("sha256").update("x").digest("hex").length, SUPABASE_CRON_TOKEN_SHA256.length);
});

test("管理者Cookieの判定：例外は拒否として扱う", async () => {
  const req = { headers: new Headers({}) };
  assert.equal(await isAdminOrInternalRequest(req, { isAdminAuthenticated: async () => true, env: {} }), true);
  assert.equal(await isAdminOrInternalRequest(req, { isAdminAuthenticated: async () => false, env: {} }), false);
  assert.equal(await isAdminOrInternalRequest(req, { isAdminAuthenticated: () => { throw new Error("x"); }, env: {} }), false);
  assert.equal(await isAdminOrInternalRequest(req, { isAdminAuthenticated: async () => "yes", env: {} }), true);
});

test("7本すべてが公開ハンドラの先頭で認証を確認している", async () => {
  for (const route of ROUTES) {
    const source = await readFile(path.join(ROOT, route.file), "utf8");
    const exported = [...source.matchAll(/export async function (GET|POST|PUT|PATCH|DELETE)\(request\) \{\n  const denied = await rejectUnlessAdminOrInternal\(request\);\n  if \(denied\) return denied;/g)].map((m) => m[1]);
    const all = [...source.matchAll(/export (?:async )?function (GET|POST|PUT|PATCH|DELETE)\b/g)].map((m) => m[1]);
    assert.deepStrictEqual(exported.sort(), all.sort(), route.file);
  }
});
