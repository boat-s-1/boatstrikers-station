// 候補一覧・予想取得APIの「変更前（原本）」と「変更後」を同じデータで動かし、応答が一致することを確認する。
// あわせて、未認証の呼び出しがDBに触れずに401で拒否されることを確認する。
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { ROOT, FakeNextResponse, loadRouteModule, getRequest, createFakeSupabase } from "./helpers.mjs";

const CHARACTERS = ["ichika", "hatsune", "kiina"];
const KINDS = ["candidates", "prediction"];

const RANKINGS = [];
const OFFICIAL = [];
const ENTRIES = [];

function addRanking(row) {
  RANKINGS.push({
    ranking_date: "2026-10-08", data_timing: "previous_day", selected_for_social: false, selected_for_home: false,
    summary: null, social_comment: null, metrics: { shadow: true }, model_version: "m1", ...row,
  });
}

// 一果：BEST10（宮島=17, 丸亀=15 など）。確率の欠損・文字列も含める。
[[17, 1, 0.842], [15, 3, 0.8], [2, 12, "0.7712"], [24, 5, null], [9, 9, 0.61]].forEach(([course, race, p], i) =>
  addRanking({ character_code: "ichika", ranking_type: "ichika_escape_best10", rank_no: i + 1, course_code: course, race_no: race, probability: p, social_comment: i === 0 ? "一果の公式コメント" : null, summary: i === 1 ? "イン逃げ期待 80.0%" : null, selected_for_social: i === 0 }));
addRanking({ character_code: "ichika", ranking_type: "ichika_escape_best10", rank_no: 1, course_code: 17, race_no: 1, probability: 0.9, data_timing: "after_exhibition" });
// 同じキーが2行ある異常データ（maybeSingle のエラー経路）
addRanking({ character_code: "ichika", ranking_type: "ichika_escape_best10", rank_no: 7, course_code: 3, race_no: 4, probability: 0.5 });
addRanking({ character_code: "ichika", ranking_type: "ichika_escape_best10", rank_no: 8, course_code: 3, race_no: 4, probability: 0.4 });

// 初音：同じレースが両方の種類に入るケースも含める。
addRanking({ character_code: "hatsune", ranking_type: "hatsune_dominant_best3", rank_no: 1, course_code: 17, race_no: 2, probability: 0.71 });
addRanking({ character_code: "hatsune", ranking_type: "hatsune_risky_best3", rank_no: 1, course_code: 15, race_no: 6, probability: 0.44, social_comment: "初音コメント" });
addRanking({ character_code: "hatsune", ranking_type: "hatsune_risky_best3", rank_no: 2, course_code: 17, race_no: 2, probability: 0.29 });
addRanking({ character_code: "hatsune", ranking_type: "hatsune_dominant_best3", rank_no: 2, course_code: 22, race_no: 8, probability: 0.66 });
addRanking({ character_code: "hatsune", ranking_type: "hatsune_dominant_best3", rank_no: 1, course_code: 15, race_no: 6, probability: 0.52, data_timing: "after_exhibition" });

// キイナ
[[17, 1, 0.162], [4, 11, 0.15], [20, 3, "abc"]].forEach(([course, race, p], i) =>
  addRanking({ character_code: "kiina", ranking_type: "kiina_boat5_best5", rank_no: i + 1, course_code: course, race_no: race, probability: p }));

// 凍結済み公式買い目（新しい published_at を優先する並び順も確認）
OFFICIAL.push(
  { race_date: "2026-10-08", course_code: 17, race_no: 1, character_code: "ichika", timing: "previous_day", source_table: "ai_v2_daily_rankings", ranking_type: "ichika_escape_best10", rank_no: 1, tickets: ["1-2-3", "1-3-2"], unit_stake: 100, investment: 200, prediction_label: "一果 公開買い目", published_at: "2026-10-08T00:10:00Z", snapshot: {} },
  { race_date: "2026-10-08", course_code: 17, race_no: 1, character_code: "ichika", timing: "previous_day", source_table: "ai_v2_daily_rankings", ranking_type: "ichika_escape_best10", rank_no: 1, tickets: ["1-2-4"], unit_stake: 100, investment: 100, prediction_label: "古い", published_at: "2026-10-07T23:00:00Z", snapshot: {} },
  { race_date: "2026-10-08", course_code: 15, race_no: 6, character_code: "hatsune", timing: "previous_day", source_table: "ai_v2_daily_rankings", ranking_type: "hatsune_risky_best3", rank_no: 1, tickets: ["2-1-3"], unit_stake: 100, investment: 100, prediction_label: "初音 公開買い目", published_at: "2026-10-08T01:00:00Z", snapshot: {} },
  { race_date: "2026-10-08", course_code: 17, race_no: 1, character_code: "kiina", timing: "previous_day", source_table: "ai_v2_daily_rankings", ranking_type: "kiina_boat5_best5", rank_no: 1, tickets: "not-array", unit_stake: null, investment: "300", prediction_label: null, published_at: null, snapshot: {} },
  { race_date: "2026-10-08", course_code: 17, race_no: 1, character_code: "ichika", timing: "previous_day", source_table: "bs_ai_predictions", ranking_type: null, rank_no: null, tickets: ["9-9-9"], unit_stake: 1, investment: 1, prediction_label: "対象外", published_at: "2026-10-09T00:00:00Z", snapshot: {} },
);

