import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { runDailyCycle, characterForDate } from "../../lib/blog/ai/daily.mjs";
import { memoryStore, memoryRepo, fakeCover, fakeFetch } from "./_aiFixtures.mjs";
import { rowsOf, cleanRaces } from "./_raceRows.mjs";
import { kiinaAi } from "./_dailyAi.mjs";

// 2026-11-05 01:00 JST: the rotation gives キイナ, whose first theme is 桐生・5号艇1着 (longshot:kiryu:boat5-365).
const NOW = () => new Date("2026-11-04T16:00:00Z");
const DATE = "2026-11-05";
const GOOD_ROWS = rowsOf(cleanRaces({ n: 200, every5: 8, from: "2026-03-01" }));

// The same transitions as public.blog_ai_job_transition_allowed (database), for the in-memory store.
const ALLOWED = new Set(["PLANNED>GENERATING", "PLANNED>HOLD", "PLANNED>FAILED", "GENERATING>GENERATED", "GENERATING>HOLD", "GENERATING>FAILED",
  "GENERATED>VALIDATING", "VALIDATING>APPROVED", "VALIDATING>RETRY", "VALIDATING>HOLD", "VALIDATING>FAILED", "RETRY>GENERATING", "RETRY>HOLD", "RETRY>FAILED",
  "APPROVED>PUBLISHING", "APPROVED>HOLD", "PUBLISHING>PUBLISHED", "PUBLISHING>FAILED", "FAILED>PLANNED"]);

function harness({ settings = {}, ai = [kiinaAi()], rows = GOOD_ROWS, history = [], existing = [] } = {}) {
  const store = memoryStore();
  store.state.topics.clear();
  const jobs = new Map(), gateResults = [], published = [];
  const answers = [...ai];
  let aiCalls = 0;
  Object.assign(store, {
    aiSettings: async () => ({ approval_mode: "manual", auto_publish_enabled: false, generation_enabled: true, publish_time: "06:00:00", ...settings }),
    async claimJob(date, character, owner) {
      if (!jobs.has(date)) jobs.set(date, { publish_date: date, character_key: character, state: "PLANNED", attempt: 0, history: [], lease_owner: null, lease_until: 0 });
      const j = jobs.get(date);
      if (["PUBLISHED", "HOLD"].includes(j.state)) return { claimed: false, reason: "finished", job: { ...j } };
      if (j.lease_owner && j.lease_owner !== owner && j.lease_until > Date.now()) return { claimed: false, reason: "leased", job: { ...j } };
      Object.assign(j, { lease_owner: owner, lease_until: Date.now() + 900000 });
      return { claimed: true, job: { ...j } };
    },
    async moveJob(date, owner, to, patch = {}) {
      const j = jobs.get(date);
      if (j.lease_owner !== owner) throw new Error("BLOG_AI_JOB_NOT_LEASED");
      if (!ALLOWED.has(`${j.state}>${to}`)) throw new Error(`BLOG_AI_JOB_INVALID_TRANSITION ${j.state}>${to}`);
      const attempt = j.state === "RETRY" && to === "GENERATING" ? j.attempt + 1 : j.attempt;
      if (attempt > 2) throw new Error("check attempt");
      j.history.push({ from: j.state, to });
      Object.assign(j, { ...patch, state: to, attempt }, ["PUBLISHED", "HOLD", "FAILED"].includes(to) ? { lease_owner: null, lease_until: 0 } : {});
      return { ...j };
    },
    async releaseJob(date, owner) { const j = jobs.get(date); if (j?.lease_owner === owner) Object.assign(j, { lease_owner: null, lease_until: 0 }); return true; },
    async recordGateResult(postId, version, result) { const id = randomUUID(); gateResults.push({ id, post_id: postId, version, verdict: result.verdict, result }); return { gate_result_id: id }; },
    async articleTexts() { return existing; },
    async datasetHistory() { return history; },
    async autoPublish(postId, version, gateId) { published.push({ postId, version, gateId }); return { approval_id: "a1" }; },
  });
  const repo = memoryRepo();
  const callAi = async () => {
    aiCalls++;
    const next = answers.length > 1 ? answers.shift() : answers[0];
    if (next instanceof Error) throw next;
    return { data: next, model: "test-model" };
  };
  const run = (owner = "run-1", now = NOW) => runDailyCycle({ store, repo, callAi, renderCover: fakeCover, readRaceRows: async () => rows, fetchImpl: fakeFetch({}), owner, now });
  return { store, repo, jobs, gateResults, published, run, aiCalls: () => aiCalls, job: () => jobs.get(DATE) };
}

