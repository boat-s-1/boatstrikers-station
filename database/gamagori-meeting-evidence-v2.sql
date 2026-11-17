-- Read-only additive evidence. No existing race writer changes.
create or replace function public.bsc_gamagori_meeting_evidence(p_date date)
returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('date',p_date,'live_sync',(select max(finished_at) from public.bs_live_source_sync_logs where race_date=p_date and source='boatraceopenapi/v1' and sync_kind='live_all' and status='success'),
 'races',coalesce((select jsonb_agg(jsonb_build_object('race_no',e.race_no,'program',e.program_available,'cancel',e.race_cancel_code,'status',e.race_status,
 'entries',(select jsonb_agg(jsonb_build_object('boat_no',n.boat_no,'registration',n.racer_registration_no,'preview_at',n.api_preview_synced_at,'preview_source',n.api_preview_source,'exhibition_time',n.api_exhibition_time,'course',n.api_exhibition_course,'result_code',n.result_code,'result_note',n.result_note) order by n.boat_no) from public.bs_race_entries n where n.race_date=p_date and n.course_code=7 and n.race_no=e.race_no),
 'preview_at',e.api_preview_synced_at,'deadline',coalesce(e.deadline_time,e.closing_time),
 'boats',(select count(distinct n.boat_no) from public.bs_race_entries n where n.race_date=p_date and n.course_code=7 and n.race_no=e.race_no and n.boat_no between 1 and 6),
 'preview_boats',(select count(distinct n.boat_no) from public.bs_race_entries n where n.race_date=p_date and n.course_code=7 and n.race_no=e.race_no and n.boat_no between 1 and 6 and n.api_preview_synced_at is not null),
 'entry_preview_at',(select min(n.api_preview_synced_at) from public.bs_race_entries n where n.race_date=p_date and n.course_code=7 and n.race_no=e.race_no),
 'finished',(select coalesce(r.first_boat between 1 and 6 and r.second_boat between 1 and 6 and r.third_boat between 1 and 6 and r.first_boat<>r.second_boat and r.first_boat<>r.third_boat and r.second_boat<>r.third_boat,false) from public.bs_race_results r where r.race_date=p_date and r.course_code=7 and r.race_no=e.race_no)) order by e.race_no) from public.bs_race_events e where e.race_date=p_date and e.course_code=7),'[]'::jsonb));
$$;
revoke all on function public.bsc_gamagori_meeting_evidence(date) from public,anon,authenticated;
grant execute on function public.bsc_gamagori_meeting_evidence(date) to service_role;

