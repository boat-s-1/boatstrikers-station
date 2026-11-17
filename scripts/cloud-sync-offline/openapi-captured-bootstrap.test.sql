-- PostgreSQL 17 disposable CI only: execute unmodified catalog-captured
-- bs_apply_openapi_bootstrap() against minimal schema with real FK/unique keys.
-- No production database, network, alert delivery or paid Supabase branch.
BEGIN;
CREATE SCHEMA bootstrap_fixture;
SET search_path TO bootstrap_fixture, public;
CREATE TABLE public.bs_race_events (
 id bigint PRIMARY KEY, race_date date NOT NULL, course_code smallint NOT NULL,
 race_no smallint NOT NULL, course_name text, race_name text,
 deadline_time time, closing_time time, distance integer, race_day_no integer,
 race_status text, program_available boolean, api_synced_at timestamptz,
 data_source text, synced_at timestamptz, created_at timestamptz, updated_at timestamptz,
 UNIQUE(race_date,course_code,race_no));
CREATE TABLE public.bs_race_entries (
 id bigint PRIMARY KEY, race_date date NOT NULL, course_code smallint NOT NULL,
 race_no smallint NOT NULL, boat_no smallint NOT NULL,
 racer_registration_no text, racer_name text, racer_class text,
 national_win_rate numeric, local_win_rate numeric, national_2_rate numeric,
 local_2_rate numeric, average_st numeric, flying_count smallint, late_count smallint,
 motor_no smallint, motor_number smallint, motor_2_rate numeric, motor_top2_rate numeric,
 boat_machine_no smallint, race_boat_number smallint, boat_2_rate numeric,
 race_boat_top2_rate numeric, racer_weight numeric, weight numeric,
 data_source text, api_synced_at timestamptz, synced_at timestamptz,
 created_at timestamptz, updated_at timestamptz,
 UNIQUE(race_date,course_code,race_no,boat_no),
 FOREIGN KEY(race_date,course_code,race_no)
 REFERENCES public.bs_race_events(race_date,course_code,race_no));
COMMIT;
-- The actual function is loaded by CI between setup and assertions.
