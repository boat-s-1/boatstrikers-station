-- READ ONLY — quantify possible bootstrap INSERT trigger fan-out.
-- This is a risk estimate, NOT a simulation of OpenAPI payload availability.
WITH dates AS (
 SELECT generate_series((now() AT TIME ZONE 'Asia/Tokyo')::date-7,
                        (now() AT TIME ZONE 'Asia/Tokyo')::date,
                        interval '1 day')::date AS race_date
), race_keys AS (
 SELECT race_date,course_code,race_no FROM public.bs_race_results
 WHERE race_date BETWEEN (now() AT TIME ZONE 'Asia/Tokyo')::date-7
                     AND (now() AT TIME ZONE 'Asia/Tokyo')::date
 UNION
 SELECT race_date,course_code,race_no FROM public.bs_race_events
 WHERE race_date BETWEEN (now() AT TIME ZONE 'Asia/Tokyo')::date-7
                     AND (now() AT TIME ZONE 'Asia/Tokyo')::date
), per_race AS (
 SELECT k.race_date,k.course_code,k.race_no,
        (e.race_no IS NULL) AS event_missing,
        (6-count(en.boat_no))::integer AS missing_boat_slots
 FROM race_keys k
 LEFT JOIN public.bs_race_events e USING(race_date,course_code,race_no)
 LEFT JOIN public.bs_race_entries en USING(race_date,course_code,race_no)
 GROUP BY k.race_date,k.course_code,k.race_no,e.race_no
)
SELECT d.race_date,count(p.race_no) AS known_races,
       count(*) FILTER(WHERE p.event_missing) AS missing_events,
       coalesce(sum(greatest(p.missing_boat_slots,0)),0) AS potential_entry_inserts,
       CASE WHEN d.race_date=(now() AT TIME ZONE 'Asia/Tokyo')::date
            THEN coalesce(sum(greatest(p.missing_boat_slots,0)),0)
            ELSE 0 END AS potential_ichika_evaluator_invocations
FROM dates d LEFT JOIN per_race p USING(race_date)
GROUP BY d.race_date ORDER BY d.race_date;
-- On today's entries, trg_ichika_escape_surge_on_exhibition_update
-- invokes evaluate_ichika_escape_surge_alerts() once per inserted boat.
-- Additional triggers: bs_race_entries_exhibition_guard (BEFORE INSERT),
-- trg_bs_track_entry_first_seen (AFTER INSERT),
-- trg_settle_theory_recommendations (event INSERT).
-- The latter exits early if NEW.trifecta IS NULL.
