-- Dedicated isolated DB only. Synthetic negative observations are rolled back; no fixture RPC is installed.
begin;
do $contract$
declare state text; o jsonb; result jsonb; retry jsonb; oid uuid; day text:=to_char(clock_timestamp() at time zone 'Asia/Tokyo','YYYYMMDD');before_count bigint;
begin
 if public.bsc_gamagori_environment_attestation()->>'project_ref' is distinct from 'rdqnqvafsponsoetnezv' then raise exception 'wrong_isolated_project';end if;
 select count(*) into before_count from public.bsc_gamagori_chart_ratings;
 execute 'set local role service_role';
 foreach state in array array['unknown','cancelled','postponed','withdrawn'] loop
  oid:=gen_random_uuid();
  o:=jsonb_build_object('id',oid,'race_date',(clock_timestamp() at time zone 'Asia/Tokyo')::date,'race_no',12,'source','gamagori_official_crosscheck_v1','source_url','https://www.gamagori-kyotei.com/asp/gamagori/sp/kyogi/kyogihtml/choku/choku'||day||'0712.htm','fetched_at',clock_timestamp(),'sources','[]'::jsonb,'boats','[]'::jsonb,'validation_result','unavailable','reason','integration_test_unavailable','sale_state',state);
  result:=public.bsc_gamagori_record_observation(o);retry:=public.bsc_gamagori_record_observation(o);
  if result->>'inserted'<>'true' or retry->>'inserted'<>'false' or result->>'checked_at' is not null or result->>'collection_permitted'<>'false' then raise exception 'negative_observation_contract_failed';end if;
  begin perform public.bsc_gamagori_save_observed_chart(oid,'{}','{}');raise exception 'unsafe_save_accepted';exception when raise_exception then if SQLERRM<>'observed_latest_not_verified' then raise;end if;end;
 end loop;
 begin perform public.bsc_gamagori_save_observed_chart(gen_random_uuid(),'{}','{}');raise exception 'missing_evidence_accepted';exception when raise_exception then if SQLERRM<>'observed_observation_missing' then raise;end if;end;
 if (select count(*) from public.bsc_gamagori_chart_ratings)<>before_count then raise exception 'chart_count_changed';end if;
 execute 'reset role';
 execute 'set local role anon';
 begin perform public.bsc_gamagori_environment_attestation();raise exception 'anon_attestation_accepted';exception when insufficient_privilege then null;end;
 execute 'reset role';
end $contract$;
rollback;
select 'PASS: four negative states, null checked_at, record retry +0, chart-save rejection, missing-evidence rejection, anonymous denial; all synthetic observations rolled back' result,(select count(*) from public.bsc_gamagori_chart_ratings) charts,(select count(*) from public.bsc_gamagori_observations) observations;

