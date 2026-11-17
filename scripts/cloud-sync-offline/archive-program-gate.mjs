import { inspectBatch } from "./batch-gate.mjs";

// Pure transform only: no HTTP, database, secrets, or writes.
// The expected manifest must be independently verified, not derived from the input.
export function inspectArchiveProgram(json, expectedDate, expectedKeys) {
  const stadiums = json?.programs?.stadiums;
  if (!stadiums || typeof stadiums !== "object" || Array.isArray(stadiums)) return { status:"HOLD", issues:["missing_stadiums"] };
  const events = [], entries = [], issues = [];
  for (const [stadiumKey, stadium] of Object.entries(stadiums)) {
    const course_code = Number(stadium?.stadium_number ?? stadiumKey);
    if (!Number.isInteger(course_code) || course_code < 1 || course_code > 24 || !stadium?.races || typeof stadium.races !== "object" || Array.isArray(stadium.races)) { issues.push("invalid_stadium"); continue; }
    for (const [raceKey, race] of Object.entries(stadium.races)) {
      const race_no = Number(race?.race_number ?? raceKey);
      const race_date = race?.date;
      const event = {race_date,course_code,race_no};
      events.push(event);
      if (!race?.racers || typeof race.racers !== "object" || Array.isArray(race.racers)) {issues.push("missing_racers");continue;}
      for (const [boatKey, racer] of Object.entries(race.racers)) {
        entries.push({...event,boat_no:Number(racer?.entry_number ?? boatKey),racer_registration_no:racer?.number});
      }
    }
  }
  const gate = inspectBatch(events,entries,expectedKeys,expectedDate);
  return {status:issues.length || gate.status !== "PASS_OFFLINE_ONLY"?"HOLD":"PASS_OFFLINE_ONLY",issues:[...issues,...gate.issues],races:events.length,boats:entries.length};
}
