import assert from "node:assert/strict";
import test from "node:test";
import { planVerifiedSitePreviousDayIngest, planVerifiedSiteRaceDayMorningIngest } from "./site-previous-day-ingest-plan.mjs";

const race = { race_date: "2026-11-19", course_code: 1, race_no: 1 };
const entries = Array.from({ length: 6 }, (_, index) => ({
  ...race, boat_no: index + 1, racer_registration_no: String(4000 + index),
}));
const boats = entries.map((row) => `<tbody class="is-fs12"><tr><td class="is-boatColor${row.boat_no}">${row.boat_no}</td><td></td><td>${row.racer_registration_no} / B1<div class="is-fs18"><a>Racer</a></div></td><td>0.15</td><td>5.00</td><td>6.00</td><td>1<br>35</td><td>2<br>45</td></tr></tbody>`).join("");
const html = `<img src="/text_place2_01.png"><table><thead><tr><th><a href="/owpc/pc/race/racelist?rno=1&amp;jcd=01&amp;hd=20261119">1R</a></th></tr></thead><tbody><tr><td>締切予定時刻</td><td>15:22</td></tr></tbody></table><table>${boats}</table>`;
const input = { raceDate: race.race_date, expectedRaces: [race], expectedEntries: entries,
  pages: [{ ...race, html }], capturedAt: "2026-11-18T14:50:00Z",
  now: "2026-11-18T23:59:00+09:00", existingEvents: [], existingEntries: [] };

test("only a fully checked official page produces a previous-day save plan", () => {
  const result = planVerifiedSitePreviousDayIngest(input);
  assert.equal(result.status, "PASS_OFFLINE_ONLY");
  assert.equal(result.missingEvents.length, 1);
  assert.equal(result.missingEntries.length, 6);
  const replay = planVerifiedSitePreviousDayIngest({ ...input, existingEvents: [race], existingEntries: entries });
  assert.deepEqual(replay, { status: "PASS_OFFLINE_ONLY", missingEvents: [], missingEntries: [] });
});

test("page mismatch, missing boat, and existing conflict never expose save rows", () => {
  for (const change of [
    { pages: [] },
    { pages: [{ ...race, html: html.replace("jcd=01", "jcd=02") }] },
    { pages: [{ ...race, html: html.replace("4001 /", "4999 /") }] },
    { expectedEntries: entries.slice(0, 5) },
    { existingEvents: [race], existingEntries: [{ ...entries[0], racer_registration_no: "4999" }] },
  ]) {
    const result = planVerifiedSitePreviousDayIngest({ ...input, ...change });
    assert.equal(result.status, "HOLD");
    assert.equal("missingEvents" in result || "missingEntries" in result, false);
  }
});

test("a missing optional ST preserves a display-only program but never invents a prediction value", () => {
  const profiled = html.replace(/<td><\/td><td>(\d{4}) \/ B1/g,
    (_match, registration) => `<td><a href="/owpc/pc/data/racersearch/profile?toban=${registration}">photo</a></td><td>${registration} / B1`);
  const withDash = profiled.replace(/(<td>4005 \/ B1[\s\S]*?<td>)0\.15(<\/td>)/, "$1-$2");
  const result = planVerifiedSitePreviousDayIngest({ ...input, pages: [{ ...race, html: withDash }] });
  assert.equal(result.status, "PASS_OFFLINE_ONLY");
  assert.equal(result.missingEntries.length, 6);
  assert.equal(result.missingEntries[0].average_st, 0.15);
  assert.equal(result.missingEntries[5].average_st, null);
  const mismatch = planVerifiedSitePreviousDayIngest({ ...input,
    pages: [{ ...race, html: withDash.replace("toban=4005", "toban=4999") }] });
  assert.equal(mismatch.status, "HOLD");
  assert.equal("missingEntries" in mismatch, false);
});

test("race-day morning official program is held if the first closing or roster cannot be verified", () => {
  const morning = { ...input, expectedRaces: [{ ...race, closing_time: "15:22" }],
    capturedAt: "2026-11-18T23:30:00Z", now: "2026-11-19T08:31:00+09:00" };
  assert.equal(planVerifiedSiteRaceDayMorningIngest(morning).status, "PASS_OFFLINE_ONLY");
  for (const change of [
    { now: "2026-11-19T15:22:00+09:00" },
    { expectedRaces: [{ ...race, closing_time: "15:21" }] },
    { expectedEntries: entries.slice(0, 5) },
  ]) {
    const outcome = planVerifiedSiteRaceDayMorningIngest({ ...morning, ...change });
    assert.equal(outcome.status, "HOLD");
    assert.equal("missingEntries" in outcome, false);
  }
});
