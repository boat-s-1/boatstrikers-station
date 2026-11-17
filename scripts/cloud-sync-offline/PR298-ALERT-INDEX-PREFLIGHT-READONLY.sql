-- PR298: read-only verification of indexes relied on by current-day
-- exhibition evaluation and conflict-safe Ichika alert insertion.
-- Catalog inspection only; does not run evaluator or modify data.
WITH target AS (
 SELECT 'public.bs_race_entries'::regclass AS table_oid,
        ARRAY['race_date','course_code','race_no','boat_no']::text[] AS key_columns
 UNION ALL
 SELECT 'public.bs_ichika_escape_surge_alerts'::regclass,
        ARRAY['race_date','course_code','race_no']::text[]
), indexes AS (
 SELECT t.table_oid,t.key_columns,i.indexrelid::regclass::text AS index_name,
        i.indisunique,i.indisvalid,
        ARRAY(SELECT a.attname::text
              FROM unnest(i.indkey) WITH ORDINALITY k(attnum,ord)
              JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=k.attnum
              WHERE k.ord<=i.indnkeyatts ORDER BY k.ord) AS columns
 FROM target t JOIN pg_index i ON i.indrelid=t.table_oid
)
SELECT table_oid::text AS table_name,
       bool_or(indisunique AND indisvalid AND columns=key_columns)
         AS required_unique_index_present,
       string_agg(index_name,', ' ORDER BY index_name)
         FILTER (WHERE indisunique AND indisvalid AND columns=key_columns)
         AS matching_unique_indexes
FROM indexes
GROUP BY table_oid,key_columns ORDER BY table_name;
