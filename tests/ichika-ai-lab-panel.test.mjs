import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const pageUrl = new URL("../app/admin/ichika-ai-lab/page.js", import.meta.url);
const adminUrl = new URL("../app/admin/page.js", import.meta.url);

test("一果AI改善パネルは100R以上だけを候補判定する", async () => {
  const page = await readFile(pageUrl, "utf8");

  assert.match(page, /if \(!row\.sample_sufficient\) return "insufficient"/);
  assert.match(page, /recovery >= 100 && hitRate >= 30/);
  assert.match(page, /recovery < 75/);
  assert.match(page, /予想ロジックを自動変更しません/);
});

test("管理TOPから一果AI改善パネルへ遷移できる", async () => {
  const admin = await readFile(adminUrl, "utf8");
  assert.match(admin, /href: "\/admin\/ichika-ai-lab"/);
  assert.match(admin, /一果AI 改善パネル/);
});