test("rotation: 一果 → 初音 → キイナ by JST date", () => {
  assert.deepEqual(["2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06"].map(d => characterForDate(d).character), ["ichika", "hatsune", "kiina", "ichika"]);
});

test("generation off: nothing is claimed or generated", async () => {
  const h = harness({ settings: { generation_enabled: false } });
  assert.equal((await h.run()).status, "disabled");
  assert.equal(h.jobs.size, 0);
  assert.equal(h.aiCalls(), 0);
});

test("7-day mode (auto-publish off): real-data topic → draft → seven gates PASS → APPROVED draft, nothing published", async () => {
  const h = harness();
  const r = await h.run();
  assert.equal(r.status, "approved_draft", JSON.stringify(r));
  assert.equal(h.job().state, "APPROVED");
  assert.equal(h.job().character_key, "kiina");
  assert.deepEqual(h.job().history.map(x => x.to), ["GENERATING", "GENERATED", "VALIDATING", "APPROVED"]);
  assert.equal(h.gateResults.length, 1);
  assert.equal(h.gateResults[0].verdict, "PASS");
  assert.equal(h.published.length, 0);
  assert.equal(h.repo.calls.release, 0);
  const topic = [...h.store.state.topics.values()][0];
  assert.equal(topic.topic_key, "longshot:kiryu:boat5-365");
  // Later calls the same day do not generate again.
  assert.equal((await h.run("run-2")).status, "approved_draft");
  assert.equal(h.aiCalls(), 1);
});

test("double run: a second runner during the lease does nothing", async () => {
  const h = harness();
  await h.store.claimJob(DATE, "kiina", "other-runner");
  const r = await h.run("run-1");
  assert.deepEqual([r.status, r.reason], ["skipped", "leased"]);
  assert.equal(h.aiCalls(), 0);
});

test("AI API error: FAILED with no draft, then restarted by the next call with the same topic", async () => {
  const h = harness({ ai: [Object.assign(new Error("AIの呼び出しに失敗しました（500）。"), { status: 502 }), kiinaAi()] });
  const first = await h.run();
  assert.equal(first.status, "failed");
  assert.equal(h.job().state, "FAILED");
  assert.equal(h.repo.posts.size, 0);
  assert.equal(h.store.state.runs.at(-1).status, "failed");
  const second = await h.run("run-2");
  assert.equal(second.status, "approved_draft", JSON.stringify(second));
  assert.equal(h.store.state.topics.size, 1, "the same topic is reused");
});

test("repeated AI errors stop after two restarts", async () => {
  const h = harness({ ai: [Object.assign(new Error("timeout"), { status: 502 })] });
  for (let i = 0; i < 3; i++) assert.equal((await h.run(`run-${i}`)).status, "failed");
  const r = await h.run("run-x");
  assert.equal(r.status, "failed");
  assert.equal(h.aiCalls(), 3);
});

test("RETRY: a fixable problem is regenerated (attempt 1, new slug); a second success passes", async () => {
  const bad = { ...kiinaAi(), title: "短い題" };
  const h = harness({ ai: [bad, kiinaAi()] });
  const first = await h.run();
  assert.equal(first.status, "paused", "one generation per call");
  assert.equal(h.job().state, "GENERATING");
  assert.equal(h.gateResults[0].verdict, "RETRY");
  const second = await h.run("run-2");
  assert.equal(second.status, "approved_draft", JSON.stringify(second));
  assert.equal(h.job().attempt, 1);
  assert.ok([...h.repo.posts.values()].some(p => p.slug.endsWith("-r1")));
});

test("RETRY twice more becomes HOLD after the last allowed regeneration", async () => {
  const bad = { ...kiinaAi(), title: "短い題" };
  const h = harness({ ai: [bad] });
  for (let i = 0; i < 3; i++) await h.run(`run-${i}`);
  assert.equal(h.job().state, "HOLD");
  assert.equal(h.job().attempt, 2);
  assert.deepEqual(h.gateResults.map(g => g.verdict), ["RETRY", "RETRY", "HOLD"]);
  assert.equal(h.gateResults[2].result.reason, "retry_exhausted");
  assert.deepEqual([(await h.run("late")).status], ["skipped"]);
});

test("number tampering in the AI answer holds the article", async () => {
  const forged = kiinaAi();
  forged.sections[1].blocks[0].text = forged.sections[1].blocks[0].text.replace("25レース", "35レース");
  const h = harness({ ai: [forged] });
  const r = await h.run();
  assert.equal(r.status, "hold");
  assert.equal(h.gateResults[0].verdict, "HOLD");
  assert.equal(h.gateResults[0].result.gates.data_integrity.verdict, "HOLD");
});

