import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const wallpaper = readFileSync("app/components/HomeFixedWallpaper.js", "utf8");
const todayPage = readFileSync("app/today/page.js", "utf8");
const todayVisuals = readFileSync("app/today/todayVisual.module.css", "utf8");

test("today shares the home wallpaper and groups major sections into panels", () => {
  assert.match(wallpaper, /pathname !== "\/" && pathname !== "\/today"/);
  assert.match(todayPage, /data-page="today"/);
  assert.equal((todayPage.match(/visualStyles\.panel/g) || []).length, 4);
  assert.match(todayVisuals, /background: rgba\(255, 255, 255, 0\.93\)/);
  assert.match(todayVisuals, /border-radius: 24px/);
});
