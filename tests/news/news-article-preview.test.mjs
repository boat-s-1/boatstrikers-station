import test from "node:test";
import assert from "node:assert/strict";

import { buildNewsArticleDraft } from "../../lib/newsArticle/draft.js";
import { buildNewsArticleDraftWithDb } from "../../lib/newsArticle/draftWithDb.js";
import { dataCheckRequest } from "../../lib/newsArticle/dataCheck.js";
import { extractNewsFacts } from "../../lib/newsArticle/newsFacts.js";
import { buildPreviewModel, detectLegacyBodyIssues } from "../../lib/newsArticle/preview.js";
import { buildAiFactPrompt, parseAiFactOutput, validateAiFacts } from "../../lib/newsArticle/aiFacts.js";

// select 系だけを持つ偽の Supabase クライアント。表ごとに返す行を指定し、呼ばれた表を記録する。
function fakeSupabase(tables) {
  const calls = [];
  return {
    calls,
    from(table) {
      const q = { filters: {} };
      for (const m of ["select", "eq", "gte", "lte", "order", "range", "limit", "in"]) {
        q[m] = (...args) => {
          calls.push(`${table}.${m}`);
          if (m === "eq") q.filters[args[0]] = args[1];
          return q;
        };
      }
      q.then = (resolve) => resolve({ data: typeof tables[table] === "function" ? tables[table](q.filters) : tables[table] || [], error: null });
      return q;
    },
    insert: () => assert.fail("insert"),
    update: () => assert.fail("update"),
    rpc: () => assert.fail("rpc"),
  };
}

const ROW = {
  id: 10,
  title: "【ボートレース】守田俊介がイン逃げを決めて今年３度目の優勝／若松ミッド [0:37]",
  summary: "若松ミッド11Rの優勝戦で、1枠の守田俊介がイン逃げを決め、今年3度目の優勝を飾った。",
  article_body: "『守田俊介の記事』について、BoatStrikersが要点をまとめます。開催地に関する今回の情報は、女子戦をチェックするうえで見逃せない材料のひとつです。",
  category: "result",
  source_type: "news",
  source_name: "日刊スポーツ",
  source_url: "https://www.nikkansports.com/public_race/news/202610100000001.html",
  published_at: "2026-10-10T01:00:27Z",
};

const ENTRY = { race_date: "2026-10-09", course_code: 20, race_no: 11, boat_no: 1, racer_registration_no: "03721", racer_name: "守田　俊介", racer_class: "A1", motor_no: 45, motor_2_rate: 37.98, actual_course: 1, actual_start_timing: 0.04, arrival_order: 1 };
const EVENT = { race_date: "2026-10-09", course_code: 20, race_no: 11, race_kind_code: "0021", closing_time: "22:30:00", trifecta: "125", trifecta_payout: 390, trifecta_popularity: 2 };
const RESULT = { race_date: "2026-10-09", course_code: 20, race_no: 11, winning_technique: "逃げ", winning_trifecta: "1-2-5", trifecta_payout: 390, trifecta_popularity: 2 };

test("照合範囲は記事の場と公開日（6日前〜公開日）で決まり、場が分からない記事はレースデータを読まない", () => {
  assert.deepEqual(dataCheckRequest(ROW, extractNewsFacts(ROW)), { courseCode: 20, from: "2026-10-04", to: "2026-10-10" });
  const column = { ...ROW, title: "SGチャレンジカップ盛り上げ企画 コラム 第２回", summary: "" };
  assert.equal(dataCheckRequest(column, extractNewsFacts(column)), null);
});

test("DB から読み取って照合する（読み取りだけ・決まり手は結果テーブルの文字列を使う）", async () => {
  const db = fakeSupabase({ bs_race_entries: [ENTRY], bs_race_events: [EVENT], bs_race_results: [RESULT], bs_grade_race_events: [] });
  const { draft, request } = await buildNewsArticleDraftWithDb(ROW, db);
  assert.equal(request.courseCode, 20);
  assert.equal(draft.dataCheck.kind, "racer");
  assert.equal(draft.dataCheck.checks.find((c) => c.item === "決まり手").result, "一致");
  assert.equal(draft.dataCheck.checks.find((c) => c.item === "優勝戦").result, "一致");
  assert.ok(db.calls.every((c) => /\.(select|eq|gte|lte|order|range|limit|in)$/.test(c)));
});

