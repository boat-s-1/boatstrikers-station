
drop policy if exists "public read active resort stores" on public.resort_stores;
create policy "public read active resort stores"
on public.resort_stores for select to anon using (is_active);

drop policy if exists "public read published resort therapists" on public.resort_therapists;
create policy "public read published resort therapists"
on public.resort_therapists for select to anon using (is_published);

drop policy if exists "public read resort therapist stores" on public.resort_therapist_stores;
create policy "public read resort therapist stores"
on public.resort_therapist_stores for select to anon
using (exists (
  select 1 from public.resort_therapists t
  where t.id = therapist_id and t.is_published
));

drop policy if exists "public read published resort schedules" on public.resort_schedules;
create policy "public read published resort schedules"
on public.resort_schedules for select to anon
using (
  is_published and exists (
    select 1 from public.resort_therapists t
    where t.id = therapist_id and t.is_published
  )
);
