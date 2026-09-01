-- Run after the deployment SQL in a transaction, then ROLLBACK.
-- All test rows are temporary; no public race rows or alert endpoints are touched.
create temporary table exhibition_guard_test (like public.bs_race_entries including defaults) on commit drop;
create unique index on exhibition_guard_test(race_date,course_code,race_no,boat_no);
create trigger test_guard before insert or update on exhibition_guard_test for each row execute function public.bs_guard_exhibition_write();
do $test$
declare r record; before_meta jsonb; t timestamptz;
begin
  insert into exhibition_guard_test(id,race_date,course_code,race_no,boat_no,racer_registration_no,official_lap,official_straight,official_exhibition_st,official_exhibition_symbol,official_exhibition_source,official_exhibition_synced_at)
  values (1,'2026-08-28',1,1,1,'4000',37.1,7.2,0,'F','venue_official','2026-08-28T10:00:00Z');
  select * into r from exhibition_guard_test where id=1;
  assert r.official_lap=37.1 and r.official_exhibition_st=0, 'official first, zero ST accepted';
  before_meta:=r.exhibition_field_meta; t:=r.official_exhibition_synced_at;
  update exhibition_guard_test set official_lap=null,official_straight=0,official_exhibition_st=null,official_exhibition_symbol=null,official_exhibition_source='PC-KYOTEI',official_exhibition_synced_at='2026-08-28T11:00:00Z' where id=1;
  select * into r from exhibition_guard_test where id=1;
  assert r.official_lap=37.1 and r.official_straight=7.2 and r.official_exhibition_st=0 and r.official_exhibition_symbol='F', 'null writer must preserve measurements and ST symbol';
  assert r.exhibition_field_meta=before_meta and r.official_exhibition_synced_at=t and r.official_exhibition_source='venue_official', 'null writer must preserve provenance';
  update exhibition_guard_test set official_lap=38,official_exhibition_synced_at='2026-08-28T09:00:00Z' where id=1;
  select * into r from exhibition_guard_test where id=1;
  assert r.official_lap=37.1, 'stale correction rejected';
  update exhibition_guard_test set official_lap=37.2,official_turn=11.2,official_straight=null,official_exhibition_source='PC-KYOTEI',official_exhibition_synced_at='2026-08-28T12:00:00Z' where id=1;
  select * into r from exhibition_guard_test where id=1;
  assert r.official_lap=37.1 and r.official_turn=11.2 and r.official_straight=7.2, 'PC fills missing turn but cannot replace official lap or erase straight';
  assert r.exhibition_field_meta->'official_straight'->>'source'='venue_official' and r.exhibition_field_meta->'official_lap'->>'source'='venue_official' and r.exhibition_field_meta->'official_turn'->>'source'='PC-KYOTEI', 'per-field sources retained';
  update exhibition_guard_test set official_lap=37.9,official_exhibition_source='venue_official',official_exhibition_synced_at='2026-08-28T12:01:00Z' where id=1;
  update exhibition_guard_test set official_lap=36.8,official_exhibition_source='PC-KYOTEI',official_exhibition_synced_at='2026-08-28T12:02:00Z' where id=1;
  select * into r from exhibition_guard_test where id=1;
  assert r.official_lap=37.9 and r.exhibition_field_meta->'official_lap'->>'source'='venue_official', 'newer PC payload cannot replace official value';
  update exhibition_guard_test set official_turn=null,official_exhibition_source='venue_official',official_exhibition_synced_at='2026-08-28T12:03:00Z' where id=1;
  update exhibition_guard_test set official_turn=11.3,official_exhibition_source='PC-KYOTEI',official_exhibition_synced_at='2026-08-28T12:04:00Z' where id=1;
  select * into r from exhibition_guard_test where id=1;
  assert r.official_turn=11.3 and r.exhibition_field_meta->'official_turn'->>'source'='PC-KYOTEI', 'retained PC field accepts a newer PC correction';
  before_meta:=r.exhibition_field_meta;
  update exhibition_guard_test set official_exhibition_synced_at='2026-08-28T13:00:00Z' where id=1;
  select * into r from exhibition_guard_test where id=1;
  assert r.exhibition_field_meta=before_meta and r.official_exhibition_synced_at='2026-08-28T12:04:00Z', 'no-op poll not a measurement change';
  update exhibition_guard_test set official_half_lap=18,lap_time=36,exhibition_time=6.8,exhibition_source='PC-KYOTEI',exhibition_synced_at='2026-08-28T14:00:00Z' where id=1;
  update exhibition_guard_test set half_lap_time=0,lap_time=0,exhibition_time=null where id=1;
  select * into r from exhibition_guard_test where id=1;
  assert r.official_half_lap=18 and r.lap_time=36 and r.exhibition_time=6.8 and r.half_lap_time is null, 'general metrics protected and half lap separate';
  update exhibition_guard_test set racer_registration_no='4001' where id=1;
  select * into r from exhibition_guard_test where id=1;
  assert r.official_lap is null and r.lap_time is null and r.official_exhibition_st is null and r.exhibition_field_meta='{}'::jsonb, 'different racer resets exhibition';
  insert into exhibition_guard_test(id,race_date,course_code,race_no,boat_no,lap_time,exhibition_source,exhibition_synced_at)
  values (2,'2026-08-28',1,1,2,37,'PC-KYOTEI','2026-08-28T10:00:00Z');
  update exhibition_guard_test set official_lap=36.9,official_exhibition_source='venue_official',official_exhibition_synced_at='2026-08-28T11:00:00Z' where id=2;
  update exhibition_guard_test set official_lap='NaN',lap_time=-1 where id=2;
  select * into r from exhibition_guard_test where id=2;
  assert r.official_lap=36.9 and r.lap_time=37, 'PC first then official, invalid numeric ignored';
  insert into exhibition_guard_test(id,race_date,course_code,race_no,boat_no,official_lap,official_exhibition_source)
  values (2,'2026-08-28',1,1,2,null,'PC-KYOTEI')
  on conflict(race_date,course_code,race_no,boat_no) do update set official_lap=excluded.official_lap,official_exhibition_source=excluded.official_exhibition_source;
  select * into r from exhibition_guard_test where id=2;
  assert r.official_lap=36.9, 'upsert conflict path cannot erase a value';
  update exhibition_guard_test set race_date='2026-08-29' where id=2;
  select * into r from exhibition_guard_test where id=2;
  assert r.official_lap is null and r.lap_time is null, 'next day cannot inherit yesterday';
end;
$test$;
