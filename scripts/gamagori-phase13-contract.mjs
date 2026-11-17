import {observedSqlFixture} from '../tests/helpers/gamagori-phase13-fixtures.mjs';
// Synthetic SQL-contract matrix, for a dedicated isolation DB ONLY. Never run on production.
export function phase13ContractSql(){
 const a=observedSqlFixture(Date.now(),12),b=observedSqlFixture(Date.now(),11);
 const cases=[
 {name:'latest_failure_supersedes_success',mode:'latest',expected:'observed_latest_not_verified'},
 {name:'late_old_success_does_not_revive_failure',mode:'old_delivery',expected:'observed_latest_not_verified'},
 {name:'same_capture_failure_wins_tie',mode:'tie',expected:'observed_latest_not_verified'},
 ...[['state','unknown'],['current_race',11],['checked_race',11],['deadline','00:00'],['source_url','https://example.test'],['age',61],['race_from',13]].map(([path,value])=>({name:'sale_'+path,mode:'sale',path,value,expected:'observed_sale_unverified'})),
 {name:'sale_update_stale',mode:'stale_sale',expected:'observed_sale_unverified'},
 ...[['date','2000-01-01','observed_chart_unverified'],['source_url','https://example.test','observed_chart_unverified'],['boats,0,registration',9999,'observed_chart_conflict'],['boats,0,course',6,'observed_chart_conflict'],['boats,0,exhibition_time',9.99,'observed_chart_conflict'],['boats,0,slit_rating',6,'observed_chart_conflict'],['boats,0,turn_rating',4.5,'observed_chart_conflict'],['boats,0,arrow_direction','wrong','observed_chart_conflict'],['boats,5,boat_no',1,'observed_chart_unverified']].map(([path,value,expected])=>({name:'chart_'+path,mode:'chart',path,value,expected})),
 {name:'chart_receipt_stale',mode:'stale_chart',expected:'observed_chart_unverified'},
 {name:'chart_missing_boat',mode:'missing_boat',expected:'observed_chart_unverified'},
 ...[['cancel','1','observed_event_unverified'],['status','unknown','observed_event_unverified'],['deadline','00:00:00','observed_deadline_closed'],['entries,3,result_code','K0','observed_roster_or_absence'],['entries,3,registration','9999','observed_roster_or_absence']].map(([path,value,expected])=>({name:'event_'+path,mode:'event',path,value,expected})),
 {name:'missing_checked_at',mode:'negative_observation',expected:'observed_latest_not_verified'}
 ];
 const q=v=>"'"+JSON.stringify(v).replaceAll("'","''")+"'::jsonb";
 return `create temporary table phase13_contract_results(name text,passed boolean,detail text);
do $contract$
declare base jsonb:=${q(a)};positive jsonb:=${q(b)};cases jsonb:=${q(cases)};
 o jsonb;s jsonb;c jsonb;bad jsonb;late jsonb;k jsonb;recorded jsonb;retry jsonb;saved jsonb;evidence jsonb;stamp timestamptz;err text;role_name text;n integer;old_checked text;
begin
 if base#>>'{observation,race_date}'<>(clock_timestamp() at time zone 'Asia/Tokyo')::date::text then raise exception 'test_date_mismatch';end if;
 evidence:=jsonb_build_object('date',base#>>'{observation,race_date}','races',jsonb_build_array(positive->'row',base->'row'));
 insert into public.bsc_gamagori_phase13_fixture_events(race_date,payload) values((base#>>'{observation,race_date}')::date,evidence);
 foreach role_name in array array['anon','authenticated'] loop
  execute 'set local role '||quote_ident(role_name);
  begin perform public.bsc_gamagori_record_observation('{}'::jsonb);raise exception 'public_rpc_should_be_denied';exception when insufficient_privilege then null;end;
  begin perform id from public.bsc_gamagori_observations;raise exception 'public_select_should_be_denied';exception when insufficient_privilege then null;end;
  execute 'reset role';insert into phase13_contract_results values(role_name||'_actual_denial',true,'permission_denied');
 end loop;
 for k in select value from jsonb_array_elements(cases) loop
  stamp:=clock_timestamp();o:=(base->'observation')||jsonb_build_object('id',gen_random_uuid(),'fetched_at',stamp);
  o:=jsonb_set(o,'{sources}',(select jsonb_agg(v||jsonb_build_object('received_at',stamp,'http_date',stamp)) from jsonb_array_elements(o->'sources') v));
  s:=(base->'sale')||jsonb_build_object('received_at',stamp,'http_date',stamp,'page_updated_at',date_trunc('minute',stamp));
  c:=(base->'chart')||jsonb_build_object('received_at',stamp,'http_date',stamp);
  execute 'set local role service_role';recorded:=public.bsc_gamagori_record_observation(o);retry:=public.bsc_gamagori_record_observation(o);
  if recorded->>'inserted'<>'true' or retry->>'inserted'<>'false' or recorded->>'checked_at' is null or retry->>'checked_at'<>recorded->>'checked_at' then raise exception 'observation_idempotency_failed';end if;
  execute 'reset role';
  if k->>'mode' in ('latest','old_delivery','tie','negative_observation') then
   bad:=o||jsonb_build_object('id',gen_random_uuid(),'fetched_at',case when k->>'mode'='tie' then stamp else clock_timestamp() end,'validation_result','rejected','reason','sale_unverified');
   execute 'set local role service_role';perform public.bsc_gamagori_record_observation(bad);
   if k->>'mode' in ('old_delivery','tie') then
    late:=o||jsonb_build_object('id',gen_random_uuid(),'fetched_at',case when k->>'mode'='tie' then stamp else stamp-interval '10 seconds' end);
    late:=jsonb_set(late,'{sources}',(select jsonb_agg(v||jsonb_build_object('received_at',late->'fetched_at','http_date',late->'fetched_at')) from jsonb_array_elements(late->'sources') v));perform public.bsc_gamagori_record_observation(late);
   end if;execute 'reset role';
  elsif k->>'mode'='sale' then s:=jsonb_set(s,string_to_array(k->>'path',','),k->'value');
  elsif k->>'mode'='chart' then c:=jsonb_set(c,string_to_array(k->>'path',','),k->'value');
  elsif k->>'mode'='stale_sale' then s:=jsonb_set(s,'{page_updated_at}',to_jsonb(stamp-interval '3 minutes'));
  elsif k->>'mode'='stale_chart' then c:=jsonb_set(c,'{received_at}',to_jsonb(stamp-interval '3 minutes'));
  elsif k->>'mode'='missing_boat' then c:=jsonb_set(c,'{boats}',(c->'boats')-5);
  elsif k->>'mode'='event' then update public.bsc_gamagori_phase13_fixture_events set payload=jsonb_set(evidence,array['races','1']||string_to_array(k->>'path',','),k->'value') where race_date=(o->>'race_date')::date;
  end if;
  execute 'set local role service_role';
  begin
   perform public.bsc_gamagori_save_observed_chart((o->>'id')::uuid,s,c);raise exception 'test_should_have_rejected';
  exception when others then
   get stacked diagnostics err=message_text;if err<>k->>'expected' then raise exception 'contract_case_%: expected %, got %',k->>'name',k->>'expected',err;end if;
  end;
  execute 'reset role';
  select count(*) into n from public.bsc_gamagori_chart_ratings where race_date=(o->>'race_date')::date and race_no=12;if n<>0 then raise exception 'failed_case_saved_rows';end if;
  update public.bsc_gamagori_phase13_fixture_events set payload=evidence where race_date=(o->>'race_date')::date;
  insert into phase13_contract_results values(k->>'name',true,err);
 end loop;
 stamp:=clock_timestamp();o:=(positive->'observation')||jsonb_build_object('id',gen_random_uuid(),'fetched_at',stamp);
 o:=jsonb_set(o,'{sources}',(select jsonb_agg(v||jsonb_build_object('received_at',stamp,'http_date',stamp)) from jsonb_array_elements(o->'sources') v));
 s:=(positive->'sale')||jsonb_build_object('received_at',stamp,'http_date',stamp,'page_updated_at',date_trunc('minute',stamp));c:=(positive->'chart')||jsonb_build_object('received_at',stamp,'http_date',stamp);
 execute 'set local role service_role';recorded:=public.bsc_gamagori_record_observation(o);saved:=public.bsc_gamagori_save_observed_chart((o->>'id')::uuid,s,c);retry:=public.bsc_gamagori_save_observed_chart((o->>'id')::uuid,s,c);execute 'reset role';
 if saved->>'status'<>'saved' or saved->>'inserted'<>'6' or retry->>'status'<>'skipped_existing' then raise exception 'normal_and_repeat_failed';end if;
 select count(*) into n from public.bsc_gamagori_chart_ratings where race_date=(o->>'race_date')::date and race_no=11;if n<>6 then raise exception 'not_six_rows';end if;
 insert into phase13_contract_results values('synthetic_normal_atomic_six',true,saved::text),('repeat_no_additional_rows',true,retry::text),('stable_value_change_clock_ignored',true,'entry timestamps 2000; verified observation current');
 begin update public.bsc_gamagori_collection_receipts set chart_sha256=repeat('d',64);raise exception 'receipt_update_should_fail';exception when others then if sqlerrm<>'receipt_is_append_only' then raise;end if;end;
 begin update public.bsc_gamagori_observations set reason='tampered' where id=(o->>'id')::uuid;raise exception 'observation_update_should_fail';exception when others then if sqlerrm<>'observations_are_append_only' then raise;end if;end;
 insert into phase13_contract_results values('owner_immutable_receipt',true,'update_denied'),('owner_immutable_observation',true,'update_denied');
 if has_table_privilege('service_role','public.bsc_gamagori_observations','UPDATE') or has_table_privilege('service_role','public.bsc_gamagori_collection_receipts','DELETE') or has_function_privilege('anon','public.bsc_gamagori_save_observed_chart(uuid,jsonb,jsonb)','EXECUTE') then raise exception 'unsafe_grant';end if;
 insert into phase13_contract_results values('minimal_role_privileges',true,'service append only; anon execute denied');
end $contract$;
select jsonb_build_object('mode','SYNTHETIC_ISOLATION_CONTRACT_ONLY','checks',(select jsonb_agg(to_jsonb(t)) from phase13_contract_results t),'charts',(select count(*) from public.bsc_gamagori_chart_ratings),'receipts',(select count(*) from public.bsc_gamagori_collection_receipts)) as evidence;`;
}
