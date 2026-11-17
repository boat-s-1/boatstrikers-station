import { test } from "node:test";
import assert from "node:assert/strict";
import { runQualityGates, canAutoPublish, REQUIRED_GATES, MAX_RETRIES } from "../../lib/blog/ai/gates.mjs";
import { validateAiDocument } from "../../lib/blog/ai/validate.mjs";
import { computeDataset } from "../../lib/blog/ai/data/datasets.mjs";
import { validateDocument } from "../../lib/blog/document.mjs";
import { rowsOf, cleanRaces } from "./_raceRows.mjs";
import { researchFixture, goodDocument, NOW, PERIOD } from "./_gateFixtures.mjs";

function run(mutate = d => d, { attempt = 0, datasets, duplicates = [], pack: packOverride } = {}) {
  const { evidence, pack } = researchFixture();
  const p = packOverride ? packOverride(pack) : pack;
  const document = mutate(goodDocument());
  const validation = validateAiDocument({ document, pack: p });
  return runQualityGates({ document, pack: p, validation, datasets: datasets ?? [{ stored: evidence, recomputed: evidence }], duplicates, attempt });
}
const gateOf = (r, key) => r.gates[key];
const codes = (r, key) => gateOf(r, key).issues.map(i => i.code);
const text = (d, i, value) => { d.blocks[i].data.text = value; return d; };

test("the reference research article passes all seven gates and may be published automatically", () => {
  validateDocument(goodDocument());
  const r = run();
  assert.equal(r.verdict, "PASS", JSON.stringify(r.gates));
  assert.deepEqual(Object.keys(r.gates), REQUIRED_GATES);
  assert.ok(REQUIRED_GATES.every(k => r.gates[k].verdict === "PASS"));
  assert.equal(canAutoPublish(r), true);
  assert.equal(r.dataset_hashes.length, 1);
});

test("data integrity: a number not in the dataset holds the article", () => {
  const r = run(d => text(d, 4, d.blocks[4].data.text.replace("12.5%", "15.5%")));
  assert.equal(gateOf(r, "data_integrity").verdict, "HOLD");
  assert.ok(codes(r, "data_integrity").includes("unsupported_number"));
  assert.equal(r.verdict, "HOLD");
  assert.equal(canAutoPublish(r), false);
});

test("data integrity: the dataset must still match the database, and a research article must have one", () => {
  const { evidence } = researchFixture();
  const changed = computeDataset({ definition: "boat5_win", rows: rowsOf(cleanRaces({ n: 201, every5: 8, from: "2026-03-01" })), period: PERIOD, params: { scope_name: "桐生", course_code: 1 }, now: NOW });
  assert.ok(codes(run(d => d, { datasets: [{ stored: evidence, recomputed: changed }] }), "data_integrity").includes("dataset_changed"));
  assert.ok(codes(run(d => d, { datasets: [] }), "data_integrity").includes("dataset_missing"));
  const noDataset = run(d => d, { pack: p => ({ ...p, sources: p.sources.map(s => ({ ...s, kind: "manual" })) }) });
  assert.ok(codes(noDataset, "data_integrity").includes("dataset_missing"));
  assert.equal(noDataset.verdict, "HOLD");
});

test("sources: an unknown URL is a retry; an unknown source id or undated source is a hold", () => {
  const url = run(d => text(d, 8, `${d.blocks[8].data.text} https://example.com/page`));
  assert.equal(gateOf(url, "sources").verdict, "RETRY");
  const unknown = run(d => { d.blocks[2].data.source_ids = ["X9"]; return d; });
  assert.equal(gateOf(unknown, "sources").verdict, "HOLD");
  const undated = run(d => d, { pack: p => ({ ...p, sources: [...p.sources, { id: "S9", kind: "repository_dataset", label: "収録データ", url: "/races/01/info", fetched_at: null }] }) });
  assert.ok(codes(undated, "sources").includes("source_without_fetch_time"));
  assert.equal(undated.verdict, "HOLD");
});

test("duplicates: hold findings hold, warnings are recorded without stopping", () => {
  const held = run(d => d, { duplicates: [{ level: "hold", code: "duplicate_theme", message: "同じ集計" }] });
  assert.equal(gateOf(held, "duplicates").verdict, "HOLD");
  const warned = run(d => d, { duplicates: [{ level: "warning", code: "similar_body", message: "似ている" }] });
  assert.equal(gateOf(warned, "duplicates").verdict, "PASS");
  assert.equal(gateOf(warned, "duplicates").issues[0].verdict, "NOTE");
});

