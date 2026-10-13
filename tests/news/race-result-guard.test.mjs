import test from "node:test";
import assert from "node:assert/strict";

import { checkRaceResultConfirmed, closingTimeMs, confirmedRacesForArticles } from "../../lib/raceResultGuard.js";
import { collectResultCandidates } from "../../lib/hatsuneNewsCollector.js";

const KEY = { race_date: "2026-10-13", course_code: 18, race_no: 5 };
const EVENT = { ...KEY, race_name: null, closing_time: "10:32:00", trifecta: "423", trifecta_payout: 41720, race_cancel_code: null, result_available: true };
const RESULT = { ...KEY, result_status: "confirmed", race_status: "finished", winning_trifecta: "4-2-3", trifecta_payout: 41720 };
const ENTRIES = [
  { ...KEY, boat_no: 1, arrival_order: 4 },
  { ...KEY, boat_no: 2, arrival_order: 2 },
  { ...KEY, boat_no: 3, arrival_order: 3 },
  { ...KEY, boat_no: 4, arrival_order: 1 },
  { ...KEY, boat_no: 5, arrival_order: 5 },
  { ...KEY, boat_no: 6, arrival_order: 6 },
];
const AT = (hhmm) => Date.parse(`2026-10-13T${hhmm}:00+09:00`);
const check = (overrides = {}, now = AT("11:00")) =>
  checkRaceResultConfirmed({ key: KEY, event: EVENT, result: RESULT, entries: ENTRIES, now, ...overrides });

test("全データが揃い、締切から十分たったレースだけ生成を許可する", () => {
  const result = check();
  assert.equal(result.ok, true, result.reasons.join("/"));
  assert.equal(result.trifecta, "423");
  assert.equal(result.payout, 41720);
  assert.equal(closingTimeMs("2026-10-13", "10:32:00"), Date.parse("2026-10-13T10:32:00+09:00"));
});

test("締切前は result_available=true でも生成しない（id1848 と同じ 10:00 の状況）", () => {
  const result = check({ result: undefined, event: { ...EVENT, trifecta: null, trifecta_payout: null } }, AT("10:00"));
  assert.equal(result.ok, false);
  const atTen = check({}, AT("10:00"));
  assert.equal(atTen.ok, false);
  assert.ok(atTen.reasons.some((r) => /締切/.test(r)));
  assert.equal(check({}, AT("10:35")).ok, false); // 締切直後（10分以内）
});

test("締切後でも払戻が無い・不正なら生成しない", () => {
  assert.ok(check({ event: { ...EVENT, trifecta_payout: null } }).reasons.includes("3連単の払戻がない・不正"));
  assert.ok(check({ event: { ...EVENT, trifecta_payout: 0 } }).reasons.includes("3連単の払戻がない・不正"));
  assert.ok(check({ event: { ...EVENT, trifecta: "44" } }).reasons.includes("3連単の組番がない・不正"));
  assert.ok(check({ result: { ...RESULT, trifecta_payout: 9999 } }).reasons.includes("払戻が確定結果と一致しない"));
  assert.ok(check({ result: undefined }).reasons.includes("確定結果（bs_race_results）がない"));
  assert.equal(check({ result: { ...RESULT, result_status: "pending" } }).ok, false);
});

test("払戻があっても着順が未確定・矛盾なら生成しない", () => {
  const noOrder = ENTRIES.map((e) => ({ ...e, arrival_order: null }));
  assert.ok(check({ entries: noOrder }).reasons.includes("1〜3着の確定着順がない"));
  const deadHeat = ENTRIES.map((e) => (e.boat_no === 3 ? { ...e, arrival_order: 2 } : e));
  assert.equal(check({ entries: deadHeat }).ok, false);
  const wrongOrder = ENTRIES.map((e) => (e.boat_no === 2 ? { ...e, arrival_order: 3 } : e.boat_no === 3 ? { ...e, arrival_order: 2 } : e));
  assert.ok(check({ entries: wrongOrder }).reasons.includes("着順が3連単と一致しない"));
});

