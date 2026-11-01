-- PHASE 12: reviewable, additive migration. Not applied to production by this phase.
-- checked_at verifies SIX-BOAT CONTENT, never live sale or collection permission.
create table public.bsc_gamagori_observations (
 id uuid primary key,
 race_date date not null,
 race_no smallint not null check (race_no between 1 and 12),
 stadium_number smallint not null default 7 check (stadium_number=7),
 source text not null check (source='gamagori_official_crosscheck_v1'),
 source_url text not null,
 html_sha256 text check (html_sha256 ~ '^[0-9a-f]{64}$'),
 fetched_at timestamptz not null,
 recorded_at timestamptz not null default clock_timestamp(),
 checked_at timestamptz,
 sources jsonb not null check (jsonb_typeof(sources)='array' and jsonb_array_length(sources)<=4),
 boats jsonb not null check (jsonb_typeof(boats)='array' and jsonb_array_length(boats)<=6),
 validation_result text not null check (validation_result in ('verified_content','rejected','unavailable')),
 reason text not null check (reason ~ '^[a-z_]{1,100}$'),
 sale_state text not null check (sale_state in ('unknown','cancelled','postponed','withdrawn')),
 collection_permitted boolean generated always as (false) stored,
 input_digest text not null check (input_digest ~ '^[0-9a-f]{64}$')
);
create index bsc_gamagori_observations_race_time on public.bsc_gamagori_observations(race_date,race_no,recorded_at desc);
create index bsc_gamagori_observations_checked_time on public.bsc_gamagori_observations(race_date,race_no,recorded_at desc) where checked_at is not null;
alter table public.bsc_gamagori_observations enable row level security;
revoke all on public.bsc_gamagori_observations from public,anon,authenticated,service_role;
grant select,insert on public.bsc_gamagori_observations to service_role;

create function public.bsc_gamagori_guard_observation() returns trigger
language plpgsql security invoker set search_path='' as $$
declare b jsonb; s jsonb; n integer; prefix text; day text; rr text; kinds text[];
begin
 if TG_OP<>'INSERT' then raise exception 'observations_are_append_only'; end if;
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
create trigger bsc_gamagori_observation_insert before insert on public.bsc_gamagori_observations for each row execute function public.bsc_gamagori_guard_observation();
create trigger bsc_gamagori_observation_immutable before update or delete on public.bsc_gamagori_observations for each row execute function public.bsc_gamagori_guard_observation();
create trigger bsc_gamagori_observation_no_truncate before truncate on public.bsc_gamagori_observations for each statement execute function public.bsc_gamagori_guard_observation();
revoke all on function public.bsc_gamagori_guard_observation() from public,anon,authenticated;

create function public.bsc_gamagori_record_observation(p_observation jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare existing public.bsc_gamagori_observations; saved public.bsc_gamagori_observations; oid uuid; digest text; inserted boolean:=false;
begin
 oid:=(p_observation->>'id')::uuid;digest:=encode(sha256(convert_to(p_observation::text,'UTF8')),'hex');
 select * into existing from public.bsc_gamagori_observations where id=oid;
 if found then
  if existing.input_digest<>digest then raise exception 'observation_id_conflict';end if;
  return jsonb_build_object('id',oid,'inserted',false,'checked_at',existing.checked_at,'collection_permitted',false);
 end if;
 insert into public.bsc_gamagori_observations(id,race_date,race_no,source,source_url,html_sha256,fetched_at,sources,boats,validation_result,reason,sale_state,input_digest)
 values(oid,(p_observation->>'race_date')::date,(p_observation->>'race_no')::smallint,p_observation->>'source',p_observation->>'source_url',p_observation->>'html_sha256',
  (p_observation->>'fetched_at')::timestamptz,p_observation->'sources',p_observation->'boats',p_observation->>'validation_result',p_observation->>'reason',p_observation->>'sale_state',digest)
 on conflict(id) do nothing returning * into saved;
 inserted:=found;
 if not inserted then
  select * into saved from public.bsc_gamagori_observations where id=oid;
  if saved.input_digest<>digest then raise exception 'observation_id_conflict';end if;
 end if;
 return jsonb_build_object('id',oid,'inserted',inserted,'checked_at',saved.checked_at,'collection_permitted',false);
end $$;
revoke all on function public.bsc_gamagori_record_observation(jsonb) from public,anon,authenticated;
grant execute on function public.bsc_gamagori_record_observation(jsonb) to service_role;
