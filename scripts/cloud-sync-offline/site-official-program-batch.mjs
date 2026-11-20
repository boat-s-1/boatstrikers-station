import { inspectBatch } from "./batch-gate.mjs";
import { inspectRaceKeys } from "./race-key-gate.mjs";
import { parseSiteOfficialRacelist } from "./site-official-racelist.mjs";

const raceKey = row => `${row.race_date}/${row.course_code}/${row.race_no}`;
const boatKey = row => `${raceKey(row)}/${row.boat_no}`;
const hold = (reason, key) => ({ status: "HOLD", reason, ...(key && { key }) });

export function prepareSiteOfficialProgram({ raceDate, expectedRaces, expectedEntries, pages }) {
  // Supply the schedule and roster from the official index, independent of pages.
  const manifest = inspectBatch(expectedRaces, expectedEntries, expectedRaces, raceDate);
  if (manifest.status === "HOLD") return hold("invalid_official_manifest");
  const expectedBoats = new Map(expectedEntries.map(row => [boatKey(row), Number(row.racer_registration_no)]));
  if (Array.from(expectedBoats.values()).some(registration => registration < 1)) {
    return hold("invalid_official_manifest");
  }

  const observed = inspectRaceKeys(pages, raceDate);
  if (observed.status === "HOLD") return hold("invalid_page_keys");
  const expectedKeys = new Set(expectedRaces.map(raceKey));
  if (observed.count !== expectedKeys.size || pages.some(page => !expectedKeys.has(raceKey(page)))) {
    return hold("race_coverage_mismatch");
  }

  const events = [];
  const entries = [];
  for (const page of pages) {
    const { race_date, course_code, race_no, html } = page;
    let parsed;
    try {
      parsed = parseSiteOfficialRacelist(html, {
        raceDate: race_date, courseCode: course_code, raceNo: race_no,
      });
    } catch {
      return hold("unverified_official_page", raceKey(page));
    }
    const race = { race_date, course_code, race_no };
    events.push({ ...race, closing_time: parsed.closing_time });
    for (const entry of parsed.entries) {
      const row = { ...race, ...entry };
      if (Number(row.racer_registration_no) !== expectedBoats.get(boatKey(row))) {
        return hold("official_roster_mismatch", boatKey(row));
      }
      entries.push(row);
    }
  }
  return { status: "PASS_OFFLINE_ONLY", events, entries };
}
