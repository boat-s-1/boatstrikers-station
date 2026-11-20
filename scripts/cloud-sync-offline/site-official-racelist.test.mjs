import { selectSiteRaceProgram } from "./site-program-handoff.mjs";
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

test("a dash in an optional statistic keeps the six-boat display program without inventing a value", () => {
  const withProfiles = page.replace(/<td><\/td>\s*<td>(\d{4}) \/ B1/g,
    (_match, registration) => `<td><a href="/owpc/pc/data/racersearch/profile?toban=${registration}">photo</a></td><td>${registration} / B1`);
  const rookie = withProfiles.replace(/(<td>4005 \/ B1[\s\S]*?<td>)0\.15(<\/td>)/, "$1-$2");
  const result = parseSiteOfficialRacelist(rookie, race);
  assert.equal(result.program_only, true);
  assert.equal(result.entries.length, 6);
  assert.equal(result.entries[0].average_st, 0.15);
  assert.equal(result.entries[5].average_st, null);
  assert.equal(result.entries[5].racer_registration_no, "04005");
  assert.throws(() => parseSiteOfficialRacelist(rookie.replace("toban=4005", "toban=4999"), race),
    /identity is incomplete/);
  assert.throws(() => parseSiteOfficialRacelist(rookie.replace("4005 / B1", "4004 / B1"), race),
    /identity is incomplete/);
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


test("only matching current official HTML restores a changed live roster", () => {
  const event = { race_date: race.raceDate, course_code: race.courseCode, race_no: 1 };
  const entries = Array.from({ length: 6 }, (_, i) => ({
    ...event, boat_no: i + 1, racer_registration_no: String(4000 + i),
  }));
  const options = { raceDate: race.raceDate, now: "2026-11-18T14:50:00+09:00",
    snapshot: { race_date: race.raceDate, captured_at: "2026-11-17T23:00:00+09:00",
      program: { events: [event], entries } },
    live: { events: [event], entries: entries.map((row, index) => index
      ? row : { ...row, racer_registration_no: "4999" }) },
  };
  const key = { courseCode: 1, raceNo: 1 };
  const correction = { html: page.replace("4000 /", "4999 /"), capturedAt: "2026-11-18T14:40:00+09:00" };
  assert.equal(selectSiteRaceProgram(options, key).reason, "live_registration_conflict");
  assert.equal(selectSiteRaceProgram(options, key, correction).correctionVerified, true);
  for (const evidence of [
    { ...correction, html: page },
    { ...correction, html: correction.html.replace("jcd=01", "jcd=02") },
    { ...correction, capturedAt: "2026-11-17T23:59:00+09:00" },
    { ...correction, capturedAt: "2026-11-18T14:51:00+09:00" },
  ]) assert.equal(selectSiteRaceProgram(options, key, evidence).reason, "live_registration_conflict");
  const partial = { ...options, live: { ...options.live, entries: options.live.entries.slice(0, 5) } };
  assert.equal(selectSiteRaceProgram(partial, key, correction).reason, "live_registration_conflict");
});
