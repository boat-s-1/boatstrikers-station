import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
await db.exec(`
  CREATE ROLE anon;
  CREATE ROLE authenticated;
  CREATE ROLE service_role;
  CREATE TABLE bs_race_events (
    id bigint PRIMARY KEY, race_date date, course_code smallint, race_no smallint,
    closing_time time, deadline_time time, race_status text, program_available boolean,
    data_source text, synced_at timestamptz, created_at timestamptz, updated_at timestamptz,
    UNIQUE (race_date, course_code, race_no)
  );
  CREATE TABLE bs_race_entries (
    id bigint PRIMARY KEY, race_date date, course_code smallint, race_no smallint, boat_no smallint,
    racer_registration_no text CHECK (racer_registration_no <> '04999'), racer_name text,
    national_win_rate numeric, local_win_rate numeric, average_st numeric,
    motor_2_rate numeric, boat_2_rate numeric, data_source text, synced_at timestamptz,
    created_at timestamptz, updated_at timestamptz,
    UNIQUE (race_date, course_code, race_no, boat_no),
    FOREIGN KEY (race_date, course_code, race_no) REFERENCES bs_race_events (race_date, course_code, race_no)
  );
`);
await db.exec(readFileSync(new URL("./site-previous-day-program.candidate.sql", import.meta.url), "utf8"));
const [{ next, today }] = (await db.query(`SELECT ((now() AT TIME ZONE 'Asia/Tokyo')::date + 1)::text AS next,
  (now() AT TIME ZONE 'Asia/Tokyo')::date::text AS today`)).rows;
const events = [1, 2].map(race_no => ({ race_date: next, course_code: 1, race_no, closing_time: "15:00" }));
const entries = events.flatMap(event => Array.from({length: 6}, (_, i) => ({
  ...event, boat_no: i + 1, racer_registration_no: String(4000 + i).padStart(5, "0"),
})));
const save = async (program = events, boats = entries, day = next, capture = new Date().toISOString()) =>
  (await db.query("SELECT bs_apply_site_previous_day_program_candidate($1,$2,$3,$4) AS result",
    [day,capture,JSON.stringify(program),JSON.stringify(boats)])).rows[0].result;
const counts = async () => (await db.query("SELECT (SELECT count(*)::int FROM bs_race_events) AS events, (SELECT count(*)::int FROM bs_race_entries) AS entries")).rows[0];

await assert.rejects(() => save(events, entries.slice(0,11)), /incomplete program/);
await assert.rejects(() => save(events, entries.map((e,i) => i===1 ? {...e,racer_registration_no:"4000"} : e)), /invalid program keys/);
await assert.rejects(() => save(events, entries, today), /previous-day/);
await assert.rejects(() => save(events, entries, next, new Date(Date.now()+60000).toISOString()), /previous-day/);
const bad = entries.map((e,i) => i===11 ? {...e,racer_registration_no:"04999"} : e);
await assert.rejects(() => save(events,bad), /check constraint/);
assert.deepEqual(await counts(), {events:0,entries:0});
await db.exec(`
  CREATE FUNCTION skip_one_boat() RETURNS trigger LANGUAGE plpgsql AS $$
  BEGIN RETURN CASE WHEN NEW.boat_no = 6 THEN NULL ELSE NEW END; END; $$;
  CREATE TRIGGER skip_boat BEFORE INSERT ON bs_race_entries FOR EACH ROW EXECUTE FUNCTION skip_one_boat();
`);
await assert.rejects(() => save(), /postcondition/);
assert.deepEqual(await counts(), {events:0,entries:0});
await db.exec("DROP TRIGGER skip_boat ON bs_race_entries");
assert.deepEqual(await save(), {events_inserted:2,entries_inserted:12});
assert.deepEqual(await save(), {events_inserted:0,entries_inserted:0});
await assert.rejects(() => save(events, entries.map((e,i) => i===0 ? {...e,racer_registration_no:"04998"} : e)), /conflicts/);
assert.deepEqual(await counts(), {events:2,entries:12});
assert.deepEqual((await db.query("SELECT DISTINCT data_source FROM bs_race_entries")).rows,[{data_source:"BOATRACE_OFFICIAL_PREVIOUS_DAY"}]);
const permissions = (await db.query(`SELECT r, has_function_privilege(r,
  'bs_apply_site_previous_day_program_candidate(date,timestamptz,jsonb,jsonb)', 'EXECUTE') allowed
  FROM unnest(ARRAY['anon','authenticated','service_role']) r`)).rows;
assert.deepEqual(permissions.map(row=>row.allowed),[false,false,true]);
console.log("PostgreSQL fixture passed: structure, rollover, rollback, clean retry, replay, conflict, source, ACL");
console.log((await db.query("SELECT current_setting('server_version') AS version")).rows[0]);
await db.close();
