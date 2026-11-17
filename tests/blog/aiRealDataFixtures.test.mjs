import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { computeDataset } from "../../lib/blog/ai/data/datasets.mjs";
import { decodeExport, compare } from "../../scripts/blog/verify-real-data.mjs";

// PHASE 2: real race rows exported read-only from production on 2026-11-03 (ops/blog/ai-real-data-export.sql) and the
// output of the independent SQL implementation (ops/blog/ai-real-data-verification.sql) for the same periods. The code
// must keep giving exactly the database's answer on real data, including its gaps (which stay HOLD).
const dir = new URL("./fixtures/real-data/", import.meta.url);
const read = name => JSON.parse(readFileSync(new URL(name, dir), "utf8"));
const sqlBy = name => Object.fromEntries(read(name).map(r => [r.definition, r]));

const CASES = [
  ["kiryu-20261004-20261102.json", "kiryu-20261004-20261102.sql.json", { from: "2026-10-04", to: "2026-11-02" }, { course_code: 1 },
    { inside_escape: "hold", boat5_win: "ok", high_payout: "ok", women_inside_escape: "hold" }],
  ["kiryu-20261004-20261102.json", "kiryu-20261004-20261026.sql.json", { from: "2026-10-04", to: "2026-10-26" }, { course_code: 1 },
    { inside_escape: "ok", boat5_win: "ok", high_payout: "ok", women_inside_escape: "hold" }],
  ["women-national-20261013-20261026.json", "women-national-20261013-20261026.sql.json", { from: "2026-10-13", to: "2026-10-26" }, {},
    { women_inside_escape: "ok" }],
];

for (const [exportFile, sqlFile, period, params, statuses] of CASES) {
  test(`real data ${exportFile} ${period.from}〜${period.to}: code equals SQL for every dataset`, () => {
    const rows = decodeExport(read(exportFile));
    const sql = sqlBy(sqlFile);
    for (const [definition, status] of Object.entries(statuses)) {
      const evidence = computeDataset({ definition, rows, period, params, now: new Date("2026-11-03T12:00:00Z") });
      assert.deepEqual(compare({ evidence, sqlRow: sql[definition] }), [], definition);
      assert.equal(evidence.status, status, `${definition}: ${JSON.stringify(evidence.issues)}`);
    }
  });
}