test("取得件数が上限（1000件）に達した場合は照合しない", async () => {
  const many = Array.from({ length: 1000 }, (_, i) => ({ ...ENTRY, race_no: (i % 12) + 1, boat_no: (i % 6) + 1 }));
  const db = fakeSupabase({ bs_race_entries: many, bs_race_events: [EVENT], bs_race_results: [RESULT] });
  const { draft, raceDataMeta } = await buildNewsArticleDraftWithDb(ROW, db);
  assert.deepEqual(raceDataMeta.truncated, ["bs_race_entries"]);
  assert.equal(draft.dataCheck, null);
  assert.match(draft.dataCheckSkipped, /上限/);
});

test("読み取りエラーのときは DATA CHECK を省略し、試作は止めない", async () => {
  const db = fakeSupabase({});
  db.from = () => ({ select() { return this; }, eq() { return this; }, gte() { return this; }, lte() { return this; }, order() { return this; }, range() { return this; }, then: (resolve) => resolve({ data: null, error: { message: "permission denied" } }) });
  const { draft, loadError } = await buildNewsArticleDraftWithDb(ROW, db);
  assert.match(loadError, /permission denied/);
  assert.equal(draft.dataCheck, null);
  assert.ok(draft.newsFact.lead);
});

test("選手名だけ一致しても、場・期間が違えば採用しない", async () => {
  const otherVenue = { ...ENTRY, course_code: 19 };
  const late = { ...ENTRY, race_date: "2026-10-11" }; // 公開日より後
  const db = fakeSupabase({ bs_race_entries: (f) => (f.course_code === 20 ? [late] : [otherVenue]), bs_race_events: [], bs_race_results: [] });
  const { draft } = await buildNewsArticleDraftWithDb(ROW, db);
  assert.equal(draft.dataCheck, null);
});

test("日次まとめは bs_race_events から数え直し、日次まとめテーブルの決まり手・逃げ件数は使わない", () => {
  const row = { id: 11, title: "【10月11日】ボートレース結果まとめ｜万舟・事故・優勝戦", list_headline: "10月11日結果｜万舟2本・最高147,880円", summary: "10月11日のボートレースは2場・3レースを集計し、万舟券が2本出現した。", source_type: "bs_data", published_at: "2026-10-11T14:10:37Z" };
  const dailyEvents = [
    { race_date: "2026-10-11", course_code: 12, course_name: "住之江", race_no: 3, closing_time: "11:30:00", trifecta: "364", trifecta_payout: 147880 },
    { race_date: "2026-10-11", course_code: 12, course_name: "住之江", race_no: 4, closing_time: "12:00:00", trifecta: "123", trifecta_payout: 900 },
    { race_date: "2026-10-11", course_code: 15, course_name: "丸亀", race_no: 10, closing_time: "19:39:00", trifecta: "436", trifecta_payout: 105660 },
    { race_date: "2026-10-11", course_code: 15, course_name: "丸亀", race_no: 11, closing_time: "20:10:00", trifecta: "", trifecta_payout: null, race_cancel_code: "1" },
  ];
  const digests = [{ race_date: "2026-10-11", race_count: 99, venue_count: 9, manshu_count: 99, manshu: [], data_lab: { escape_wins: 24 }, featured_races: [{ winning_technique: "抜き" }] }];
  const draft = buildNewsArticleDraft(row, { dailyEvents, digests });
  const rows = Object.fromEntries(draft.dataCheck.rows.map((r) => [r.label, r.value]));
  assert.equal(rows["集計"], "2場・3レース");
  assert.match(rows["最高配当"], /住之江3R 3-6-4 147,880円/);
  assert.doesNotMatch(draft.text, /抜き|逃げ/);
  assert.equal(draft.dataCheck.checks.find((c) => c.item === "万舟本数").result, "一致");
});

