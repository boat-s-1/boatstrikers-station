import test from "node:test";
import assert from "node:assert/strict";
import { parseSiteOfficialRacelist } from "./site-official-racelist.mjs";

import { prepareSiteOfficialProgram } from "./site-official-program-batch.mjs";
const race = { raceDate: "2026-11-18", courseCode: 1, raceNo: 1 };
const link = number => `/owpc/pc/race/racelist?rno=${number}&amp;jcd=01&amp;hd=20261118`;
const boats = Array.from({ length: 6 }, (_, index) => `
  <tbody class="is-fs12"><tr>
    <td class="is-boatColor${index + 1}">${index + 1}</td><td></td>
    <td>${4000 + index} / B1<div class="is-fs18"><a>Sample ${index}</a></div></td>
    <td>0.15</td><td>5.00</td><td>6.00</td><td>1<br>35</td><td>2<br>45</td>
  </tr></tbody>`).join("");
const page = `
  <img src="/text_place2_01.png">
  <table><thead><tr>
    <th><a href="${link(1)}">1R</a></th>
    <th class="is-thColor3"><a href="${link(2)}">2R</a></th>
  </tr></thead><tbody><tr><td>締切予定時刻</td><td>15:22</td><td>15:47</td></tr></tbody></table>
  <table>${boats}</table>`;

test("reads the selected race and six distinct registrations", () => {
  const result = parseSiteOfficialRacelist(page, race);
  assert.equal(result.closing_time, "15:22");
  assert.deepEqual(result.entries.map(entry => entry.racer_registration_no),
    ["04000", "04001", "04002", "04003", "04004", "04005"]);
});

test("rejects neighboring race, different venue, and different date", () => {
  for (const changes of [{ raceNo: 2 }, { courseCode: 2 }, { raceDate: "2026-11-17" }]) {
    assert.throws(() => parseSiteOfficialRacelist(page, { ...race, ...changes }), /does not match/);
  }
});

test("rejects ambiguous or missing current selection", () => {
  assert.throws(() => parseSiteOfficialRacelist(page.replace(' class="is-thColor3"', ""), race), /ambiguous/);
  assert.throws(() => parseSiteOfficialRacelist(page.replace("<th>", '<th class="inactive">'), race), /ambiguous/);
});

test("rejects duplicate registrations and invalid calendar dates", () => {
  assert.throws(() => parseSiteOfficialRacelist(page.replace("4001 /", "4000 /"), race), /unique and positive/);
  assert.throws(() => parseSiteOfficialRacelist(page, { ...race, raceDate: "2026-02-30" }), /Invalid official race key/);
});

test("prepares a full independent manifest, with no rows on any hold", () => {
  const key = { race_date: race.raceDate, course_code: race.courseCode, race_no: race.raceNo };
  const second = { ...key, course_code: 2 };
  const secondPage = page.replaceAll("jcd=01", "jcd=02").replace("text_place2_01", "text_place2_02");
  const options = {
    raceDate: race.raceDate,
    expectedRaces: [key, second],
    expectedEntries: [key, second].flatMap(raceKey => Array.from({ length: 6 }, (_, index) => ({
      ...raceKey, boat_no: index + 1, racer_registration_no: String(4000 + index),
    }))),
    pages: [{ ...key, html: page }, { ...second, html: secondPage }],
  };
  const full = prepareSiteOfficialProgram(options);
  assert.equal(full.status, "PASS_OFFLINE_ONLY");
  assert.equal(full.events.length, 2);
  assert.equal(full.entries.length, 12);
  for (const [change, reason] of [
    [{ pages: options.pages.slice(0, 1) }, "race_coverage_mismatch"],
    [{ pages: [options.pages[0], options.pages[0]] }, "invalid_page_keys"],
    [{ pages: [options.pages[0], { ...second, html: page }] }, "unverified_official_page"],
    [{ pages: [options.pages[0], { ...second, html: secondPage.replace("4001 /", "4999 /") }] }, "official_roster_mismatch"],
    [{ expectedEntries: options.expectedEntries.slice(0, 6) }, "invalid_official_manifest"],
  ]) {
    const rejected = prepareSiteOfficialProgram({ ...options, ...change });
    assert.equal(rejected.status, "HOLD");
    assert.equal(rejected.reason, reason);
    assert.equal("events" in rejected || "entries" in rejected, false);
  }
});
