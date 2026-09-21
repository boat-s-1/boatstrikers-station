import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const helperUrl = new URL("../lib/publicPredictionResults.js", import.meta.url);
const homeUrl = new URL("../app/page.js", import.meta.url);
const resultsUrl = new URL("../app/results/page.js", import.meta.url);

test("トップと実績ページが同じ公開予想集計を使う", async () => {
  const [helper, home, results] = await Promise.all([
    readFile(helperUrl, "utf8"),
    readFile(homeUrl, "utf8"),
    readFile(resultsUrl, "utf8"),
  ]);

  assert.match(helper, /\.in\("category", PUBLIC_PREDICTION_CATEGORIES\)/);
  assert.match(helper, /\.range\(from, from \+ PAGE_SIZE - 1\)/);
  assert.match(home, /getMonthlyPublicPredictionResults\(\)/);
  assert.match(results, /getMonthlyPublicPredictionResults\(\)/);
  assert.doesNotMatch(home, /from\("bsc_results"\)/);
  assert.doesNotMatch(results, /from\("bsc_results"\)/);
});

test("集計条件の説明項目を両ページが表示する", async () => {
  const [home, results] = await Promise.all([
    readFile(homeUrl, "utf8"),
    readFile(resultsUrl, "utf8"),
  ]);

  for (const source of [home, results]) {
    assert.match(source, /集計期間/);
    assert.match(source, /対象予想/);
    assert.match(source, /最終更新/);
  }
});
