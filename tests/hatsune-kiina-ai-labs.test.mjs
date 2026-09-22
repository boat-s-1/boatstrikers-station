import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migrationUrl = new URL("../supabase/migrations/20260922_create_hatsune_kiina_ai_analysis_metrics.sql", import.meta.url);
const adminUrl = new URL("../app/admin/page.js", import.meta.url);
const vercelUrl = new URL("../vercel.json", import.meta.url);

test("初音・キイナ分析は公開済み公式予想だけを対象にする", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /source_table = 'ai_v2_daily_rankings_published'/);
  assert.match(sql, /character_code in \('hatsune','kiina'\)/);
  assert.match(sql, /races >= 100/);
});

test("キイナ分析は5アタマ買い目だけで再計算する", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /split_part\(x\.ticket,'-',1\) = '5'/);
  assert.match(sql, /boat5_national_win_rate/);
  assert.match(sql, /boat5_motor_2_rate/);
});

test("管理画面とcronに初音・キイナAI改善導線がある", async () => {
  const [admin, vercelRaw] = await Promise.all([
    readFile(adminUrl, "utf8"),
    readFile(vercelUrl, "utf8"),
  ]);
  assert.match(admin, /\/admin\/hatsune-ai-lab/);
  assert.match(admin, /\/admin\/kiina-ai-lab/);

  const vercel = JSON.parse(vercelRaw);
  assert.ok(vercel.crons.some((item) =>
    item.path === "/api/cron/hatsune-kiina-ai-analysis" &&
    item.schedule === "45 21 * * *"
  ));
});
