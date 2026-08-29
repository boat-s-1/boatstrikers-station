import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { parseTsuOfficialOriginalTenji } from "../lib/tsuOfficialOriginalTenji.js";
import { parseAmagasakiOfficialOriginalTenji } from "../lib/amagasakiOfficialOriginalTenji.js";
import { parseMikuniOfficialOriginalTenji } from "../lib/mikuniVerifiedOriginalTenji.js";
import { acquisitionReason } from "../lib/exhibitionAcquisitionTelemetry.js";

const fixture = (name) => fs.readFileSync(new URL(`./fixtures/original-tenji/${name}`, import.meta.url), "utf8");
const tsu = fixture("tsu-20260829.html");
const amagasaki = fixture("amagasaki-20260829.html");
const mikuni = fixture("mikuni-20260829.html");

test("Tsu actual official table yields six full-lap original timings", () => {
  const rows = parseTsuOfficialOriginalTenji(tsu);
  assert.equal(rows.length, 6);
  assert.deepEqual(rows[0], { boatNo: 1, exhibitionTime: 6.73, lapTime: 37.35, turnTime: 4.65, straightTime: 8.47 });
});

test("Amagasaki actual official table yields six rows without inventing straight time", () => {
  const rows = parseAmagasakiOfficialOriginalTenji(amagasaki);
  assert.equal(rows.length, 6);
  assert.deepEqual(rows[0], { boatNo: 1, exhibitionTime: 6.72, lapTime: 38.05, turnTime: 11.52, straightTime: null });
});

test("Mikuni actual official table keeps half-lap separate from one-lap", () => {
  const rows = parseMikuniOfficialOriginalTenji(mikuni);
  assert.equal(rows.length, 6);
  assert.deepEqual(rows[0], { boatNo: 1, racerNo: "4546", exhibitionTime: null, lapTime: null, halfLapTime: 18.68, turnTime: 5.73, straightTime: 6.67 });
  assert.deepEqual(parseMikuniOfficialOriginalTenji(mikuni + mikuni), rows);
  assert.deepEqual(parseMikuniOfficialOriginalTenji(mikuni + mikuni.replace("18.68", "18.69")), []);
});

test("adapters fail closed on missing values, duplicate boat identity, or renamed half-lap", () => {
  assert.deepEqual(parseTsuOfficialOriginalTenji(tsu.replace(">8.47<", ">-<")), []);
  assert.deepEqual(parseAmagasakiOfficialOriginalTenji(amagasaki.replace("tei_color6", "tei_color5")), []);
  assert.deepEqual(parseMikuniOfficialOriginalTenji(mikuni.replace("半周ﾗｯﾌﾟ", "一周ﾗｯﾌﾟ")), []);
});

test("official no-data is reported as unavailable rather than a layout change", () => {
  assert.equal(acquisitionReason({ ok: false, error: "official_measurements_unavailable" }), "unavailable");
});

test("all notification collectors persist only present values and support half-lap", () => {
  for (const path of ["exhibition-alerts", "ichika-hidden-escape", "hatsune-womens-inner-break"]) {
    const code = fs.readFileSync(new URL(`../app/api/cron/${path}/route.js`, import.meta.url), "utf8");
    assert.ok(code.includes("row.halfLapTime!==null&&row.halfLapTime!==undefined"));
    assert.ok(code.includes("update.official_half_lap=row.halfLapTime"));
  }
});
