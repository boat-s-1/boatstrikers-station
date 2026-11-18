import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { resolveExhibition } from "../../lib/exhibitionDisplay.js";
import { readSiteProgramCandidate } from "./site-program-server-read.mjs";

const code = readFileSync(new URL("../../app/lib/boatstrikersPlatform.js", import.meta.url), "utf8")
  .replace(/^import .*;$/gm, "").replace(/^export /gm, "");
const raceDate = "2026-11-19";
const event = { race_date: raceDate, course_code: 1, race_no: 1, closing_time: "15:22" };
const boats = Array.from({ length: 6 }, (_, i) => ({
  ...event, boat_no: i + 1, racer_registration_no: String(4000 + i), racer_name: `Sample ${i}`,
}));
const now = "2026-11-18T23:58:00+09:00";
const snapshot = { race_date: raceDate, captured_at: "2026-11-18T23:55:00+09:00",
  program: { events: [event], entries: boats } };
async function detail({ enabled, clock = now, liveEntries = [], liveEvent = null }) {
  let reads = 0;
  const client = {
    rpc: async () => { reads++; return { data: snapshot }; },
    from(table) {
      const data = table === "bs_race_events" ? liveEvent : table === "bs_race_entries" ? liveEntries : null;
      const result = { data, error: null };
      return { select(){ return this; }, eq(){ return this; }, order(){ return this; },
        maybeSingle: async () => result, then: resolve => resolve(result) };
    },
  };
  class FixtureDate extends Date {
    constructor(...args) { super(...(args.length ? args : [clock])); }
  }
  const getRaceDetail = runInNewContext(code + "\ngetRaceDetail", {
    Date: FixtureDate, process: { env: {
      NEXT_PUBLIC_SUPABASE_URL: "https://example.test", SUPABASE_SERVICE_ROLE_KEY: "fixture",
      BS_PREVIOUS_DAY_SITE_DETAIL_ENABLED: enabled ? "true" : "false",
    } }, createClient: () => client, readSiteProgramCandidate, resolveExhibition,
    buildPhase2Predictions: () => ({}), console,
  });
  const data = await getRaceDetail(raceDate, 1, 1);
  return { data, reads };
}
test("normal race detail makes no snapshot requests while feature is disabled", async () => {
  const outcome = await detail({ enabled: false });
  assert.equal(outcome.reads, 0);
  assert.equal(outcome.data, null);
});
test("race detail can render mapped previous-day event and six boats with no result", async () => {
  const outcome = await detail({ enabled: true });
  assert.equal(outcome.reads, 1);
  assert.equal(outcome.data.event.program_source, "previous_day_snapshot");
  assert.equal(outcome.data.entries.length, 6);
  assert.equal(outcome.data.result, null);
  assert.equal(outcome.data.event.course_name, "桐生");
});
test("race detail keeps the ordinary live path for a verified complete race", async () => {
  const outcome = await detail({ enabled: true, clock: "2026-11-19T12:00:00+09:00",
    liveEvent: event, liveEntries: boats.map(row => ({ ...row, exhibition_time: 6.8 })) });
  assert.equal(outcome.data.entries[0].exhibition_time, 6.8);
  assert.equal(outcome.data.event.program_source, undefined);
});
