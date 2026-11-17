import { test } from "node:test";
import assert from "node:assert/strict";
import { callOpenAIJson, usageOf, estimateCostUsd, failureKind } from "../../lib/blog/ai/openai.mjs";
import { aiConfig, MAX_CALLS_PER_DAY_DEFAULT } from "../../lib/blog/ai/config.mjs";
import { callsToday, usageNote } from "../../lib/blog/ai/daily.mjs";
import { smoke } from "../../scripts/blog/openai-smoke.mjs";

// PHASE 2: small spending limits, cost/token/time records, and failures an operator can act on (no key in any message).
const okPayload = { model: "gpt-test", usage: { input_tokens: 1200, output_tokens: 800, total_tokens: 2000, output_tokens_details: { reasoning_tokens: 100 } },
  output: [{ content: [{ type: "output_text", text: "{\"ok\":true}" }] }] };
const respond = (status, body) => async () => new Response(JSON.stringify(body), { status });

test("usage is read from the API answer; cost is estimated only from configured prices", () => {
  assert.deepEqual(usageOf(okPayload), { input_tokens: 1200, output_tokens: 800, reasoning_tokens: 100, total_tokens: 2000 });
  assert.equal(usageOf({}), null);
  assert.equal(estimateCostUsd(usageOf(okPayload), null), null, "no built-in price list");
  assert.equal(estimateCostUsd(usageOf(okPayload), { input: 1, output: 4 }), 0.0044);
});

test("configuration: small limits by default, clamped, prices optional", () => {
  const c = aiConfig({});
  assert.equal(c.maxCallsPerDay, MAX_CALLS_PER_DAY_DEFAULT);
  assert.equal(c.maxOutputTokens, 12000);
  assert.equal(c.prices, null);
  const d = aiConfig({ BLOG_AI_MAX_CALLS_PER_DAY: "999", BLOG_AI_MAX_OUTPUT_TOKENS: "10", BLOG_AI_PRICE_INPUT_PER_1M: "1.5", BLOG_AI_PRICE_OUTPUT_PER_1M: "6" });
  assert.deepEqual([d.maxCallsPerDay, d.maxOutputTokens, d.prices], [20, 1000, { input: 1.5, output: 6 }]);
  assert.equal(aiConfig({ BLOG_AI_PRICE_INPUT_PER_1M: "1" }).prices, null, "both prices are needed");
});

test("each call reports model, tokens and time once, on success and on failure; failures are classified", async () => {
  const seen = [];
  let t = 0;
  const now = () => (t += 250);
  const r = await callOpenAIJson({ fetchImpl: respond(200, okPayload), apiKey: "k", model: "m", instructions: "i", input: "x", schema: {}, schemaName: "n", now, onUsage: i => seen.push(i) });
  assert.deepEqual(r, { data: { ok: true }, model: "gpt-test" });
  assert.equal(seen.length, 1);
  assert.deepEqual([seen[0].ok, seen[0].model, seen[0].usage.output_tokens, seen[0].duration_ms], [true, "gpt-test", 800, 250]);
  for (const [status, kind] of [[401, "auth"], [429, "quota"], [402, "quota"], [403, "forbidden"], [400, "request"], [503, "upstream"]]) {
    assert.equal(failureKind(status), kind);
    const got = [];
    await assert.rejects(callOpenAIJson({ fetchImpl: respond(status, { error: { message: "secret-key-xyz" } }), apiKey: "sk-should-not-leak", model: "m", instructions: "i", input: "x", schema: {}, schemaName: "n", onUsage: i => got.push(i) }),
      e => e.kind === kind && e.upstream_status === status && !/sk-should-not-leak|secret-key-xyz/.test(e.message));
    assert.deepEqual([got.length, got[0].ok, got[0].kind], [1, false, kind]);
  }
  await assert.rejects(callOpenAIJson({ fetchImpl: async () => { throw new TypeError("fetch failed"); }, apiKey: "k", model: "m", schema: {}, schemaName: "n" }), e => e.kind === "network");
  // A recording function that throws never breaks the call.
  await callOpenAIJson({ fetchImpl: respond(200, okPayload), apiKey: "k", model: "m", schema: {}, schemaName: "n", onUsage: () => { throw new Error("x"); } });
});

test("smoke check: one tiny call, no retry, exit codes for no key / network / billing / success", async () => {
  assert.equal((await smoke({ env: {} })).exit, 2);
  let calls = 0;
  const counted = status => async () => { calls++; return new Response(JSON.stringify(status === 200 ? okPayload : { error: {} }), { status }); };
  const quota = await smoke({ env: { OPENAI_API_KEY: "k" }, fetchImpl: counted(429) });
  assert.deepEqual([quota.ok, quota.kind, quota.exit, calls], [false, "quota", 5, 1]);
  const net = await smoke({ env: { OPENAI_API_KEY: "k" }, fetchImpl: async () => { calls++; throw new TypeError("fetch failed"); } });
  assert.deepEqual([net.kind, net.exit, calls], ["network", 3, 2]);
  const ok = await smoke({ env: { OPENAI_API_KEY: "k", BLOG_AI_PRICE_INPUT_PER_1M: "1", BLOG_AI_PRICE_OUTPUT_PER_1M: "4" }, fetchImpl: counted(200) });
  assert.deepEqual([ok.ok, ok.exit, ok.usage.total_tokens, ok.estimated_cost_usd, calls], [true, 0, 2000, 0.0044, 3]);
  assert.ok(!JSON.stringify(ok).includes("\"k\""));
});

test("daily limit: calls are counted per JST day from the run records", async () => {
  const now = () => new Date("2026-11-04T16:00:00Z"); // 01:00 JST on 11-05
  const runs = [{ started_at: "2026-11-04T15:30:00.000Z" }, { started_at: "2026-11-04T15:45:00.000Z" }, { started_at: "2026-11-04T14:59:00.000Z" }];
  const store = { recentRuns: async since => runs.filter(r => r.started_at >= since) };
  assert.equal(await callsToday({ store, now }), 2, "a run before JST midnight belongs to the previous day");
  assert.match(usageNote({ usage: { input_tokens: 10, output_tokens: 20 }, duration_ms: 1500 }, null), /入力10／出力20トークン・1500ms・推定未設定/);
  assert.match(usageNote({ usage: { input_tokens: 1000000, output_tokens: 0 }, duration_ms: 1 }, { input: 2, output: 8 }), /推定\$2/);
});
