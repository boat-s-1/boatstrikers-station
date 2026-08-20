alter table public.ai_v2_daily_rankings
  drop constraint if exists ai_v2_daily_rankings_ranking_type_check;

alter table public.ai_v2_daily_rankings
  add constraint ai_v2_daily_rankings_ranking_type_check
  check (ranking_type = any (array[
    'ichika_inside_best'::text,
    'hatsune_inside_best'::text,
    'hatsune_inside_danger'::text,
    'kiina_boat5_best'::text,
    'ichika_escape_best10'::text,
    'hatsune_dominant_best3'::text,
    'hatsune_risky_best3'::text,
    'kiina_boat5_best5'::text
  ]));
