// AI記事生成API（ai-write）の「変更前（原本）」と「変更後」で、
// OpenAIへ送るリクエスト（プロンプト含む）とAPIの応答が一致することを確認する。
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { ROOT, FakeNextResponse, loadRouteModule, postRequest, createFakeSupabase } from "./helpers.mjs";

const EXHIBITION_TABLES = {
  bs_race_events: [
    { race_date: "2026-10-08", race_no: 6, course_code: 15, course_name: "丸亀" },
    { race_date: "2026-10-08", race_no: 1, course_code: 17, course_name: "宮島" },
  ],
  bs_race_entries: [
    { race_date: "2026-10-08", course_code: 15, race_no: 6, boat_no: 1, official_exhibition_time: 6.78, exhibition_time: 6.9, official_exhibition_st: "0.12", official_exhibition_course: 1, official_lap: null, lap_time: "37.1", official_turn: null, official_straight: 7.1, official_exhibition_source: "official" },
    { race_date: "2026-10-08", course_code: 15, race_no: 6, boat_no: 2, exhibition_time: "6.71", api_exhibition_st: "F.05", exhibition_course: "2", straight_time: 6.95, exhibition_source: "api" },
    { race_date: "2026-10-08", course_code: 15, race_no: 6, boat_no: 3 },
    { race_date: "2026-10-08", course_code: 15, race_no: 6, boat_no: 7, official_exhibition_time: 6.5 },
  ],
};

function okResponse(json, ok = true, status = 200) {
  return { ok, status, json: async () => json };
}

const AI_JSON = { summary: "要約です", articleBody: "## 本文\n一果の記事", noteTitle: "noteタイトル", noteBody: "note本文" };

const RESPONSES = {
  outputText: () => okResponse({ output_text: JSON.stringify(AI_JSON) }),
  outputArray: () => okResponse({ output: [{ content: [{ type: "output_text", text: "```json\n" + JSON.stringify(AI_JSON) + "\n```" }, { type: "reasoning", text: "x" }] }] }),
  emptyBody: () => okResponse({ output_text: JSON.stringify({ ...AI_JSON, noteBody: "" }) }),
  brokenJson: () => okResponse({ output_text: "これはJSONではありません" }),
  apiError: () => okResponse({ error: { message: "rate limited" } }, false, 429),
  apiErrorNoMessage: () => okResponse({}, false, 500),
};

const ICHIKA_PAYLOAD = {
  date: "2026-10-08", course: "宮島", raceNo: "1", edition: "previous_day", mainCopy: "宮島1R、イン逃げ期待84.2%！", escapeRate: "84.2", nationalAverage: "73",
  speech: "相手関係も見よう！", honmeiBoat: "1", honmeiTitle: "イン逃げで信頼度◎", honmeiComment: "前日AI公式買い目は 1-2-3 / 1-3-2。", ichikaComment: "一果の公式コメント",
  exhibition1: "行き足が軽い", aiTickets: ["1-2-3", "1-3-2", 5, ""], aiUnitStake: 100, aiInvestment: "200", aiRankNo: 1, topExpression: "wink",
};
const HATSUNE_PAYLOAD = {
  date: "2026-10-08", course: "丸亀", raceNo: "6", edition: "just_before", headline: "初音の女子戦ポイント♪", featuredBoat: "2", expectation: "44.0", comment: "初音コメント",
  checkpoints: ["2号艇 当地勝率7.40", { bad: true }, "2号艇 平均ST0.14", "", "x", "y", "z", "w"], aiCategory: "インが不安", scores: { 1: "72", 2: "66.5", 3: "abc", 7: "50" },
  aiTickets: ["2-1-3"], aiUnitStake: 100, aiInvestment: 100,
};
const KIINA_PAYLOAD = {
  date: "2026-10-08", course: "宮島", raceNo: "1", edition: "previous_day", headline: "キイナの穴狙いメモ！", holeBoat: "5", holeChance: "16.2", callout: "5号艇に注目！",
  kiinaComment: "展開がハマれば一発！", scores: { 1: "60", 5: "81" }, aiTickets: [], aiUnitStake: "x", aiInvestment: null,
};