// 艇別データ：宮島2R（6艇、欠損・0・負値あり）、丸亀6R（6艇、展示あり）、福岡8R（なし）
const miyajima2 = [
  [1, 6.8, 7.1, 0.15, 42, 38], [2, 5.2, null, 0.18, 35, 0], [3, 6.1, 6.6, 0, 55.5, 40], [4, 4.9, 5.0, 0.21, null, 33], [5, 5.6, 4.8, -0.1, 28, 31], [6, 3.9, 3.2, 0.2, 31, 29],
];
miyajima2.forEach(([boat, nat, loc, st, motor, bt]) => ENTRIES.push({ race_date: "2026-10-08", course_code: 17, race_no: 2, boat_no: boat, national_win_rate: nat, local_win_rate: loc, average_st: st, motor_top2_rate: motor, race_boat_top2_rate: bt, official_exhibition_time: null, official_exhibition_st: null, official_straight: null }));
[[1, 6.2, 6.0, 0.16, 40, 35, 6.78, 0.12, 7.1], [2, 6.9, 7.4, 0.14, 47, 41, 6.71, 0.08, 6.9], [3, 5.5, 5.1, 0.17, 33, 30, 6.85, 0, 7.3], [4, 4.8, 4.2, 0.19, 30, 28, 6.9, 0.2, 7.2], [5, 5.9, 6.3, 0.15, 38, 36, 6.75, 0.11, 7.0], [6, 4.1, 3.8, 0.22, 25, 27, 6.95, 0.25, 7.4]]
  .forEach(([boat, nat, loc, st, motor, bt, ext, exst, straight]) => ENTRIES.push({ race_date: "2026-10-08", course_code: 15, race_no: 6, boat_no: boat, national_win_rate: nat, local_win_rate: loc, average_st: st, motor_top2_rate: motor, race_boat_top2_rate: bt, official_exhibition_time: ext, official_exhibition_st: exst, official_straight: straight, course1_average_st: 0.14 }));

const TABLES = { ai_v2_daily_rankings: RANKINGS, bsc_official_predictions: OFFICIAL, bs_race_entries: ENTRIES };

const STUB_ENV = { NEXT_PUBLIC_SUPABASE_URL: "https://fake.supabase.test", SUPABASE_SERVICE_ROLE_KEY: "service-key" };

function withEnv(values, fn) {
  const saved = {};
  for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]) {
    saved[key] = process.env[key];
    if (values[key] === undefined) delete process.env[key]; else process.env[key] = values[key];
  }
  return Promise.resolve().then(fn).finally(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });
}

function routePath(character, kind) {
  return path.join(ROOT, "app/api/admin", `${character}-news`, kind, "route.js");
}

async function loadPair(character, kind, { authenticated = true } = {}) {
  const state = { clients: 0, db: null, authCalls: 0 };
  const createClient = (url, key, options) => {
    state.clients += 1;
    state.db = createFakeSupabase(TABLES);
    state.lastArgs = { url, key, options };
    return state.db;
  };
  const isAdminAuthenticated = async () => {
    state.authCalls += 1;
    if (authenticated === "throw") throw new Error("ADMIN_DASHBOARD_PASSWORD が未設定です。");
    return authenticated;
  };
  const stubs = {
    "next/server": { NextResponse: FakeNextResponse },
    "@supabase/supabase-js": { createClient },
    "/admin/sync/_lib/adminAuth": { isAdminAuthenticated },
  };
  const legacy = await loadRouteModule({ sourcePath: path.join(ROOT, "tests/newspaper/legacy", `${character}-${kind}.js.txt`), stubs });
  const current = await loadRouteModule({ sourcePath: routePath(character, kind), stubs });
  return { legacy, current, state };
}