test("missing source in the AI answer: a cited figure without its source holds", async () => {
  const unsourced = kiinaAi();
  unsourced.sections[1].blocks[0].source_ids = [];
  unsourced.sections[1].blocks.push({ type: "text", text: "参考：https://example.com/stats", items: [], turns: [], source_ids: [] });
  const h = harness({ ai: [unsourced] });
  await h.run();
  assert.notEqual(h.gateResults[0].verdict, "PASS");
});

test("data shortage or defects hold before the AI is called", async () => {
  const h = harness({ rows: rowsOf(cleanRaces({ n: 40, from: "2026-03-01" })) });
  const r = await h.run();
  assert.equal(r.status, "hold");
  assert.match(h.job().last_error, /データ品質の基準/);
  assert.equal(h.aiCalls(), 0);
});

test("similar article: the same research already drafted holds before the AI is called", async () => {
  const history = [{ post_id: "old", title: "前の記事", created_at: "2026-10-30T00:00:00Z", dataset: { definition: "boat5_win", params: { course_code: 1 }, period: { from: "2025-11-01", to: "2026-10-29" } } }];
  const h = harness({ history });
  assert.equal((await h.run()).status, "hold");
  assert.equal(h.aiCalls(), 0);
});

test("similar body of an existing article holds at the duplicate gate", async () => {
  const h0 = harness();
  await h0.run();
  const existingDoc = [...h0.repo.posts.values()][0].document;
  const h = harness({ existing: [{ post_id: "other", title: "別の記事", document: existingDoc }] });
  assert.equal((await h.run()).status, "hold");
  assert.equal(h.gateResults[0].result.gates.duplicates.verdict, "HOLD");
});

test("automatic mode on: publishes only through blog_ai_auto_publish after the publication time", async () => {
  const h = harness({ settings: { approval_mode: "auto", auto_publish_enabled: true } });
  assert.equal((await h.run()).status, "waiting", "01:00 JST is before 06:00");
  assert.equal(h.published.length, 0);
  const r = await h.run("run-2", () => new Date("2026-11-04T21:05:00Z"));
  assert.equal(r.status, "published");
  assert.equal(h.published.length, 1);
  assert.equal(h.published[0].gateId, h.job().gate_result_id);
  assert.equal(h.repo.calls.release, 0, "never through the plain release path");
});

test("spending limit: when the day's AI calls are used up, nothing is generated and the job waits", async () => {
  const h = harness();
  const r = await runDailyCycle({ store: h.store, repo: h.repo, callAi: async () => assert.fail("no AI call over the limit"), renderCover: fakeCover,
    readRaceRows: async () => GOOD_ROWS, fetchImpl: fakeFetch({}), owner: "run-1", now: NOW, maxCallsPerDay: 0 });
  assert.equal(r.status, "budget_exhausted");
  assert.equal(h.job().state, "GENERATING");
  assert.equal(h.repo.posts.size, 0);
  // The next call with allowance continues the same job; tokens and time are written to the run record.
  const h2 = harness();
  h2.store.recentRuns = async () => [];
  const ok = await runDailyCycle({ store: h2.store, repo: h2.repo, renderCover: fakeCover, readRaceRows: async () => GOOD_ROWS, fetchImpl: fakeFetch({}), owner: "run-1", now: NOW, maxCallsPerDay: 1,
    callAi: async args => { args.onUsage?.({ model: "m", usage: { input_tokens: 5000, output_tokens: 3000 }, duration_ms: 42000, ok: true }); return { data: kiinaAi(), model: "m" }; } });
  assert.equal(ok.status, "approved_draft");
  assert.match(h2.store.state.runs.at(-1).message, /入力5000／出力3000トークン・42000ms/);
  const draft = [...h2.store.state.drafts.values()][0];
  assert.deepEqual(draft.source_pack.generation.usage, { input_tokens: 5000, output_tokens: 3000 });
});

test("emergency stop between approval and publication: the database refusal leaves the job FAILED, nothing published", async () => {
  const h = harness({ settings: { approval_mode: "auto", auto_publish_enabled: true, publish_time: "00:00:00" } });
  h.store.autoPublish = async () => { throw new Error("BLOG_AI_AUTO_PUBLISH_DISABLED"); };
  const r = await h.run();
  assert.equal(r.status, "failed");
  assert.match(h.job().last_error, /BLOG_AI_AUTO_PUBLISH_DISABLED/);
});
