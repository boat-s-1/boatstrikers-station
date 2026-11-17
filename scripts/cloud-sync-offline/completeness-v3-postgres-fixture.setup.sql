-- Disposable PostgreSQL fixture only. NEVER run against production.
BEGIN;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE TABLE public.bs_race_events (
 race_date date NOT NULL,course_code smallint NOT NULL,race_no smallint NOT NULL,
 course_name text,race_cancel_code text,trifecta text,trifecta_payout integer,
 PRIMARY KEY(race_date,course_code,race_no));
CREATE TABLE public.bs_race_results (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 race_date date NOT NULL,course_code smallint NOT NULL,race_no smallint NOT NULL,
 trifecta_payout integer,trifecta_result text,winning_trifecta text);
CREATE TABLE public.bs_race_entries (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 race_date date NOT NULL,course_code smallint NOT NULL,race_no smallint NOT NULL,
 boat_no smallint NOT NULL,racer_registration_no text,official_exhibition_time numeric,exhibition_time numeric,
 actual_start_timing numeric,actual_st numeric,
 UNIQUE(race_date,course_code,race_no,boat_no));
CREATE TABLE public.bs_race_data_quality_alerts (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 race_date date NOT NULL,course_code smallint NOT NULL,course_name text,
 race_no smallint NOT NULL,severity text,status text,missing_fields text[],detail jsonb,
 first_detected_at timestamptz,last_detected_at timestamptz,resolved_at timestamptz,
 updated_at timestamptz,
 UNIQUE(race_date,course_code,race_no));
CREATE TABLE public.bs_live_source_sync_logs (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 source text,sync_kind text,race_date date,status text,
 entry_rows integer,event_rows integer,result_rows integer,result_entry_rows integer,
 started_at timestamptz,finished_at timestamptz,detail jsonb);
CREATE FUNCTION public.bs_race_data_quality_rows(p_date date)
RETURNS TABLE (
 race_date date,course_code smallint,course_name text,race_no smallint,
 is_cancelled boolean,entry_rows bigint,exhibition_rows bigint,start_rows bigint,
 has_result boolean,has_payout boolean,missing_fields text[],is_complete boolean)
LANGUAGE sql STABLE AS $fn$
 SELECT e.race_date,e.course_code,max(e.course_name),e.race_no,
        bool_or(e.race_cancel_code IS NOT NULL),
        count(en.id),
        count(en.id) FILTER (WHERE coalesce(en.official_exhibition_time,en.exhibition_time) IS NOT NULL),
        count(en.id) FILTER (WHERE coalesce(en.actual_start_timing,en.actual_st) IS NOT NULL),
        coalesce(bool_or(r.id IS NOT NULL),false),
        coalesce(bool_or(r.id IS NOT NULL AND r.trifecta_payout IS NOT NULL
          AND coalesce(r.trifecta_result,r.winning_trifecta) IS NOT NULL),false),
        CASE WHEN bool_or(e.race_cancel_code IS NOT NULL) THEN '{}'::text[]
        ELSE array_remove(ARRAY[
          CASE WHEN count(en.id)<>6 THEN 'entries' END,
          CASE WHEN count(en.id) FILTER (WHERE coalesce(en.official_exhibition_time,en.exhibition_time) IS NOT NULL)<>6 THEN 'exhibition' END,
          CASE WHEN NOT coalesce(bool_or(r.id IS NOT NULL),false) THEN 'result' END,
          CASE WHEN NOT coalesce(bool_or(r.id IS NOT NULL AND r.trifecta_payout IS NOT NULL AND coalesce(r.trifecta_result,r.winning_trifecta) IS NOT NULL),false) THEN 'payout' END,
          CASE WHEN count(en.id) FILTER (WHERE coalesce(en.actual_start_timing,en.actual_st) IS NOT NULL)<>6 THEN 'result_detail' END
        ],NULL) END,
        bool_or(e.race_cancel_code IS NOT NULL) OR
        (count(en.id)=6
         AND count(en.id) FILTER (WHERE coalesce(en.official_exhibition_time,en.exhibition_time) IS NOT NULL)=6
         AND coalesce(bool_or(r.id IS NOT NULL AND r.trifecta_payout IS NOT NULL AND coalesce(r.trifecta_result,r.winning_trifecta) IS NOT NULL),false)
         AND count(en.id) FILTER (WHERE coalesce(en.actual_start_timing,en.actual_st) IS NOT NULL)=6)
 FROM public.bs_race_events e
 LEFT JOIN public.bs_race_entries en USING(race_date,course_code,race_no)
 LEFT JOIN public.bs_race_results r USING(race_date,course_code,race_no)
 WHERE e.race_date=p_date
 GROUP BY e.race_date,e.course_code,e.race_no
$fn$;
COMMIT;
