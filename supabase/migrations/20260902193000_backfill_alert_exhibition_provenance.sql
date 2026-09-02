-- Backfill recent alert history without changing detection or notification state.
-- Restrict update-trigger execution to the provenance column so LINE updates stay cheap.

do $$
declare
  target_table text;
  trigger_name text;
begin
  foreach target_table in array array[
    'bs_exhibition_alerts',
    'bs_ichika_hidden_escape_alerts',
    'bs_hatsune_womens_inner_break_alerts',
    'bs_hatsune_box_alerts'
  ] loop
    trigger_name := target_table || '_stamp_exhibition_provenance';
    execute format('drop trigger if exists %I on public.%I', trigger_name, target_table);
    execute format(
      'create trigger %I before insert or update of exhibition_source_kind on public.%I for each row execute function public.bs_stamp_alert_exhibition_provenance()',
      trigger_name,
      target_table
    );
    execute format(
      'update public.%I set exhibition_source_kind = ''unknown'' where race_date >= current_date - 30 and exhibition_source_kind is null',
      target_table
    );
  end loop;
end $$;
