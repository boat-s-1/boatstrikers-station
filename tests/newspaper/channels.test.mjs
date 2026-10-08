// 新聞テンプレート（サイト記事・note・X・Shorts）を .mjs へ移した後も、出力が変更前と一致することを確認する。
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { ROOT, loadRouteModule } from "./helpers.mjs";
import * as current from "../../lib/newspaper/channels.mjs";

const INPUTS = [
  { character: "ichika", date: "2026-10-08", course: "宮島", raceNo: "1", edition: "previous_day", headline: "宮島1R、イン逃げ期待84.2%！", primaryLabel: "イン逃げ率", primaryValue: "84.2%", comment: "一果コメント", details: ["全国平均 73%", "本命 1号艇", "", null, { x: 1 }] },
  { character: "hatsune", date: "2026-10-08", course: "丸亀", raceNo: 6, edition: "just_before", headline: "", primaryLabel: "女子戦期待度", primaryValue: "", comment: "", details: ["注目 2号艇", "2号艇 当地勝率7.40"] },
  { character: "kiina", date: "2026-1-5", course: " 戸田 ", raceNo: "12", edition: "previous_day", headline: null, primaryLabel: "穴狙い期待度", primaryValue: "16.2%", comment: "キイナ", details: "not-array" },
  { character: "unknown", date: "20261008", course: "", raceNo: "abc", edition: "other" },
  {},
];

test("buildNewspaperChannels・newspaperSlug の出力が変更前と一致する", async () => {
  const legacy = await loadRouteModule({ sourcePath: path.join(ROOT, "tests/newspaper/legacy/newspaper-content.js.txt"), stubs: {} });
  for (const input of INPUTS) {
    assert.deepStrictEqual(current.buildNewspaperChannels(input), legacy.buildNewspaperChannels(input), JSON.stringify(input));
    assert.equal(current.newspaperSlug(input), legacy.newspaperSlug(input), JSON.stringify(input));
  }
  assert.deepStrictEqual(current.NEWSPAPER_CHARACTERS, legacy.NEWSPAPER_CHARACTERS);
});

test("lib/newspaperContent.js は既存の名前をそのまま再エクスポートする", async () => {
  const source = await readFile(path.join(ROOT, "lib/newspaperContent.js"), "utf8");
  assert.match(source, /export \{ newspaperSlug, buildNewspaperChannels, NEWSPAPER_CHARACTERS \} from "\.\/newspaper\/channels\.mjs";/);
});