test("usefulness: period, sample size, limitations and length are required; scores only add retries", () => {
  const noPeriod = run(d => text(d, 2, d.blocks[2].data.text.replace("2025/11/03〜2026/11/02の", "")));
  assert.ok(codes(noPeriod, "usefulness").includes("period_not_stated"));
  const jpPeriod = run(d => text(d, 2, d.blocks[2].data.text.replace("2025/11/03〜2026/11/02", "2025年11月3日〜2026年11月2日")));
  assert.ok(!codes(jpPeriod, "usefulness").includes("period_not_stated"), "the Japanese date form counts");
  const noLimits = run(d => { d.blocks = d.blocks.filter(b => b.type !== "WARNING"); return d; });
  assert.ok(codes(noLimits, "usefulness").includes("no_limitations"));
  const short = run(d => { d.blocks = d.blocks.filter((b, i) => i < 5 || b.data?.system); return d; });
  assert.ok(codes(short, "usefulness").includes("too_short"));
  assert.equal(short.verdict, "RETRY");
});

test("SEO: title/description lengths, cover, heading and noindex", () => {
  const r = run(d => ({ ...d, title: "短い", seo: { ...d.seo, description: "短い説明" }, cover: {} }));
  assert.equal(gateOf(r, "seo").verdict, "RETRY");
  assert.deepEqual(codes(r, "seo").sort(), ["description_length", "no_cover", "title_length"]);
  assert.equal(gateOf(run(d => ({ ...d, noindex: true })), "seo").verdict, "HOLD");
  assert.ok(codes(run(d => { d.blocks = d.blocks.filter(b => b.type !== "HEADING"); return d; }), "seo").includes("no_heading"));
});

test("copyright: verbatim copy of a fetched page retries; external images and videos hold", () => {
  const page = "桐生ボートレース場は群馬県みどり市にある全国でも珍しい内陸の競艇場で、標高が高く気圧が低いことからモーターの出足に影響があるとされています。";
  const copied = run(d => text(d, 8, `${d.blocks[8].data.text}${page}`), { pack: p => ({ ...p, documents: [{ source_id: "S2", title: "公式", excerpt: page }] }) });
  assert.ok(codes(copied, "copyright").includes("verbatim_copy"));
  const image = run(d => { d.blocks.splice(3, 0, { id: "00000000-0000-4000-8000-000000000999", type: "IMAGE", data: { media_id: null, alt: "x" } }); return d; });
  assert.equal(gateOf(image, "copyright").verdict, "HOLD");
  const video = run(d => { d.blocks.splice(3, 0, { id: "00000000-0000-4000-8000-000000000998", type: "YOUTUBE", data: { url: "https://www.youtube.com/watch?v=abc" } }); return d; });
  assert.ok(codes(video, "copyright").includes("video_embed"));
});

test("safety: banned and misleading wording retries; personal data, secrets and attributed quotes hold", () => {
  assert.equal(gateOf(run(d => text(d, 8, `${d.blocks[8].data.text}これは鉄板です。`)), "safety").verdict, "RETRY");
  assert.ok(codes(run(d => text(d, 8, `${d.blocks[8].data.text}この買い方なら必ず当たります。`)), "safety").includes("misleading_claim"));
  for (const secret of ["連絡先は info@example.com です。", "電話 03-1234-5678 まで。", "キーは sk-abcdefghijklmnopqrstu です。"]) {
    assert.equal(gateOf(run(d => text(d, 8, `${d.blocks[8].data.text}${secret}`)), "safety").verdict, "HOLD", secret);
  }
  const quote = run(d => text(d, 8, `${d.blocks[8].data.text}山田選手は「5号艇でも勝てる」と語った。`));
  assert.ok(codes(quote, "safety").includes("attributed_quote"));
  assert.equal(quote.verdict, "HOLD");
});

test("overall verdict: HOLD beats RETRY, RETRY becomes HOLD after the last allowed regeneration", () => {
  const retry = d => ({ ...d, title: "短い" });
  assert.equal(run(retry, { attempt: 0 }).verdict, "RETRY");
  assert.equal(run(retry, { attempt: MAX_RETRIES - 1 }).verdict, "RETRY");
  const exhausted = run(retry, { attempt: MAX_RETRIES });
  assert.equal(exhausted.verdict, "HOLD");
  assert.equal(exhausted.reason, "retry_exhausted");
  const both = run(d => ({ ...d, title: "短い", noindex: true }));
  assert.equal(both.verdict, "HOLD");
});

test("canAutoPublish requires PASS overall and in every gate", () => {
  const r = run();
  assert.equal(canAutoPublish({ ...r, gates: { ...r.gates, seo: { verdict: "RETRY" } } }), false);
  assert.equal(canAutoPublish({ ...r, verdict: "RETRY" }), false);
  assert.equal(canAutoPublish(null), false);
});