test("Preview：採用可否・旧本文の問題・照合根拠を並べる", () => {
  const draft = buildNewsArticleDraft(ROW, { entries: [ENTRY], races: [{ ...EVENT, ...RESULT }] });
  const model = buildPreviewModel(ROW, { draft, request: { courseCode: 20, from: "2026-10-04", to: "2026-10-10" }, loadError: "", raceDataMeta: { truncated: [] } });
  assert.equal(model.status.label, "採用可");
  assert.deepEqual(model.legacyIssues, ["旧テンプレートの定型文", "女子戦テンプレート"]);
  assert.match(model.evidence.request, /場コード 20／2026-10-04 〜 2026-10-10/);
  assert.equal(model.evidence.series[0].st, ".04");
  assert.equal(model.insufficientOptions, null);
});

test("Preview：材料不足の記事は3つの表示案（A 事実＋出典／B 現在の本文／C 導線を抑える）を作る", () => {
  const row = { ...ROW, id: 12, title: "SGチャレンジカップ盛り上げ企画 松本日向コラム 第２回／常滑ボート [7:01]", summary: "こんにちは、松本日向です ！ 男子で注目したいのは丸野一樹選手。…", category: "grade" };
  const draft = buildNewsArticleDraft(row, {});
  const model = buildPreviewModel(row, { draft, request: null, loadError: "", raceDataMeta: null });
  assert.equal(model.status.label, "材料不足");
  assert.equal(model.insufficientOptions.A.sourceUrl, ROW.source_url);
  assert.equal(model.insufficientOptions.B.body, row.article_body);
  assert.ok(model.insufficientOptions.C.headline.startsWith("SGチャレンジカップ"));
});

test("旧本文の女子戦テンプレートは、女子関連の記事では問題にしない", () => {
  assert.deepEqual(detectLegacyBodyIssues({ ...ROW, category: "women" }), ["旧テンプレートの定型文"]);
});

test("AI 抽出：入力は見出しと完結した要約文だけ、根拠の一字一句一致と数値の出どころを検証する", () => {
  const row = { title: "【ボートレース】黒野元基が優出一番乗り「G1初優勝を目指して頑張ります」／児島", summary: "黒野元基（30＝愛知）は予選2位通過で10Rの出番となった。優出一番乗りを果たした。インから好スタートを決めて先マイ…" };
  const prompt = buildAiFactPrompt(row);
  assert.deepEqual(prompt.segments.map((s) => s.id), ["H", "S1", "S2"]);
  assert.ok(!prompt.user.includes("…"));
  const facts = parseAiFactOutput('```json\n{"facts":[' +
    '{"kind":"result","text":"黒野元基が予選2位で通過した。","evidence":[{"segment":"S1","quote":"予選2位通過"}]},' +
    '{"kind":"result","text":"黒野元基(30=愛知)が10Rで勝利した。","evidence":[{"segment":"S1","quote":"10Rの出番となった"}]},' +
    '{"kind":"result","text":"黒野元基が優出一番乗りを決めた。","evidence":[{"segment":"S2","quote":"優出一番乗りを決めた"}]},' +
    '{"kind":"record","text":"黒野元基はG1初優勝を目指す。","evidence":[{"segment":"H","quote":"G1初優勝を目指して頑張ります"}]},' +
    '{"kind":"quote","text":"黒野元基「G1初優勝を目指して頑張ります」","evidence":[{"segment":"H","quote":"「G1初優勝を目指して頑張ります」"}]},' +
    '{"kind":"other","text":"次節も優勝が期待される。","evidence":[{"segment":"S2","quote":"優出一番乗りを果たした"}]}' +
    "]}\n```");
  const { accepted, rejected } = validateAiFacts(row, facts);
  assert.deepEqual(accepted.map((f) => f.text), ["黒野元基が予選2位で通過した。", "黒野元基「G1初優勝を目指して頑張ります」"]);
  const reasons = rejected.map((r) => r.reasons.join("/"));
  assert.match(reasons[0], /根拠に無い数値: 30/);
  assert.match(reasons[1], /一字一句一致しない/);
  assert.match(reasons[2], /目標・展望/);
  assert.match(reasons[3], /推測・評価/);
  assert.equal(parseAiFactOutput("not json"), null);
});
