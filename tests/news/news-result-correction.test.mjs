import test from "node:test";
import assert from "node:assert/strict";

import { buildResultCorrection } from "../../lib/newsResultCorrection.js";

// id1848（徳山5R）の実データをもとにした入力。
const ARTICLE = {
  id: 1848,
  source_key: "bs:result:2026-10-13:18:5",
  title: "徳山5R 5Rの結果を更新",
  summary: "2026年10月13日の徳山5Rで、女子戦のレース結果が確定した。",
  article_body: "2026年10月13日に実施された徳山5Rは、レース結果が確定した。",
  article_body_source: "ai",
  published_at: "2026-10-13T01:00:00+00:00",
  place: "徳山",
};
const RACE = { date: "2026-10-13", cc: 18, race_no: 5, course_name: "徳山", closing_time: "10:32:00", trifecta: "4-2-3", payout: 41720, cancel: null };
const RESULT = { status: "confirmed", race_status: "finished", trifecta: "4-2-3", payout: 41720, technique: "差し" };
const ENTRIES = [
  { boat: 1, name: "鎌　倉　　　　涼", order: 6, course: 1, st: 0.1, gender_code: "2" },
  { boat: 2, name: "渡　辺　　千　草", order: 2, course: 2, st: 0.08, gender_code: "2" },
  { boat: 3, name: "福　山　恵里奈", order: 3, course: 3, st: 0.11, gender_code: "2" },
  { boat: 4, name: "木　村　紗友希", order: 1, course: 4, st: 0.11, gender_code: "2" },
  { boat: 5, name: "選手Ｅ", order: 4, course: 5, st: 0.12, gender_code: "2" },
  { boat: 6, name: "選手Ｆ", order: 5, course: 6, st: 0.15, gender_code: "2" },
];
const NOW = Date.parse("2026-10-13T18:00:00+09:00");
const build = (overrides = {}) => buildResultCorrection({ article: ARTICLE, race: RACE, result: RESULT, entries: ENTRIES, now: NOW, ...overrides });

test("確定結果で訂正案を作り、公開日時と見出しは変えず、訂正前の内容を残す", () => {
  const draft = build();
  assert.equal(draft.ok, true, draft.issues.join("/"));
  assert.equal(draft.published_at, ARTICLE.published_at);
  assert.equal(draft.after.title, ARTICLE.title);
  assert.equal(draft.before.summary, ARTICLE.summary);
  assert.equal(draft.before.article_body, ARTICLE.article_body);
  assert.match(draft.after.summary, /4号艇の木村紗友希選手が1着。3連単4-2-3（払戻41,720円）で確定しました。/);
  assert.match(draft.after.article_body, /^【訂正】［訂正日時：適用時に記入］/);
  assert.match(draft.after.article_body, /2026年10月13日 10:00の公開時点でレースの締切前/);
  assert.match(draft.after.article_body, /1着　4号艇　木村紗友希（4コース・ST\.11）\n2着　2号艇　渡辺千草/);
  assert.match(draft.after.article_body, /決まり手　差し\n3連単　4-2-3　払戻41,720円/);
  assert.match(draft.after.summary, /出走6名がすべて女子選手/);
});

test("訂正日時を渡すと本文の先頭に入る", () => {
  assert.match(build({ correctedAt: "2026-10-14T01:30:00Z" }).after.article_body, /^【訂正】2026年10月14日 10:30/);
});

test("確定結果と矛盾する・記事とレースが対応しない場合は訂正案を作らない", () => {
  assert.equal(build({ race: { ...RACE, trifecta: "4-3-2" } }).ok, false);
  assert.equal(build({ result: { ...RESULT, status: null } }).ok, false);
  assert.equal(build({ article: { ...ARTICLE, source_key: "bs:result:2026-10-13:18:6" } }).ok, false);
  assert.equal(build({ entries: ENTRIES.map((e) => ({ ...e, order: null })) }).ok, false);
});

test("決まり手が未登録なら行を省き、女子選手で揃っていなければ女子の記述をしない", () => {
  const noTechnique = build({ result: { ...RESULT, technique: null } });
  assert.equal(noTechnique.ok, true);
  assert.doesNotMatch(noTechnique.after.article_body, /決まり手/);
  const mixed = build({ entries: ENTRIES.map((e, i) => (i === 0 ? { ...e, gender_code: "1" } : e)) });
  assert.doesNotMatch(mixed.after.summary + mixed.after.article_body, /女子/);
});
