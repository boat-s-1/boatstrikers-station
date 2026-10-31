-- PHASE13: additive collector-only guards. Apply only to isolated Preview during review.
create or replace function public.bsc_gamagori_guard_observation() returns trigger
language plpgsql security invoker set search_path='' as $$
declare b jsonb; s jsonb; n integer; prefix text; day text; rr text; kinds text[];
begin
 if TG_OP<>'INSERT' then raise exception 'observations_are_append_only'; end if;
 perform pg_advisory_xact_lock(32407,hashtext(new.race_date::text||':'||new.race_no::text));
 new.recorded_at:=clock_timestamp();new.checked_at:=null;
 prefix:='https://www.gamagori-kyotei.com/asp/gamagori/sp/kyogi/kyogihtml/';
 day:=to_char(new.race_date,'YYYYMMDD');rr:=lpad(new.race_no::text,2,'0');
 if new.source_url<>prefix||'choku/choku'||day||'07'||rr||'.htm' then raise exception 'observation_source_invalid';end if;
 if new.fetched_at>new.recorded_at+interval '1 second' then raise exception 'observation_future_time';end if;
 if new.validation_result='verified_content' then
  if new.sale_state<>'unknown' or new.reason<>'content_verified_sale_unknown' or new.html_sha256 is null
   or new.recorded_at-new.fetched_at>interval '120 seconds' or jsonb_array_length(new.boats)<>6 or jsonb_array_length(new.sources)<>4
   then raise exception 'observation_content_unverified';end if;
  select count(distinct (v->>'boat_no')::integer) into n from jsonb_array_elements(new.boats) v;
  if n<>6 then raise exception 'observation_boats_invalid';end if;
  select count(distinct (v->>'registration')::integer) into n from jsonb_array_elements(new.boats) v;
  if n<>6 then raise exception 'observation_registration_invalid';end if;
  select count(distinct (v->>'course')::integer) into n from jsonb_array_elements(new.boats) v;
  if n<>6 then raise exception 'observation_courses_invalid';end if;
  for b in select value from jsonb_array_elements(new.boats) loop
   if not coalesce(jsonb_typeof(b->'boat_no')='number' and jsonb_typeof(b->'registration')='number' and jsonb_typeof(b->'course')='number'
    and (b->>'boat_no')::numeric=trunc((b->>'boat_no')::numeric) and (b->>'boat_no')::numeric between 1 and 6
    and (b->>'registration')::numeric=trunc((b->>'registration')::numeric) and (b->>'registration')::numeric between 1000 and 9999
    and (b->>'course')::numeric=trunc((b->>'course')::numeric) and (b->>'course')::numeric between 1 and 6
    and jsonb_typeof(b->'exhibition_time')='number' and (b->>'exhibition_time')::numeric between 5 and 10,false)
    then raise exception 'observation_boat_values_invalid';end if;
  end loop;
  select array_agg(distinct v->>'kind') into kinds from jsonb_array_elements(new.sources) v;
  if not coalesce(kinds @> array['program','index','choku','openapi'] and array_length(kinds,1)=4,false) then raise exception 'observation_sources_invalid';end if;
  for s in select value from jsonb_array_elements(new.sources) loop
   if not coalesce((s->>'http_status')::integer=200 and (s->>'html_sha256') ~ '^[0-9a-f]{64}$' and (s->>'error') is null
    and (s->>'received_at')::timestamptz<=new.fetched_at and new.fetched_at-(s->>'received_at')::timestamptz<=interval '120 seconds'
    and abs(extract(epoch from ((s->>'http_date')::timestamptz-(s->>'received_at')::timestamptz)))<=120
    and (s->>'age')::numeric between 0 and 60
    and (s->>'url')=case s->>'kind'
      when 'program' then prefix||'syusso/syusso'||day||'07'||rr||'.htm'
      when 'index' then prefix||'index/index'||day||'07.htm'
      when 'choku' then prefix||'choku/choku'||day||'07'||rr||'.htm'
      when 'openapi' then 'https://boatraceopenapi.github.io/api/v1/today.json' end,false)
    then raise exception 'observation_source_unverified';end if;
   if s->>'kind'='choku' and s->>'html_sha256'<>new.html_sha256 then raise exception 'observation_hash_conflict';end if;
  end loop;
  new.checked_at:=new.recorded_at;
 end if;
 return new;
end $$;
create function public.bsc_gamagori_latest_observation(p_date date,p_race integer) returns jsonb
language sql stable security invoker set search_path='' as $$
 select to_jsonb(o) from public.bsc_gamagori_observations o where race_date=p_date and race_no=p_race
 order by fetched_at desc,(validation_result<>'verified_content') desc,recorded_at desc,id desc limit 1