function bodyFor(character, sourcePayload, extra = {}) {
  return {
    character,
    source: { character, date: sourcePayload.date, course: sourcePayload.course, raceNo: sourcePayload.raceNo, edition: sourcePayload.edition, headline: sourcePayload.headline || sourcePayload.mainCopy },
    sourcePayload,
    draft: { title: "【10/8 前日版】宮島1R｜一果新聞", summary: "要約", articleBody: "本文", noteTitle: "note", noteBody: "note本文", extra: { nested: true } },
    length: "standard",
    ...extra,
  };
}

const CASES = [
  ["一果・前日版", bodyFor("ichika", ICHIKA_PAYLOAD)],
  ["一果・直前版（展示データなし）", bodyFor("ichika", { ...ICHIKA_PAYLOAD, edition: "just_before" })],
  ["一果・短め", bodyFor("ichika", ICHIKA_PAYLOAD, { length: "short" })],
  ["一果・詳細", bodyFor("ichika", ICHIKA_PAYLOAD, { length: "detailed" })],
  ["一果・不明な長さ", bodyFor("ichika", ICHIKA_PAYLOAD, { length: "huge" })],
  ["初音・直前版（展示データあり）", bodyFor("hatsune", HATSUNE_PAYLOAD)],
  ["初音・前日版", bodyFor("hatsune", { ...HATSUNE_PAYLOAD, edition: "previous_day" })],
  ["キイナ・前日版", bodyFor("kiina", KIINA_PAYLOAD)],
  ["キイナ・直前版", bodyFor("kiina", { ...KIINA_PAYLOAD, edition: "just_before", course: "丸亀", raceNo: "6" })],
  ["source なし（sourcePayload から補完）", { character: "kiina", sourcePayload: KIINA_PAYLOAD }],
  ["draft なし", { character: "hatsune", source: { date: "2026-10-08", course: "丸亀", raceNo: "6", edition: "previous_day" }, sourcePayload: { comment: "c" } }],
  ["数値でない値・オブジェクト混入", bodyFor("ichika", { ...ICHIKA_PAYLOAD, escapeRate: "八十", nationalAverage: { v: 1 }, honmeiBoat: "1号艇" })],
  ["未対応キャラクター", { character: "grade", source: { date: "2026-10-08", course: "宮島", raceNo: "1" } }],
  ["日付なし", bodyFor("ichika", { ...ICHIKA_PAYLOAD, date: "" }, { source: { course: "宮島", raceNo: "1" } })],
  ["レース番号なし", bodyFor("ichika", { ...ICHIKA_PAYLOAD, raceNo: "" }, { source: { date: "2026-10-08", course: "宮島" } })],
  ["空のbody", {}],
];

async function loadPair({ authenticated = true, supabaseFails = false } = {}) {
  const state = { supabaseCalls: 0 };
  const stubs = {
    "next/server": { NextResponse: FakeNextResponse },
    "/admin/sync/_lib/adminAuth": { isAdminAuthenticated: async () => authenticated },
    "/lib/aiAdminSupabase": {
      getAiAdminSupabase: () => {
        state.supabaseCalls += 1;
        if (supabaseFails) throw new Error("Supabase環境変数が未設定です");
        return createFakeSupabase(EXHIBITION_TABLES);
      },
    },
  };
  const legacy = await loadRouteModule({ sourcePath: path.join(ROOT, "tests/newspaper/legacy/ai-write.js.txt"), stubs });
  const current = await loadRouteModule({ sourcePath: path.join(ROOT, "app/api/admin/newspapers/ai-write/route.js"), stubs });
  return { legacy, current, state };
}

async function capture(handler, body, responseFactory) {
  const requests = [];
  const savedFetch = globalThis.fetch;
  const savedError = console.error;
  console.error = () => {};
  globalThis.fetch = async (url, options) => {
    requests.push({ url, method: options.method, headers: options.headers, body: JSON.parse(options.body), hasSignal: options.signal instanceof AbortSignal });
    return responseFactory();
  };
  try {
    const response = await handler(postRequest(body));
    return { response, requests };
  } finally {
    globalThis.fetch = savedFetch;
    console.error = savedError;
  }
}

