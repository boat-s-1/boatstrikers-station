import { prepareSiteOfficialProgram } from "./site-official-program-batch.mjs";
import { planPreviousDayProgramSave, planRaceDayMorningProgramSave } from "./site-previous-day-save-plan.mjs";

// Pure orchestration. The caller must obtain the schedule, roster and HTML
// independently, and provide a date-scoped read-only snapshot of existing rows.
export function planVerifiedSitePreviousDayIngest(input) {
  const { raceDate, expectedRaces, expectedEntries, pages, capturedAt, now,
    existingEvents, existingEntries } = input;
  const batch = prepareSiteOfficialProgram({ raceDate, expectedRaces, expectedEntries, pages });
  if (batch.status !== "PASS_OFFLINE_ONLY") return batch;
  return planPreviousDayProgramSave({ raceDate, capturedAt, now, batch,
    expectedRaces, expectedEntries, existingEvents, existingEntries });
}

export function planVerifiedSiteRaceDayMorningIngest(input) {
  const { raceDate, expectedRaces, expectedEntries, pages, capturedAt, now,
    existingEvents, existingEntries } = input;
  const batch = prepareSiteOfficialProgram({ raceDate, expectedRaces, expectedEntries, pages });
  if (batch.status !== "PASS_OFFLINE_ONLY") return batch;
  return planRaceDayMorningProgramSave({ raceDate, capturedAt, now, batch,
    expectedRaces, expectedEntries, existingEvents, existingEntries });
}
