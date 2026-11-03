import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { runDraftPipeline } from "../../lib/blog/ai/pipeline.mjs";
import { memoryStore, memoryRepo, fakeCover, fakeFetch, basicsTopic, goodAi } from "./_aiFixtures.mjs";
import { rowsOf, cleanRaces } from "./_raceRows.mjs";

const NOW = () => new Date("2026-11-03T12:00:00Z");
const topic = () => ({ id: randomUUID(), topic_key: "longshot:kiryu:boat5-365", category_slug: "longshot", stadium_slug: "kiryu", angle: "boat5-365",
  title_hint: "桐生の5号艇1着率を直近1年の確定結果で検証", character_key: "kiina", status: "candidate" });
const researchAi = () => ({
  title: "桐生の5号艇1着率は12.5%、直近1年の確定結果で検証", excerpt: "桐生で5号艇が1着になった割合を、BoatStrikersの確定結果の集計から確かめます。",
  seo_title: "桐生の5号艇1着率を確定結果で検証", seo_description: "桐生で5号艇が1着になった割合を、BoatStrikersが集めた確定結果の集計から確かめます。対象期間とレース数も説明します。",
  takeaways: ["5号艇1着は200レース中25レース"],
  sections: [{ heading: "5号艇が1着になった割合", blocks: [
    { type: "text", text: "200レースのうち、5号艇が1着になったのは25レースで、12.5%でした。", items: [], turns: [], source_ids: ["D1"] },
  ] }],
  summary: "号艇とコースは別の数字なので、割合はひとつの目安として読みます。", needs_check: [],
});
function setup({ rows = rowsOf(cleanRaces({ n: 200, every5: 8, from: "2026-03-01" })), history = [] } = {}) {
  const store = memoryStore();
  const t = topic();
  store.state.topics.set(t.id, t);
  store.datasetHistory = async () => history;
  const repo = memoryRepo();
  let reads = 0, aiCalls = 0, input = null;
  const readRaceRows = async () => { reads++; return rows; };
  const callAi = async args => { aiCalls++; input = JSON.parse(args.input); return { data: researchAi(), model: "test-model" }; };
  return { store, repo, t, readRaceRows, callAi, counts: () => ({ reads, aiCalls }), input: () => input };
}

test("a research topic is written only from the gated dataset; the draft keeps the evidence and is never released", async () => {
  const s = setup();
  const result = await runDraftPipeline({ topicId: s.t.id, store: s.store, repo: s.repo, callAi: s.callAi, renderCover: fakeCover, fetchImpl: fakeFetch({}), now: NOW, readRaceRows: s.readRaceRows });
  assert.deepEqual(s.counts(), { reads: 1, aiCalls: 1 });
  assert.equal(s.input().documents.length, 0, "no fetched pages: the facts are the dataset");
  assert.ok(s.input().facts.some(f => f.label === "桐生の5号艇1着率" && f.value === "12.5"));
  const draft = s.store.state.drafts.get(result.post_id);
  assert.equal(draft.source_pack.datasets[0].definition, "boat5_win");
  assert.equal(draft.source_pack.sources[0].kind, "boatstrikers_dataset");
  assert.equal(result.issues.filter(i => i.level === "blocking" && /出典にない数値/.test(i.message)).length, 0, JSON.stringify(result.issues));
  assert.equal(s.repo.calls.release, 0);
  assert.equal(s.store.state.topics.get(s.t.id).status, "drafted");
});

test("bad or insufficient data stops before the AI is called; nothing is drafted", async () => {
  const s = setup({ rows: rowsOf(cleanRaces({ n: 40 })) });
  await assert.rejects(runDraftPipeline({ topicId: s.t.id, store: s.store, repo: s.repo, callAi: s.callAi, renderCover: fakeCover, fetchImpl: fakeFetch({}), now: NOW, readRaceRows: s.readRaceRows }),
    e => e.status === 422 && /データ品質の基準/.test(e.message) && e.evidence?.status === "hold");
  assert.equal(s.counts().aiCalls, 0);
  assert.equal(s.repo.posts.size, 0);
  assert.equal(s.store.state.topics.get(s.t.id).status, "candidate");
});

test("without a race data reader, research topics stop (503); the same research done recently stops (409)", async () => {
  const s = setup();
  await assert.rejects(runDraftPipeline({ topicId: s.t.id, store: s.store, repo: s.repo, callAi: s.callAi, renderCover: fakeCover, fetchImpl: fakeFetch({}), now: NOW }), e => e.status === 503);
  const dup = setup({ history: [{ post_id: "old", title: "前の記事", created_at: "2026-10-30T00:00:00Z",
    dataset: { definition: "boat5_win", params: { course_code: 1 }, period: { from: "2025-11-01", to: "2026-10-29" } } }] });
  await assert.rejects(runDraftPipeline({ topicId: dup.t.id, store: dup.store, repo: dup.repo, callAi: dup.callAi, renderCover: fakeCover, fetchImpl: fakeFetch({}), now: NOW, readRaceRows: dup.readRaceRows }),
    e => e.status === 409 && /同じ集計/.test(e.message));
  assert.equal(dup.counts().aiCalls, 0);
});

test("the existing stadium themes never read race data", async () => {
  const store = memoryStore();
  let reads = 0;
  await runDraftPipeline({ topicId: basicsTopic.id, store, repo: memoryRepo(), renderCover: fakeCover, now: () => new Date("2026-10-09T03:00:00Z"), fetchImpl: fakeFetch({}),
    callAi: async () => ({ data: goodAi(), model: "m" }), readRaceRows: async () => { reads++; return {}; } }).catch(() => {});
  assert.equal(reads, 0);
});
