-- Read-only aggregate query template for operator-reviewed diagnostics.
-- Does NOT identify individual article-to-run causality; overlapping windows can double-count.
-- No writes, no privileged functions, no secrets, no raw article rows.
WITH bounds AS (
  SELECT statement_timestamp() AS observed_at,
         statement_timestamp() - interval '21 days' AS window_start,
         statement_timestamp() - interval '3 minutes' AS window_end
),
run_windows AS (
  SELECT r.started_at, r.status, r.finished_at,
         (SELECT count(*)::bigint
            FROM public.hatsune_news AS n
           WHERE n.created_at >= r.started_at
             AND n.created_at < r.started_at + interval '2 minutes') AS article_matches
    FROM public.hatsune_news_cron_runs AS r
    CROSS JOIN bounds AS b
   WHERE r.job_name = 'pipeline'
     AND r.started_at >= b.window_start
     AND r.started_at < b.window_end
)
SELECT to_char(b.observed_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"') AS observed_at,
       to_char(b.window_start AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"') AS window_start,
       to_char(b.window_end AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"') AS window_end,
       count(r.started_at)::bigint AS runs_total,
       count(r.started_at) FILTER (WHERE r.status = 'running' AND r.finished_at IS NULL)::bigint AS running_without_finish,
       count(r.started_at) FILTER (WHERE r.status = 'partial')::bigint AS partial_runs,
       count(r.started_at) FILTER (WHERE r.article_matches > 0)::bigint AS windows_with_articles,
       coalesce(sum(r.article_matches),0)::bigint AS temporal_article_matches
  FROM bounds AS b
  LEFT JOIN run_windows AS r ON true
 GROUP BY b.observed_at,b.window_start,b.window_end;
