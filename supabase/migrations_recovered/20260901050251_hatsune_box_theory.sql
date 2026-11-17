alter table public.bs_hatsune_womens_inner_break_alerts
  add column if not exists box_234_rating text,
  add column if not exists box_235_rating text,
  add column if not exists box_345_rating text,
  add column if not exists boat1_win_rate numeric,
  add column if not exists boat2_win_rate numeric,
  add column if not exists boat3_win_rate numeric,
  add column if not exists boat4_win_rate numeric,
  add column if not exists boat5_win_rate numeric,
  add column if not exists boat6_win_rate numeric,
  add column if not exists boat1_exhibition_rank smallint,
  add column if not exists boat2_exhibition_rank smallint,
  add column if not exists boat3_exhibition_rank smallint,
  add column if not exists boat4_exhibition_rank smallint,
  add column if not exists boat5_exhibition_rank smallint,
  add column if not exists boat6_exhibition_rank smallint;

create or replace function public.evaluate_hatsune_womens_inner_break_alerts()
returns integer
language plpgsql
security definer
set search_path='public'
as $function$
declare inserted_count integer := 0;
begin
  with women_races as (
    select race_date,course_code,race_no
    from public.bs_race_entries
    where race_date=(now() at time zone 'Asia/Tokyo')::date
    group by race_date,course_code,race_no
    having count(*)=6 and count(*) filter(where gender_code='2')=6
  ), ranked as (
    select e.*,
      rank() over(partition by e.race_date,e.course_code,e.race_no order by coalesce(e.official_exhibition_time,e.exhibition_time) asc nulls last)::smallint as ex_rank
    from public.bs_race_entries e
    join women_races w using(race_date,course_code,race_no)
  ), p as (
    select w.race_date,w.course_code,ev.course_name,w.race_no,ev.closing_time,
      max(r.national_win_rate) filter(where r.boat_no=1) b1,
      max(r.national_win_rate) filter(where r.boat_no=2) b2,
      max(r.national_win_rate) filter(where r.boat_no=3) b3,
      max(r.national_win_rate) filter(where r.boat_no=4) b4,
      max(r.national_win_rate) filter(where r.boat_no=5) b5,
      max(r.national_win_rate) filter(where r.boat_no=6) b6,
      max(r.ex_rank) filter(where r.boat_no=1) x1,
      max(r.ex_rank) filter(where r.boat_no=2) x2,
      max(r.ex_rank) filter(where r.boat_no=3) x3,
      max(r.ex_rank) filter(where r.boat_no=4) x4,
      max(r.ex_rank) filter(where r.boat_no=5) x5,
      max(r.ex_rank) filter(where r.boat_no=6) x6,
      max(coalesce(r.official_exhibition_time,r.exhibition_time)) filter(where r.boat_no=1) e1,
      max(coalesce(r.official_exhibition_time,r.exhibition_time)) filter(where r.boat_no=2) e2
    from women_races w
    join ranked r using(race_date,course_code,race_no)
    join public.bs_race_events ev using(race_date,course_code,race_no)
    group by w.race_date,w.course_code,ev.course_name,w.race_no,ev.closing_time
  ), scored as (
    select p.*,
      case when ((b2>=5.5)::int+(b3>=5.5)::int+(b4>=5.5)::int)>=2 then '◎'
           when ((b2>=5.0)::int+(b3>=5.0)::int+(b4>=5.0)::int)>=2 then '○' else '△' end r234,
      case when ((b2>=5.5)::int+(b3>=5.5)::int+(b5>=5.5)::int)>=2 and coalesce(b5,0)>=coalesce(b4,0) then '◎'
           when ((b2>=5.0)::int+(b3>=5.0)::int+(b5>=5.0)::int)>=2 then '○' else '△' end r235,
      case when b2<5.0 and x3<=4 and x4<=4 and x5<=4 then '◎'
           when b2<5.0 and ((b3>=5.5)::int+(b4>=5.5)::int+(b5>=5.5)::int)>=2 then '○' else '△' end r345
    from p
    where b1<4.5 and x1>=4 and greatest(coalesce(b2,0),coalesce(b3,0),coalesce(b4,0),coalesce(b5,0),coalesce(b6,0))>=6.0
      and (race_date+closing_time) at time zone 'Asia/Tokyo'>now()
      and (race_date+closing_time) at time zone 'Asia/Tokyo'<=now()+interval '30 minutes'
  )
  insert into public.bs_hatsune_womens_inner_break_alerts(
    race_date,course_code,course_name,race_no,closing_time,
    boat1_exhibition,boat2_exhibition,box_234_rating,box_235_rating,box_345_rating,
    boat1_win_rate,boat2_win_rate,boat3_win_rate,boat4_win_rate,boat5_win_rate,boat6_win_rate,
    boat1_exhibition_rank,boat2_exhibition_rank,boat3_exhibition_rank,boat4_exhibition_rank,boat5_exhibition_rank,boat6_exhibition_rank,danger_level
  )
  select race_date,course_code,course_name,race_no,closing_time,e1,e2,r234,r235,r345,
    b1,b2,b3,b4,b5,b6,x1,x2,x3,x4,x5,x6,
    case when r234='◎' or r235='◎' or r345='◎' then 'super_danger' else 'danger' end
  from scored
  on conflict(race_date,course_code,race_no) do update set
    course_name=excluded.course_name,closing_time=excluded.closing_time,
    boat1_exhibition=excluded.boat1_exhibition,boat2_exhibition=excluded.boat2_exhibition,
    box_234_rating=excluded.box_234_rating,box_235_rating=excluded.box_235_rating,box_345_rating=excluded.box_345_rating,
    boat1_win_rate=excluded.boat1_win_rate,boat2_win_rate=excluded.boat2_win_rate,boat3_win_rate=excluded.boat3_win_rate,
    boat4_win_rate=excluded.boat4_win_rate,boat5_win_rate=excluded.boat5_win_rate,boat6_win_rate=excluded.boat6_win_rate,
    boat1_exhibition_rank=excluded.boat1_exhibition_rank,boat2_exhibition_rank=excluded.boat2_exhibition_rank,
    boat3_exhibition_rank=excluded.boat3_exhibition_rank,boat4_exhibition_rank=excluded.boat4_exhibition_rank,
    boat5_exhibition_rank=excluded.boat5_exhibition_rank,boat6_exhibition_rank=excluded.boat6_exhibition_rank,
    danger_level=excluded.danger_level,updated_at=now();
  get diagnostics inserted_count=row_count;
  return inserted_count;
end;
$function$;