import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { bodySimilarity, articleText, duplicateFindings, themeDuplicates, periodOverlap, DUPLICATE_THRESHOLDS as T } from "../../lib/blog/ai/duplicates.mjs";
import { goodDocument } from "./_gateFixtures.mjs";

const fixture = name => JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), "utf8"));
const toda12 = fixture("toda-v12-staging-20261018"), toda13 = fixture("toda-v13-staging-20261018");
const kiryu12 = fixture("kiryu-v12-staging-20261018"), kiryu13 = fixture("kiryu-v13-staging-20261018");
const sim = (a, b) => bodySimilarity(articleText(a), articleText(b));

test("thresholds calibrated on the staging drafts: same theme rewritten ≥ hold, other stadium on the same template < hold", () => {
  for (const [a, b] of [[toda12, toda13], [kiryu12, kiryu13]]) assert.ok(sim(a, b) >= T.bodyHold, `same theme ${sim(a, b)}`);
  for (const [a, b] of [[toda12, kiryu12], [toda12, kiryu13], [toda13, kiryu12], [toda13, kiryu13]]) {
    const s = sim(a, b);
    assert.ok(s < T.bodyHold, `other stadium ${s}`);
    assert.ok(s >= T.bodyWarn, `the shared template is still reported as a warning ${s}`);
  }
  assert.ok(sim(goodDocument(), toda12) < T.bodyWarn, "an unrelated research article is not similar");
});

test("findings: same title and same body hold; a similar body warns; system blocks are ignored", () => {
  const holds = duplicateFindings({ document: toda13, existing: [{ post_id: "p1", title: toda12.title, text: articleText(toda12) }] });
  assert.deepEqual(holds.map(f => [f.level, f.code]), [["hold", "duplicate_title"], ["hold", "duplicate_body"]]);
  const warns = duplicateFindings({ document: kiryu12, existing: [{ post_id: "p2", title: toda12.title, text: articleText(toda12) }] });
  assert.deepEqual(warns.map(f => [f.level, f.code]), [["warning", "similar_body"]]);
  const doc = goodDocument();
  const withSystem = { ...doc, blocks: [...doc.blocks, { type: "LIST", data: { system: true, items: ["出典の一覧".repeat(50)] } }] };
  assert.equal(articleText(withSystem), articleText(doc));
});

test("theme duplicates: same dataset, scope and overlapping period within the lookback", () => {
  const now = new Date("2026-11-03T00:00:00Z");
  const dataset = { definition: "boat5_win", params: { course_code: 1 }, period: { from: "2025-11-03", to: "2026-11-02" } };
  const history = [
    { post_id: "same", title: "桐生の5号艇", created_at: "2026-10-20T00:00:00Z", dataset: { definition: "boat5_win", params: { course_code: 1 }, period: { from: "2025-10-20", to: "2026-10-19" } } },
    { post_id: "other-stadium", created_at: "2026-10-20T00:00:00Z", dataset: { definition: "boat5_win", params: { course_code: 2 }, period: dataset.period } },
    { post_id: "other-definition", created_at: "2026-10-20T00:00:00Z", dataset: { definition: "high_payout", params: { course_code: 1 }, period: dataset.period } },
    { post_id: "old", created_at: "2026-01-01T00:00:00Z", dataset: { ...dataset } },
    { post_id: "short-overlap", created_at: "2026-10-20T00:00:00Z", dataset: { definition: "boat5_win", params: { course_code: 1 }, period: { from: "2024-11-01", to: "2025-12-01" } } },
  ];
  assert.deepEqual(themeDuplicates(dataset, history, { now }).map(d => d.post_id), ["same"]);
  assert.equal(periodOverlap({ from: "2026-01-01", to: "2026-01-10" }, { from: "2026-01-06", to: "2026-01-20" }), 0.5);
  assert.equal(periodOverlap({ from: "2026-01-01", to: "2026-01-10" }, { from: "2026-02-01", to: "2026-02-10" }), 0);
  const f = duplicateFindings({ document: goodDocument(), dataset, history, now });
  assert.deepEqual(f.map(x => [x.level, x.code, x.post_id]), [["hold", "duplicate_theme", "same"]]);
  assert.deepEqual(themeDuplicates(null, history, { now }), []);
});