test("場・日付・R番号が一致しないデータでは生成しない", () => {
  assert.ok(check({ event: { ...EVENT, race_no: 6 } }).reasons.includes("レース情報の日付・場・R番号が一致しない"));
  assert.ok(check({ result: { ...RESULT, course_code: 19 } }).reasons.includes("確定結果の日付・場・R番号が一致しない"));
  assert.ok(check({ entries: [...ENTRIES.slice(1), { ...ENTRIES[0], race_date: "2026-10-12" }] }).reasons.includes("出走データの日付・場・R番号が一致しない"));
  assert.equal(checkRaceResultConfirmed({ key: { race_date: "20261013", course_code: 18, race_no: 5 }, event: EVENT, result: RESULT, entries: ENTRIES }).ok, false);
});

test("中止・締切時刻なしは生成しない", () => {
  assert.equal(check({ event: { ...EVENT, race_cancel_code: "1" } }).ok, false);
  assert.ok(check({ event: { ...EVENT, closing_time: null } }).reasons.includes("締切時刻がない"));
});

test("同じレースの結果記事が作成済みなら重複して作らない", () => {
  const { confirmed, rejected } = confirmedRacesForArticles({ races: [KEY], events: [EVENT], results: [RESULT], entries: ENTRIES, existingKeys: new Set(["bs:result:2026-10-13:18:5"]), now: AT("11:00") });
  assert.equal(confirmed.length, 0);
  assert.deepEqual(rejected[0].reasons, ["同じレースの結果記事が作成済み"]);
});

// 読み取りだけの偽クライアント。table ごとの { data, error } を返す。
function fakeSupabase(tables) {
  return {
    from(table) {
      const q = {};
      for (const m of ["select", "eq", "in", "like", "limit", "order", "gte", "lte"]) q[m] = () => q;
      q.then = (resolve) => resolve(tables[table] || { data: [], error: null });
      return q;
    },
  };
}
const TARGET = [{ courseCode: 18, place: "徳山", rows: [{ boats: [{ race_no: 5 }] }] }];

test("収集処理：条件を満たせば結果記事を1件作り、要約に3連単と払戻を入れる", async () => {
  const db = fakeSupabase({ bs_race_events: { data: [EVENT] }, bs_race_results: { data: [RESULT] }, bs_race_entries: { data: ENTRIES }, hatsune_news: { data: [] } });
  const candidates = await collectResultCandidates(db, "2026-10-13", TARGET, AT("11:00"));
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].source_key, "bs:result:2026-10-13:18:5");
  assert.match(candidates[0].summary, /3連単4-2-3（払戻41,720円）で確定/);
});

test("収集処理：締切前（10:00）や重複は作らない", async () => {
  const db = fakeSupabase({ bs_race_events: { data: [EVENT] }, bs_race_results: { data: [RESULT] }, bs_race_entries: { data: ENTRIES }, hatsune_news: { data: [] } });
  assert.deepEqual(await collectResultCandidates(db, "2026-10-13", TARGET, AT("10:00")), []);
  const dup = fakeSupabase({ bs_race_events: { data: [EVENT] }, bs_race_results: { data: [RESULT] }, bs_race_entries: { data: ENTRIES }, hatsune_news: { data: [{ source_key: "bs:result:2026-10-13:18:5" }] } });
  assert.deepEqual(await collectResultCandidates(dup, "2026-10-13", TARGET, AT("11:00")), []);
});

test("収集処理：データ取得に失敗した・上限まで返った場合は例外にして結果記事を作らない", async () => {
  const failed = fakeSupabase({ bs_race_events: { data: [EVENT] }, bs_race_results: { data: null, error: { message: "timeout" } }, bs_race_entries: { data: ENTRIES } });
  await assert.rejects(collectResultCandidates(failed, "2026-10-13", TARGET, AT("11:00")), /bs_race_results: timeout/);
  const existingFailed = fakeSupabase({ bs_race_events: { data: [EVENT] }, bs_race_results: { data: [RESULT] }, bs_race_entries: { data: ENTRIES }, hatsune_news: { data: null, error: { message: "denied" } } });
  await assert.rejects(collectResultCandidates(existingFailed, "2026-10-13", TARGET, AT("11:00")), /hatsune_news: denied/);
  const truncated = fakeSupabase({ bs_race_events: { data: [EVENT] }, bs_race_results: { data: [RESULT] }, bs_race_entries: { data: Array.from({ length: 1000 }, () => ENTRIES[0]) }, hatsune_news: { data: [] } });
  await assert.rejects(collectResultCandidates(truncated, "2026-10-13", TARGET, AT("11:00")), /上限/);
  assert.deepEqual(await collectResultCandidates(failed, "2026-10-13", [], AT("11:00")), []);
});
