-- Read-only aggregate query template; operator-reviewed, NOT scheduled or deployed.
-- Pre-filter articles once into a bounded MATERIALIZED CTE; avoids repeated whole-table scans.
-- Temporal matches can overlap and are not proof of per-run article causality.
WITH bounds AS (
  SELECT statement_timestamp() AS observed_at,
         statement_timestamp() - interval '21 days' AS window_start,
         statement_timestamp() - interval '3 minutes' AS window_end
),
run_windows AS MATERIALIZED (
  SELECT r.id, r.started_at, r.status, r.finished_at
    FROM public.hatsune_news_cron_runs AS r CROSS JOIN bounds AS b
   WHERE r.job_name = 'pipeline'
     AND r.started_at >= b.window_start AND r.started_at < b.window_end
),
bounded_articles AS MATERIALIZED (
  SELECT n.created_at
    FROM public.hatsune_news AS n CROSS JOIN bounds AS b
   WHERE n.created_at >= b.window_start
     AND n.created_at < b.window_end + interval '2 minutes'
),
per_run AS (
  SELECT r.id, r.status, r.finished_at,
         count(n.created_at)::bigint AS article_matches
    FROM run_windows AS r
    LEFT JOIN bounded_articles AS n
      ON n.created_at >= r.started_at
     AND n.created_at < r.started_at + interval '2 minutes'
   GROUP BY r.id, r.status, r.finished_at
)
SELECT to_char(b.observed_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"') AS observed_at,
       to_char(b.window_start AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"') AS window_start,
       to_char(b.window_end AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"') AS window_end,
       count(p.id)::bigint AS runs_total,
       count(p.id) FILTER (WHERE p.status = 'running' AND p.finished_at IS NULL)::bigint AS running_without_finish,
       count(p.id) FILTER (WHERE p.status = 'partial')::bigint AS partial_runs,
       count(p.id) FILTER (WHERE p.article_matches > 0)::bigint AS windows_with_articles,
       coalesce(sum(p.article_matches),0)::bigint AS temporal_article_matches
  FROM bounds AS b LEFT JOIN per_run AS p ON true
 GROUP BY b.observed_at,b.window_start,b.window_end;
