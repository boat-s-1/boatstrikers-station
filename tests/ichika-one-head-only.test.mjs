import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const appEngineUrl = new URL("../app/lib/phase2PredictionEngine.js", import.meta.url);
const legacyEngineUrl = new URL("../lib/phase2PredictionEngine.js", import.meta.url);
const migrationUrl = new URL(
  "../supabase/migrations/20260922_guard_ichika_one_head_official_bets.sql",
  import.meta.url,
);

test("一果の生成買い目は1号艇1着固定で、1号艇が最上位でない場合は見送る", async () => {
  const [appEngine, legacyEngine] = await Promise.all([
    readFile(appEngineUrl, "utf8"),
    readFile(legacyEngineUrl, "utf8"),
  ]);

  for (const source of [appEngine, legacyEngine]) {
    assert.match(source, /const previousEligible = Number\(marks\[0\]\?\.boat_no\) === 1/);
    assert.match(source, /const liveEligible = Number\(liveMarks\[0\]\?\.boat_no\) === 1/);
    assert.match(source, /main_boat: 1/);
    assert.match(source, /const a = 1|bet: `1-\$\{second\}-\$\{third\}`/);
  }

  assert.doesNotMatch(appEngine, /add\(second, first, third\)/);
  assert.doesNotMatch(appEngine, /add\(third, first, second\)/);
});

test("公式買い目凍結にも一果1アタマのDBガードがある", async () => {
  const migration = await readFile(migrationUrl, "utf8");

  assert.match(migration, /new\.character_code <> 'ichika'/);
  assert.match(migration, /split_part\(ticket, '-', 1\) = '1'/);
  assert.match(migration, /Historical bsc_official_predictions rows are intentionally left unchanged/);
});
