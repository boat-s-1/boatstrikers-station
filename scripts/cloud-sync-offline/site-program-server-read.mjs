import { selectSiteProgram, selectSiteRaceProgram } from "./site-program-handoff.mjs";

// Pass the existing server-side DB client; the reader has no write dependency.
export async function readSiteProgramCandidate(client, { raceDate, now, live, race,
  enableMorning = false, morningOnly = false }) {
  if (typeof raceDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raceDate)) {
    return { status: "HOLD", reason: "invalid_race_date" };
  }
  let result = { data: null };
  if (!morningOnly) {
    try {
      result = await client.rpc("bs_read_site_previous_day_program_candidate", { p_date: raceDate });
    } catch {
      return { status: "HOLD", reason: "snapshot_read_failed" };
    }
    if (result?.error || !result || !Object.hasOwn(result, "data") || result.data === undefined) {
      return { status: "HOLD", reason: "snapshot_read_failed" };
    }
  }

  let snapshot = result.data;
  if (!snapshot && enableMorning) {
    try {
      const morning = await client.rpc("bs_read_site_race_day_program_candidate", { p_date: raceDate });
      if (morning?.error || !morning || !Object.hasOwn(morning, "data") || morning.data === undefined) {
        return { status: "HOLD", reason: "morning_snapshot_read_failed" };
      }
      snapshot = morning.data;
      if (snapshot && snapshot.capture_timing !== "race_day_morning") {
        return { status: "HOLD", reason: "invalid_morning_snapshot_source" };
      }
    } catch {
      return { status: "HOLD", reason: "morning_snapshot_read_failed" };
    }
  }
  const input = { raceDate, now, live, snapshot };
  return race ? selectSiteRaceProgram(input, race) : selectSiteProgram(input);
}

export function tomorrowProgramDate(now) {
  return new Date(Date.parse(now) + 33 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export async function readTomorrowSiteProgram(client, raceDate, now, enabled) {
  if (!enabled || raceDate !== tomorrowProgramDate(now)) return null;
  const selection = await readSiteProgramCandidate(client, { raceDate, now });
  if (selection.status !== "READY" || selection.source !== "previous_day_snapshot") return null;
  return {
    events: selection.events.map(row => ({
      ...row, program_available: true, race_status: "scheduled", program_source: selection.source,
    })),
    entries: selection.entries,
  };
}

export async function readTodayMorningSiteProgram(client, raceDate, now, enabled) {
  const time = Date.parse(now);
  if (!enabled || !Number.isFinite(time) || raceDate !== new Date(time + 32400000).toISOString().slice(0, 10)) return null;
  const selection = await readSiteProgramCandidate(client, { raceDate, now,
    enableMorning: true, morningOnly: true });
  if (selection.status !== "READY" || selection.source !== "race_day_morning_snapshot") return null;
  return {
    events: selection.events.map(row => ({ ...row, program_available: true,
      race_status: "scheduled", program_source: selection.source })),
    entries: selection.entries,
  };
}

export function hasOfficialRaceCancellation(event) {
  return event?.race_status === "cancelled" &&
    ["official_cancelled", "weather_postponed"].includes(event.race_cancel_code);
}
