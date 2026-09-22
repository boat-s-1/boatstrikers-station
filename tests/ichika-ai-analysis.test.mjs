import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migrationUrl = new URL(
  "../supabase/migrations/20260922_create_ichika_ai_analysis_metrics.sql",
  import.meta.url,
);
const libUrl = new URL("../lib/ichikaAiDailyAnalysis.js", import.meta.url);
const routeUrl = new URL(
  "../app/api/cron/ichika-ai-analysis/route.js",
  import.meta.url,
);
const vercelUrl = new URL("../vercel.json", import.meta.url);

test("一果AI改善用DATA LABは1アタマだけを再集計する", async () => {
  const migration = await readFile(migrationUrl, "utf8");

  assert.match(migration, /bs_ichika_ai_analysis_metrics/);
  assert.match(migration, /split_part\(x\.ticket, '-', 1\) = '1'/);
  assert.match(migration, /source_table = 'bs_ai_predictions'/);
  assert.match(migration, /races >= 100/);
  assert.match(migration, /distinct on \(p\.race_date, p\.course_code, p\.race_no, p\.timing\)/);
});

test("展示・風の分析は直前版だけに限定して未来情報の混入を避ける", async () => {
  const migration = await readFile(migrationUrl, "utf8");

  for (const metric of ["wind", "exhibition_time_rank", "start_exhibition_rank"]) {
    const pos = migration.indexOf(`select *, '${metric}'`);
    assert.ok(pos >= 0, `${metric} metric must exist`);
    const slice = migration.slice(pos, pos + 700);
    assert.match(slice, /where timing = 'after_exhibition'/);
  }
});

test("cronはJST前日を30日窓で毎日更新する", async () => {
  const [lib, route, vercelRaw] = await Promise.all([
    readFile(libUrl, "utf8"),
    readFile(routeUrl, "utf8"),
    readFile(vercelUrl, "utf8"),
  ]);

  assert.match(lib, /jstYesterdayString/);
  assert.match(lib, /refresh_ichika_ai_analysis/);
  assert.match(route, /CRON_SECRET/);
  assert.match(route, /window_days/);

  const vercel = JSON.parse(vercelRaw);
  assert.ok(
    vercel.crons.some(
      (item) =>
        item.path === "/api/cron/ichika-ai-analysis" &&
        item.schedule === "35 21 * * *",
    ),
  );
});
