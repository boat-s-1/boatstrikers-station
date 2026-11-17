create or replace function public.trigger_evaluate_ichika_escape_surge_alerts()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.race_date = (now() at time zone 'Asia/Tokyo')::date then
    perform public.evaluate_ichika_escape_surge_alerts();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_ichika_escape_surge_on_exhibition_update on public.bs_race_entries;
create trigger trg_ichika_escape_surge_on_exhibition_update
after insert or update of official_exhibition_time, exhibition_time, official_lap, lap_time
on public.bs_race_entries
for each row
execute function public.trigger_evaluate_ichika_escape_surge_alerts();