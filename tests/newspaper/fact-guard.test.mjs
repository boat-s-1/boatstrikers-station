// factGuard：本文の数値を「項目と数値の組み合わせ」で元データと照合する。
import test from "node:test";
import assert from "node:assert/strict";
import { buildFactSheet, parseCheckpointFact, verifyNewspaperFields } from "../../lib/newspaper/factGuard.mjs";
import { buildNewspaperChannels, newspaperChannelInput } from "../../lib/newspaper/channels.mjs";

const ICHIKA = buildFactSheet({
  date: "2026-10-08", raceNo: 1, rankNo: 1,
  facts: [
    { labels: ["イン逃げ率", "イン逃げ期待", "逃げ率", "逃げ期待", "イン逃げ", "期待度"], value: "84.2", unit: "%" },
    { labels: ["1点", "1口", "単価", "点あたり"], value: 100, unit: "円" },
    { labels: ["投資", "合計", "総額", "購入額"], value: 200, unit: "円" },
  ],
  tickets: ["1-2-3", "1-3-2"],
});

const HATSUNE = buildFactSheet({
  date: "2026-10-08", raceNo: 2,
  facts: [
    { labels: ["女子戦期待度", "期待度"], value: "29.0", unit: "%" },
    parseCheckpointFact("2号艇 当地勝率7.40"),
    parseCheckpointFact("3号艇 平均ST0.14"),
    parseCheckpointFact("3号艇 モーター2連率55.5%"),
  ],
});

function check(sheet, text) {
  return verifyNewspaperFields({ articleBody: text }, sheet);
}

test("元データどおりの記事は合格する", () => {
  const ok = [
    "## 前日版｜一果の注目ポイント\n10月8日の宮島1Rは、イン逃げ率84.2%。1号艇を軸に見ていきます。",
    "前日AIの公式買い目は1-2-3と1-3-2の2点。1点100円、合計200円です。",
    "イン逃げ期待は84.2％（全角）でも同じ値なら合格。",
    "1号艇の先マイと、2・3着争いをチェックします。2連率の高いモーターにも注目。",
    "【10/8 前日版】宮島1R｜一果新聞",
    "※舟券の購入は20歳になってから。 #一果新聞 #BoatStrikers",
  ];
  for (const text of ok) assert.deepStrictEqual(check(ICHIKA, text), { ok: true, violations: [] }, text);
});

test("艇別データは項目・値・艇番がそろっていれば合格する", () => {
  const text = "注目は2号艇。2号艇の当地勝率7.40は頼もしい数字です。3号艇は平均ST0.14、モーター2連率55.5%と気配十分。女子戦期待度は29.0%。";
  assert.deepStrictEqual(check(HATSUNE, text), { ok: true, violations: [] });
});

test("項目と数値の組み合わせが違うと不合格", () => {
  const cases = [
    ["値の違い", ICHIKA, "イン逃げ率84.5%です。"],
    ["丸めた値", ICHIKA, "イン逃げ率84%です。"],
    ["別項目の名前で同じ値", ICHIKA, "全国平均84.2%と比べると…"],
    ["項目名がない", ICHIKA, "84.2%という数字は高い。"],
    ["元データに無い項目", ICHIKA, "全国平均73%と比べてイン逃げ率84.2%。"],
    ["艇番の取り違え", HATSUNE, "3号艇の当地勝率7.40に注目。"],
    ["項目の取り違え", HATSUNE, "2号艇の全国勝率7.40に注目。"],
    ["艇別データの単位違い", HATSUNE, "3号艇のモーター2連率55.5に注目。"],
  ];
  for (const [label, sheet, text] of cases) {
    const result = check(sheet, text);
    assert.equal(result.ok, false, label);
    assert.ok(result.violations.length >= 1, label);
  }
});