$$;
revoke all on function public.bsc_gamagori_latest_observation(date,integer) from public,anon,authenticated;
grant execute on function public.bsc_gamagori_latest_observation(date,integer) to service_role;

create table public.bsc_gamagori_collection_receipts (
 race_date date not null,race_no smallint not null check(race_no between 1 and 12),
 observation_id uuid not null references public.bsc_gamagori_observations(id),
 sale_proof jsonb not null,chart_sha256 text not null check(chart_sha256 ~ '^[a-f0-9]{64}$'),
 saved_at timestamptz not null default clock_timestamp(),primary key(race_date,race_no)
);
alter table public.bsc_gamagori_collection_receipts enable row level security;
revoke all on public.bsc_gamagori_collection_receipts from public,anon,authenticated,service_role;
grant select,insert on public.bsc_gamagori_collection_receipts to service_role;
create function public.bsc_gamagori_receipt_immutable() returns trigger language plpgsql security invoker set search_path='' as $$begin raise exception 'receipt_is_append_only';end$$;
revoke all on function public.bsc_gamagori_receipt_immutable() from public,anon,authenticated;
create trigger bsc_gamagori_receipt_immutable before update or delete on public.bsc_gamagori_collection_receipts for each row execute function public.bsc_gamagori_receipt_immutable();
create trigger bsc_gamagori_receipt_no_truncate before truncate on public.bsc_gamagori_collection_receipts for each statement execute function public.bsc_gamagori_receipt_immutable();

