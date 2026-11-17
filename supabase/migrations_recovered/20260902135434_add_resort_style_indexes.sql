
    create index if not exists resort_schedules_store_id_idx on public.resort_schedules(store_id);
    create index if not exists resort_schedules_work_date_idx on public.resort_schedules(work_date);
    create index if not exists resort_therapist_stores_store_id_idx on public.resort_therapist_stores(store_id);
  