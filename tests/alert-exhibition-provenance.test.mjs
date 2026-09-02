import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const migration = fs.readFileSync("supabase/migrations/20260902190000_alert_exhibition_provenance.sql", "utf8");
const dashboard = fs.readFileSync("lib/adminDashboardStatus.js", "utf8");
const center = fs.readFileSync("app/admin/alerts/NotificationCenter.js", "utf8");

test("all LINE alert tables receive the same provenance trigger", () => {
  for (const table of [
    "bs_exhibition_alerts",
    "bs_ichika_hidden_escape_alerts",
    "bs_hatsune_womens_inner_break_alerts",
    "bs_hatsune_box_alerts",
  ]) assert.match(migration, new RegExp(`'${table}'`));
  assert.match(migration, /before insert/);
});

test("provenance categories distinguish official, PC, mixed, normal and Kiryu rank", () => {
  for (const kind of ["official", "pc_kyotei", "mixed", "normal_only", "kiryu_official_rank", "unknown"])
    assert.match(migration, new RegExp(`'${kind}'`));
});

test("only original exhibition fields determine alert provenance", () => {
  for (const field of ["official_exhibition_time", "official_lap", "official_turn", "official_straight"])
    assert.match(migration, new RegExp(`'${field}'`));
  assert.match(migration, /entry_count <> 6/);
});

test("notification center shows source and both latency stages", () => {
  assert.match(dashboard, /exhibition_source_kind,exhibition_synced_at/);
  assert.match(center, /取得→成立/);
  assert.match(center, /成立→LINE/);
  assert.match(center, /sourceLabel/);
});