const DATES = ["2026-10-08", "2026-10-09", "2026/10/08", "", null];
const TIMINGS = [null, "previous_day", "after_exhibition", "weird"];
const COURSES = ["宮島", "丸亀", "戸田", "福岡", "江戸川", "大村", "架空", null];
const RACES = ["1", "2", "3", "4", "6", "8", "11", "12", "0", "13", "1.5", "abc", null];

function query(params) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== null) search.set(key, value);
  return `https://example.test/api?${search}`;
}

for (const character of CHARACTERS) {
  test(`${character}: 候補一覧の応答が変更前と一致する`, async () => {
    await withEnv(STUB_ENV, async () => {
      const { legacy, current } = await loadPair(character, "candidates");
      let compared = 0;
      for (const date of DATES) for (const timing of TIMINGS) {
        const url = query({ date, timing });
        const before = await legacy.GET(getRequest(url));
        const after = await current.GET(getRequest(url));
        assert.deepStrictEqual(after, before, url);
        compared += 1;
      }
      assert.ok(compared >= 20);
    });
  });

  test(`${character}: 予想取得の応答が変更前と一致する`, async () => {
    await withEnv(STUB_ENV, async () => {
      const { legacy, current } = await loadPair(character, "prediction");
      let found = 0;
      for (const date of DATES.slice(0, 3)) for (const timing of TIMINGS) for (const course of COURSES) for (const raceNo of RACES) {
        const url = query({ date, timing, course, raceNo });
        const before = await legacy.GET(getRequest(url));
        const after = await current.GET(getRequest(url));
        assert.deepStrictEqual(after, before, url);
        if (before.body.found) found += 1;
      }
      assert.ok(found >= 1, "見つかるケースを含めて比較している");
    });
  });

  for (const kind of KINDS) {
    test(`${character} ${kind}: Supabase未設定・読み取り失敗時の応答も変更前と一致する`, async () => {
      await withEnv({}, async () => {
        const { legacy, current } = await loadPair(character, kind);
        const url = query({ date: "2026-10-08", course: "宮島", raceNo: "1" });
        assert.deepStrictEqual(await current.GET(getRequest(url)), await legacy.GET(getRequest(url)));
      });
      await withEnv({ NEXT_PUBLIC_SUPABASE_URL: "https://x", NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon" }, async () => {
        const { legacy, current, state } = await loadPair(character, kind);
        const url = query({ date: "2026-10-08", course: "宮島", raceNo: "2" });
        assert.deepStrictEqual(await current.GET(getRequest(url)), await legacy.GET(getRequest(url)));
        assert.equal(state.lastArgs.key, "anon");
      });
    });

    for (const authenticated of [false, "throw"]) {
      test(`${character} ${kind}: 未認証（${authenticated === false ? "Cookieなし" : "認証設定エラー"}）は401でDBに触れない`, async () => {
        await withEnv(STUB_ENV, async () => {
          const { current, state } = await loadPair(character, kind, { authenticated });
          const response = await current.GET(getRequest(query({ date: "2026-10-08", course: "宮島", raceNo: "1" })));
          assert.deepStrictEqual(response, { status: 401, body: { ok: false, error: "unauthorized" } });
          assert.equal(state.clients, 0);
          assert.equal(state.authCalls, 1);
        });
      });
    }
  }
}

test("DBエラー時の応答コードも変更前と一致する", async () => {
  await withEnv(STUB_ENV, async () => {
    for (const character of CHARACTERS) for (const [table, kind] of [["ai_v2_daily_rankings", "prediction"], ["bsc_official_predictions", "prediction"], ["bs_race_entries", "prediction"], ["ai_v2_daily_rankings", "candidates"]]) {
      const stubsFor = () => {
        const createClient = () => createFakeSupabase(TABLES, { failures: { [`${table}:select`]: { message: "boom" } } });
        return {
          "next/server": { NextResponse: FakeNextResponse },
          "@supabase/supabase-js": { createClient },
          "/admin/sync/_lib/adminAuth": { isAdminAuthenticated: async () => true },
        };
      };
      const legacy = await loadRouteModule({ sourcePath: path.join(ROOT, "tests/newspaper/legacy", `${character}-${kind}.js.txt`), stubs: stubsFor() });
      const current = await loadRouteModule({ sourcePath: routePath(character, kind), stubs: stubsFor() });
      const course = character === "hatsune" ? "宮島" : "宮島";
      const raceNo = character === "hatsune" ? "2" : "1";
      const url = query({ date: "2026-10-08", course, raceNo });
      assert.deepStrictEqual(await current.GET(getRequest(url)), await legacy.GET(getRequest(url)), `${character} ${table}`);
    }
  });
});