create function public.bsc_gamagori_save_observed_chart(p_observation uuid,p_sale jsonb,p_chart jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare o public.bsc_gamagori_observations; latest jsonb; r jsonb; e jsonb; b jsonb; expected jsonb;
 n integer;stamp timestamptz;cutoff timestamptz;prefix text;day text;rr text;
begin
 select * into o from public.bsc_gamagori_observations where id=p_observation;
 if not found then raise exception 'observed_observation_missing';end if;
 perform pg_advisory_xact_lock(32407,hashtext(o.race_date::text||':'||o.race_no::text));
 select count(*) into n from public.bsc_gamagori_chart_ratings where race_date=o.race_date and race_no=o.race_no;
 if n>0 then
  if n=6 and (select count(distinct boat_no) from public.bsc_gamagori_chart_ratings where race_date=o.race_date and race_no=o.race_no)=6 then return jsonb_build_object('status','skipped_existing','inserted',0);end if;
  return jsonb_build_object('status','blocked_partial_existing','inserted',0);
 end if;
 stamp:=clock_timestamp();day:=to_char(o.race_date,'YYYYMMDD');rr:=lpad(o.race_no::text,2,'0');
 prefix:='https://www.gamagori-kyotei.com/asp/gamagori/sp/kyogi/kyogihtml/';
 latest:=public.bsc_gamagori_latest_observation(o.race_date,o.race_no);
 if latest->>'id'<>o.id::text or o.validation_result<>'verified_content' or o.sale_state<>'unknown' or o.checked_at is null
  or o.checked_at>stamp or o.fetched_at>stamp or stamp-o.checked_at>interval '120 seconds' or stamp-o.fetched_at>interval '120 seconds'
  or o.race_date<>(stamp at time zone 'Asia/Tokyo')::date then raise exception 'observed_latest_not_verified';end if;
 e:=public.bsc_gamagori_meeting_evidence(o.race_date);
 select value into r from jsonb_array_elements(e->'races') where (value->>'race_no')::integer=o.race_no;
 if not coalesce(e->>'date'=o.race_date::text and (r->>'program')::boolean and (r->>'boats')::integer=6
   and r->>'status' in ('scheduled','racing') and coalesce(r->>'cancel','0') in ('','0')
   and not coalesce((r->>'finished')::boolean,false) and jsonb_array_length(r->'entries')=6
   and (select count(distinct v->>'boat_no') from jsonb_array_elements(r->'entries') v)=6
   and (select count(distinct v->>'registration') from jsonb_array_elements(r->'entries') v)=6,false)
   then raise exception 'observed_event_unverified';end if;
 cutoff:=(o.race_date::text||' '||(r->>'deadline')||'+09:00')::timestamptz;
 if cutoff<=stamp then raise exception 'observed_deadline_closed';end if;
 for b in select value from jsonb_array_elements(r->'entries') loop
  if coalesce(b->>'result_code','') !~ '^(0?[1-6])?$' or coalesce(b->>'result_note','') ~ '(欠|中止|取消|順延|不成立|フライング|出遅れ|失格|返還)'
   or not exists(select 1 from jsonb_array_elements(o.boats) v where (v->>'boat_no')::integer=(b->>'boat_no')::integer and (v->>'registration')::integer=(b->>'registration')::integer)
   then raise exception 'observed_roster_or_absence';end if;
 end loop;
 if not coalesce(p_sale->>'state'='sale_open_observed' and (p_sale->>'current_race')::integer=o.race_no and (p_sale->>'checked_race')::integer=o.race_no
  and (p_sale->>'race_from')::integer between 1 and o.race_no and p_sale->>'deadline'=left(r->>'deadline',5)
  and p_sale->>'source_url'='https://www.boatrace.jp/owpc/pc/race/index?hd='||day and (p_sale->>'html_sha256') ~ '^[a-f0-9]{64}$'
  and (p_sale->>'page_updated_at')::timestamptz<=stamp and stamp-(p_sale->>'page_updated_at')::timestamptz<=interval '120 seconds'
  and ((p_sale->>'page_updated_at')::timestamptz at time zone 'Asia/Tokyo')::date=o.race_date
  and (p_sale->>'received_at')::timestamptz<=stamp and stamp-(p_sale->>'received_at')::timestamptz<=interval '120 seconds'
  and abs(extract(epoch from ((p_sale->>'http_date')::timestamptz-(p_sale->>'received_at')::timestamptz)))<=120
  and (p_sale->>'age')::numeric between 0 and 60,false) then raise exception 'observed_sale_unverified';end if;
 if not coalesce(p_chart->>'date'=o.race_date::text and (p_chart->>'race')::integer=o.race_no
  and p_chart->>'source_url'=prefix||'recomend/recomend'||day||'07'||rr||'.htm'
  and (p_chart->>'html_sha256') ~ '^[a-f0-9]{64}$' and jsonb_array_length(p_chart->'boats')=6
  and (p_chart->>'received_at')::timestamptz<=stamp and stamp-(p_chart->>'received_at')::timestamptz<=interval '120 seconds'
  and abs(extract(epoch from ((p_chart->>'http_date')::timestamptz-(p_chart->>'received_at')::timestamptz)))<=120
  and (p_chart->>'age')::numeric between 0 and 60,false) then raise exception 'observed_chart_unverified';end if;
 select count(distinct (v->>'boat_no')::integer) into n from jsonb_array_elements(p_chart->'boats') v;
 if n<>6 then raise exception 'observed_chart_unverified';end if;
 for b in select value from jsonb_array_elements(p_chart->'boats') loop
  select value into expected from jsonb_array_elements(o.boats) where (value->>'boat_no')::integer=(b->>'boat_no')::integer;
  if not coalesce((b->>'boat_no')::numeric between 1 and 6 and (b->>'boat_no')::numeric=trunc((b->>'boat_no')::numeric)
   and (b->>'registration')::numeric=(expected->>'registration')::numeric and (b->>'course')::numeric=(expected->>'course')::numeric
   and (b->>'exhibition_time')::numeric=(expected->>'exhibition_time')::numeric
   and (b->>'slit_rating')::numeric between 1 and 5 and (b->>'slit_rating')::numeric=trunc((b->>'slit_rating')::numeric)
   and (b->>'turn_rating')::numeric between 1 and 5 and (b->>'turn_rating')::numeric=trunc((b->>'turn_rating')::numeric)
   and b->>'arrow_direction' in ('none','up','down'),false) then raise exception 'observed_chart_conflict';end if;
 end loop;
 insert into public.bsc_gamagori_chart_ratings(race_date,race_no,boat_no,slit_rating,turn_rating,arrow_direction,source_url)
 select o.race_date,o.race_no,(v->>'boat_no')::smallint,(v->>'slit_rating')::smallint,(v->>'turn_rating')::smallint,v->>'arrow_direction',p_chart->>'source_url' from jsonb_array_elements(p_chart->'boats') v
 where clock_timestamp()<least(cutoff,o.checked_at+interval '120 seconds',o.fetched_at+interval '120 seconds',(p_sale->>'page_updated_at')::timestamptz+interval '120 seconds',(p_chart->>'received_at')::timestamptz+interval '120 seconds');
 get diagnostics n=row_count;
 if n<>6 then raise exception 'observed_evidence_expired';end if;
 insert into public.bsc_gamagori_collection_receipts(race_date,race_no,observation_id,sale_proof,chart_sha256)
 values(o.race_date,o.race_no,o.id,p_sale,p_chart->>'html_sha256');
 return jsonb_build_object('status','saved','inserted',6);
end $$;
revoke all on function public.bsc_gamagori_save_observed_chart(uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.bsc_gamagori_save_observed_chart(uuid,jsonb,jsonb) to service_role;
