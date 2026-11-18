import { selectSiteProgram, selectSiteRaceProgram } from "./site-program-handoff.mjs";

// Pass the existing server-side DB client; the reader has no write dependency.
export async function readSiteProgramCandidate(client, { raceDate, now, live, race }) {
  if (typeof raceDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raceDate)) {
    return { status: "HOLD", reason: "invalid_race_date" };
  }
  let result;
  try {
    result = await client.rpc("bs_read_site_previous_day_program_candidate", { p_date: raceDate });
  } catch {
    return { status: "HOLD", reason: "snapshot_read_failed" };
  }
  if (result?.error || !result || !Object.hasOwn(result, "data") || result.data === undefined) {
    return { status: "HOLD", reason: "snapshot_read_failed" };
  }

  const input = { raceDate, now, live, snapshot: result.data };
  return race ? selectSiteRaceProgram(input, race) : selectSiteProgram(input);
}
