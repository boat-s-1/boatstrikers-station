# PR298 — two additional dependency tables: catalog-only structural snapshot (2026-11-18)

This document records **current production catalog metadata**, not historical CREATE TABLE SQL. All queries were read-only; no table data or secrets were accessed.

## public.bs_race_result_entries

17 columns in attnum order:
`id bigint NOT NULL`; `race_date date NOT NULL`; `course_code smallint NOT NULL`; `race_no smallint NOT NULL`; `boat_no smallint NOT NULL`; `arrival_order smallint`; `actual_course smallint`; `actual_start_timing numeric(8,3)`; `synced_at timestamptz NOT NULL DEFAULT now()`; `racer_registration_no text`; `finish_position integer`; `finish_status text`; `entry_course integer`; `start_timing numeric`; `start_symbol text`; `is_flying boolean DEFAULT false`; `is_late boolean DEFAULT false`.

Constraints:
- `PRIMARY KEY (id)`
- `UNIQUE (race_date, course_code, race_no, boat_no)`

RLS enabled; zero non-internal triggers. Current catalog does not establish whether `id` is supplied by an application or identity mechanism beyond the observed absence of a column default.

## public.racer_gender_master

7 columns in attnum order:
`racer_id integer NOT NULL`; `racer_name text`; `racer_gender text NOT NULL`; `source_name text`; `source_updated_at date`; `created_at timestamptz NOT NULL DEFAULT now()`; `updated_at timestamptz NOT NULL DEFAULT now()`.

Constraints:
- `PRIMARY KEY (racer_id)`
- `CHECK (racer_gender = ANY (ARRAY['F'::text, 'M'::text]))`

RLS enabled; zero non-internal triggers.

## Limitations and next gate

No direct CREATE TABLE for either object was found in the 133 stored migration statements by regex. These current-state structures may have evolved after the first migration, and must **not** be prepended as an authoritative historical genesis baseline. Additional checks would be needed for indexes, ACLs, RLS policies, dependencies, historical provenance and full replay.

PR298 remains Draft/HOLD. No production DB/Cron writes or new paid branch.