test("検証できない数値（時刻・回数・別レース・別日・存在しない艇）は不合格", () => {
  const cases = [
    "締切は10時45分です。",
    "締切は10:45。",
    "前走は3回連続で1着。",
    "宮島2Rも注目。",
    "10月9日の宮島1R。",
    "【10/9 前日版】",
    "7号艇は欠場。",
    "2025年の傾向。",
    "BEST10に入っています。",
    "1-2-4もおすすめ。",
    "1点200円で購入。",
    "合計300円。",
    "3点で勝負。",
    "八割の確率でイン逃げ。",
    "イン逃げ率は八十四パーセント。",
  ];
  for (const text of cases) assert.equal(check(ICHIKA, text).ok, false, text);
});

test("買い目が無いレースでは点数・金額に触れると不合格", () => {
  const sheet = buildFactSheet({ date: "2026-10-08", raceNo: 1, facts: [{ labels: ["イン逃げ率"], value: "84.2", unit: "%" }] });
  assert.equal(check(sheet, "公式買い目は2点です。").ok, false);
  assert.equal(check(sheet, "1点100円。").ok, false);
});

test("内部用語・不正な値は不合格", () => {
  for (const text of ["[object Object]", "sourcePayloadの値", "AI v2の予想", "shadowモデル", "scoreが高い", "undefined", "NaN%"]) {
    assert.equal(check(ICHIKA, text).ok, false, text);
  }
});

test("ファクトシートが不完全・文字列以外は不合格（安全に検証できない）", () => {
  assert.equal(verifyNewspaperFields({ articleBody: "宮島1R" }, buildFactSheet({ date: "", raceNo: 1 })).ok, false);
  assert.equal(verifyNewspaperFields({ articleBody: "宮島1R" }, buildFactSheet({ date: "2026-10-08", raceNo: "abc" })).ok, false);
  assert.equal(verifyNewspaperFields({ articleBody: { text: "x" } }, ICHIKA).ok, false);
  assert.equal(verifyNewspaperFields({ articleBody: "x" }, null).ok, false);
});

test("どの項目のどこが不合格かを返す", () => {
  const result = verifyNewspaperFields({ summary: "OK", noteBody: "全国平均73%" }, ICHIKA);
  assert.equal(result.ok, false);
  assert.equal(result.violations[0].field, "noteBody");
  assert.match(result.violations[0].snippet, /73/);
  assert.ok(result.violations[0].reason);
});

test("チェックポイントの解析：既知の項目だけをファクトにする", () => {
  assert.deepStrictEqual(parseCheckpointFact("2号艇 当地勝率7.40"), { boat: 2, labels: ["当地勝率", "当地"], value: "7.40", unit: "" });
  assert.deepStrictEqual(parseCheckpointFact("5号艇 モーター2連率42.0%"), { boat: 5, labels: ["モーター二連率", "モーター"], value: "42.0", unit: "%" });
  assert.equal(parseCheckpointFact("艇別データを確認"), null);
  assert.equal(parseCheckpointFact("2号艇 謎の指標1.00"), null);
  assert.equal(parseCheckpointFact("7号艇 当地勝率7.40"), null);
});

test("自動下書きで使うテンプレート（X投稿・Shorts台本・タイトル）は元データだけで合格する", () => {
  for (const [character, value, sheet] of [
    ["ichika", { date: "2026-10-08", course: "宮島", raceNo: "1", edition: "previous_day", mainCopy: "宮島1R、1号艇中心に相手比較！", escapeRate: "84.2", honmeiBoat: "1", ichikaComment: "" }, ICHIKA],
    ["hatsune", { date: "2026-10-08", course: "宮島", raceNo: "2", edition: "previous_day", headline: "宮島2R 女子戦をチェック♪", expectation: "29.0", featuredBoat: "2", checkpoints: ["2号艇 当地勝率7.40", "3号艇 平均ST0.14", "3号艇 モーター2連率55.5%"], comment: "" }, HATSUNE],
  ]) {
    const template = buildNewspaperChannels(newspaperChannelInput(character, value));
    const result = verifyNewspaperFields(template, sheet);
    assert.deepStrictEqual(result, { ok: true, violations: [] }, character);
  }
});
