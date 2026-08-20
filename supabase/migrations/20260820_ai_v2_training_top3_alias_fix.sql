-- Fix alias collision with existing bs_race_results.first_boat/second_boat/third_boat columns.
do $$
declare
  v_def text;
begin
  select pg_get_functiondef('public.ai_v2_refresh_training_rows(date,date,text)'::regprocedure)
    into v_def;
  v_def := replace(v_def, 'first_boat', 'parsed_first_boat');
  v_def := replace(v_def, 'second_boat', 'parsed_second_boat');
  v_def := replace(v_def, 'third_boat', 'parsed_third_boat');
  execute v_def;
end;
$$;