function withEnv(values, fn) {
  const keys = ["OPENAI_API_KEY", "OPENAI_NEWSPAPER_MODEL"];
  const saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  for (const key of keys) { if (values[key] === undefined) delete process.env[key]; else process.env[key] = values[key]; }
  return Promise.resolve().then(fn).finally(() => {
    for (const key of keys) { if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key]; }
  });
}

for (const env of [
  { OPENAI_API_KEY: "sk-test", OPENAI_NEWSPAPER_MODEL: undefined },
  { OPENAI_API_KEY: "  sk-test  ", OPENAI_NEWSPAPER_MODEL: " custom-model " },
]) {
  test(`プロンプト・OpenAIリクエスト・応答が変更前と一致する（model=${env.OPENAI_NEWSPAPER_MODEL ?? "既定"}）`, async () => {
    await withEnv(env, async () => {
      const { legacy, current } = await loadPair();
      let promptsCompared = 0;
      for (const [label, body] of CASES) {
        for (const [responseLabel, factory] of Object.entries(RESPONSES)) {
          const before = await capture(legacy.POST, body, factory);
          const after = await capture(current.POST, body, factory);
          assert.deepStrictEqual(after.response, before.response, `${label} / ${responseLabel}`);
          assert.deepStrictEqual(after.requests, before.requests, `${label} / ${responseLabel}`);
          promptsCompared += before.requests.length;
        }
      }
      assert.ok(promptsCompared >= 60, `比較したプロンプト数: ${promptsCompared}`);
    });
  });
}

test("直前版の公式展示データがプロンプトに入り、その内容も変更前と一致する", async () => {
  await withEnv({ OPENAI_API_KEY: "sk-test" }, async () => {
    const { legacy, current } = await loadPair();
    const body = bodyFor("hatsune", HATSUNE_PAYLOAD);
    const before = await capture(legacy.POST, body, RESPONSES.outputText);
    const after = await capture(current.POST, body, RESPONSES.outputText);
    assert.match(before.requests[0].body.input, /"officialExhibition"/);
    assert.equal(after.requests[0].body.input, before.requests[0].body.input);
  });
});

test("展示データ取得に失敗しても変更前と同じく展示なしで生成する", async () => {
  await withEnv({ OPENAI_API_KEY: "sk-test" }, async () => {
    const { legacy, current, state } = await loadPair({ supabaseFails: true });
    const savedError = console.error;
    console.error = () => {};
    try {
      const body = bodyFor("hatsune", HATSUNE_PAYLOAD);
      const before = await capture(legacy.POST, body, RESPONSES.outputText);
      const after = await capture(current.POST, body, RESPONSES.outputText);
      assert.deepStrictEqual(after, before);
      assert.doesNotMatch(after.requests[0].body.input, /"officialExhibition"/);
      assert.equal(state.supabaseCalls, 2);
    } finally {
      console.error = savedError;
    }
  });
});

test("APIキー未設定は変更前と同じ503で、OpenAIを呼ばない", async () => {
  await withEnv({ OPENAI_API_KEY: "   " }, async () => {
    const { legacy, current } = await loadPair();
    const before = await capture(legacy.POST, CASES[0][1], RESPONSES.outputText);
    const after = await capture(current.POST, CASES[0][1], RESPONSES.outputText);
    assert.deepStrictEqual(after, before);
    assert.equal(after.response.status, 503);
    assert.equal(after.requests.length, 0);
  });
});

test("未認証は変更前と同じ401で、OpenAIを呼ばない", async () => {
  await withEnv({ OPENAI_API_KEY: "sk-test" }, async () => {
    const { legacy, current } = await loadPair({ authenticated: false });
    const before = await capture(legacy.POST, CASES[0][1], RESPONSES.outputText);
    const after = await capture(current.POST, CASES[0][1], RESPONSES.outputText);
    assert.deepStrictEqual(after, before);
    assert.deepStrictEqual(after.response, { status: 401, body: { error: "unauthorized" } });
    assert.equal(after.requests.length, 0);
  });
});
