-- One-shot audited historical data restoration.
-- Restores only the fixed manifest of 384 audited Ichika published prediction freezes.
-- This migration does NOT discover candidates dynamically.
-- This migration does NOT settle results and does NOT modify bsc_official_results.
-- Production evidence boundaries:
--   100-yen behavior READY: 2026-08-23 08:14:53.358+00
--   freeze migration applied: 2026-09-12 22:46:38+00
-- Expected: 384 predictions (170 previous_day / 214 after_exhibition),
--           1,152 tickets, generated investment 115,200 JPY.
--
-- Concurrency: no table-level lock is used. The unique source constraint plus
-- ON CONFLICT DO NOTHING and INSERT ... RETURNING make the exact rows created
-- by this transaction authoritative. A concurrent conflicting source insert
-- makes the RETURNING count/set fail closed; unrelated inserts are ignored.

begin;

create temporary table _bsc_restore_manifest (
  id bigint primary key
) on commit drop;

-- Fixed, audited 384-ID manifest. Never replace with dynamic candidate discovery.
insert into _bsc_restore_manifest (id)
select unnest(array[
514582,514584,514586,514678,514680,514682,514724,514726,514728,514730,514748,514750,514752,514754,615367,615369,615371,615373,615375,615377,615379,615381,615383,615385,615387,615389,615391,615393,615395,615397,615399,615401,615403,615405,615407,615409,615411,615413,615415,615417,615419,615421,615423,615425,615427,615429,615431,615433,615435,615437,615439,615441,615443,615445,615447,615449,615451,615453,615455,615457,615459,615461,615463,615465,615467,615469,615471,615473,615475,615477,615479,615481,615483,615485,615487,615489,615491,615493,615495,615497,615499,615501,615503,615505,615507,615509,615511,615513,615515,615517,615519,615521,615523,615525,615527,615529,615531,615533,615535,615537,615539,615541,615543,615545,615547,615549,615551,615553,615555,615557,615559,615561,615563,615565,615567,615569,615571,615573,615575,615577,615579,615581,615583,615585,615587,615589,615591,615593,615595,615597,615599,615601,615603,615605,615607,615609,615611,615613,615615,615617,615619,615621,615623,615625,615627,615629,615631,615633,615635,615637,615639,615641,615643,615645,615647,615649,615651,615653,615655,615657,615659,615661,615663,615665,615667,615669,615671,615673,615675,615677,642684,642685,1304825,1331734,1772862,2453942,2455041,2455520,2456215,2456540,2457761,2457909,2457915,2457923,2457930,2457932,2457934,2457939,2457955,2457967,2457974,2457977,2458015,2458026,2458027,2458039,2458046,2458052,2458058,2458063,2458070,2458078,2458085,2458091,2458096,2458104,2458116,2458123,2458131,2458139,2458147,2458157,2458170,2458183,2458190,2458196,2458206,2458217,2458218,2458219,2458220,2458221,2458222,2458223,2458224,2458225,2458226,2458227,2458228,2458229,2458230,2458231,2458232,2458233,2458234,2458235,2458236,2458237,2458238,2458239,2458240,2458241,2458242,2458243,2458244,2458245,2458246,2458247,2458248,2458249,2458250,2458251,2458252,2458253,2458254,2458255,2458256,2458257,2458258,2458259,2458260,2458261,2458262,2458263,2458264,2458265,2458266,2458267,2458268,2458269,2458270,2458271,2458272,2458273,2458274,2458275,2458276,2458277,2458278,2458279,2458280,2458281,2458282,2458283,2458284,2458285,2458286,2458287,2458288,2458289,2458290,2458291,2458292,2458293,2458294,2458295,2458296,2458297,2458298,2458299,2458300,2458301,2458302,2458303,2458304,2458305,2458306,2458307,2458308,2458309,2458310,2458311,2458312,2458313,2458314,2458315,2458316,2458317,2458318,2458319,2458320,2458321,2458322,2458323,2458324,2458325,2458326,2458327,2458328,2458329,2458330,2458331,2458332,2458333,2458334,2458335,2458336,2458337,2458338,2458339,2458340,2458341,2458342,2458343,2458344,2458345,2458346,2458347,2458348,2458349,2458350,2458351,2458352,2458353,2458354,2458355,2458356,2458357,2458358,2458359,2458360,2458361,2458362,2458363,2458364,2458365,2458366,2458367,2458368,2458369,2458370,2458371,2458372,2458373,2458374,2458375,2458376,2458377,2458378,2458379,2458380,2458381,2458382,2458383
]::bigint[]);

create temporary table _bsc_restore_transformed on commit drop as
with raw as (
  select a.id, x.ord,
    case
      when jsonb_typeof(x.item)='string' then trim(both '"' from x.item::text)
      when jsonb_typeof(x.item)='object' then coalesce(x.item->>'bet',x.item->>'combination',x.item->>'ticket')
      else null
    end as ticket
  from _bsc_restore_manifest m
  join public.bs_ai_predictions a on a.id=m.id
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(a.bet_json)='array' then a.bet_json else '[]'::jsonb end
  ) with ordinality as x(item,ord)
),
valid as (
  select distinct on (id,ticket) id,ord,ticket
  from raw
  where ticket ~ '^[1-6]-[1-6]-[1-6]$'
    and split_part(ticket,'-',1)<>split_part(ticket,'-',2)
    and split_part(ticket,'-',1)<>split_part(ticket,'-',3)
    and split_part(ticket,'-',2)<>split_part(ticket,'-',3)
  order by id,ticket,ord
),
ordered as (
  select id,ord,ticket from valid order by id,ord
)
select id,
  coalesce(jsonb_agg(to_jsonb(ticket) order by ord),'[]'::jsonb) as frozen_tickets,
  coalesce(jsonb_agg(jsonb_build_object('ticket',ticket,'score',100000-ord) order by ord),'[]'::jsonb) as ticket_scores,
  count(*)::integer as ticket_count
from ordered
group by id;

do $$
declare
  v bigint;
  v_margin numeric;
  v_predicted timestamptz;
  v_deadline timestamptz;
  v_published boolean;
  v_timing text;
  v_bet_json jsonb;
begin
  select count(*) into v from _bsc_restore_manifest;
  if v<>384 then raise exception 'manifest count mismatch: expected 384, got %',v; end if;
  select count(distinct id) into v from _bsc_restore_manifest;
  if v<>384 then raise exception 'manifest distinct mismatch: expected 384, got %',v; end if;

  select count(*) into v from _bsc_restore_manifest m join public.bs_ai_predictions a on a.id=m.id;
  if v<>384 then raise exception 'prediction exists mismatch: expected 384, got %',v; end if;
  select count(*) into v from _bsc_restore_manifest m join public.bs_ai_predictions a on a.id=m.id where a.character_code='ichika';
  if v<>384 then raise exception 'ichika mismatch: expected 384, got %',v; end if;
  select count(*) into v from _bsc_restore_manifest m join public.bs_ai_predictions a on a.id=m.id where a.published is true;
  if v<>384 then raise exception 'published mismatch: expected 384, got %',v; end if;
  select count(*) into v from _bsc_restore_manifest m join public.bs_ai_predictions a on a.id=m.id where a.timing='previous_day';
  if v<>170 then raise exception 'previous_day mismatch: expected 170, got %',v; end if;
  select count(*) into v from _bsc_restore_manifest m join public.bs_ai_predictions a on a.id=m.id where a.timing='after_exhibition';
  if v<>214 then raise exception 'after_exhibition mismatch: expected 214, got %',v; end if;
  select count(*) into v from _bsc_restore_manifest m join public.bs_ai_predictions a on a.id=m.id where a.created_at>=timestamptz '2026-08-23 08:14:53.358+00';
  if v<>384 then raise exception 'Production READY lower-bound mismatch: expected 384, got %',v; end if;
  select count(*) into v from _bsc_restore_manifest m join public.bs_ai_predictions a on a.id=m.id where a.created_at<timestamptz '2026-09-12 22:46:38+00';
  if v<>384 then raise exception 'freeze migration upper-bound mismatch: expected 384, got %',v; end if;

  select count(*) into v
  from _bsc_restore_manifest m
  join public.bs_ai_predictions a on a.id=m.id
  join public.bs_race_events e on e.race_date=a.race_date and e.course_code=a.course_code and e.race_no=a.race_no
  where coalesce(e.closing_time,e.deadline_time) is not null
    and a.predicted_at<((a.race_date+coalesce(e.closing_time,e.deadline_time)) at time zone 'Asia/Tokyo');
  if v<>384 then raise exception 'deadline-before mismatch: expected 384, got %',v; end if;

  select count(*) into v from _bsc_restore_transformed where ticket_count>0;
  if v<>384 then raise exception 'freeze-able prediction mismatch: expected 384, got %',v; end if;
  select coalesce(sum(ticket_count),0) into v from _bsc_restore_transformed;
  if v<>1152 then raise exception 'valid unique ticket mismatch: expected 1152, got %',v; end if;

  with raw as (
    select a.id,
      case when jsonb_typeof(x.item)='string' then trim(both '"' from x.item::text)
           when jsonb_typeof(x.item)='object' then coalesce(x.item->>'bet',x.item->>'combination',x.item->>'ticket')
           else null end ticket
    from _bsc_restore_manifest m join public.bs_ai_predictions a on a.id=m.id
    cross join lateral jsonb_array_elements(case when jsonb_typeof(a.bet_json)='array' then a.bet_json else '[]'::jsonb end) x(item)
  )
  select count(*) into v from raw
  where not coalesce((ticket~'^[1-6]-[1-6]-[1-6]$'
    and split_part(ticket,'-',1)<>split_part(ticket,'-',2)
    and split_part(ticket,'-',1)<>split_part(ticket,'-',3)
    and split_part(ticket,'-',2)<>split_part(ticket,'-',3)),false);
  if v<>0 then raise exception 'invalid ticket mismatch: expected 0, got %',v; end if;

  with raw as (
    select a.id,
      case when jsonb_typeof(x.item)='string' then trim(both '"' from x.item::text)
           when jsonb_typeof(x.item)='object' then coalesce(x.item->>'bet',x.item->>'combination',x.item->>'ticket')
           else null end ticket
    from _bsc_restore_manifest m join public.bs_ai_predictions a on a.id=m.id
    cross join lateral jsonb_array_elements(case when jsonb_typeof(a.bet_json)='array' then a.bet_json else '[]'::jsonb end) x(item)
  ), duplicates as (
    select id,ticket from raw group by id,ticket having count(*)>1
  )
  select count(*) into v from duplicates;
  if v<>0 then raise exception 'duplicate ticket mismatch: expected 0, got %',v; end if;

  select count(*) into v
  from _bsc_restore_manifest m
  join public.bs_ai_predictions a on a.id=m.id
  join public.bsc_official_predictions p
    on p.character_code=a.character_code and p.timing=a.timing
   and p.source_table='bs_ai_predictions' and p.source_id=a.id::text;
  if v<>0 then raise exception 'existing official mismatch: expected 0, got %',v; end if;

  select a.predicted_at,
    ((a.race_date+coalesce(e.closing_time,e.deadline_time)) at time zone 'Asia/Tokyo'),
    extract(epoch from (((a.race_date+coalesce(e.closing_time,e.deadline_time)) at time zone 'Asia/Tokyo')-a.predicted_at)),
    a.published,a.timing,a.bet_json
  into v_predicted,v_deadline,v_margin,v_published,v_timing,v_bet_json
  from public.bs_ai_predictions a
  join public.bs_race_events e on e.race_date=a.race_date and e.course_code=a.course_code and e.race_no=a.race_no
  where a.id=615639;

  if v_predicted is distinct from timestamptz '2026-08-25 01:16:57.080+00'
     or v_deadline is distinct from timestamptz '2026-08-25 01:17:00+00'
     or v_timing is distinct from 'after_exhibition'
     or v_published is distinct from true
     or jsonb_typeof(coalesce(v_bet_json,'[]'::jsonb))<>'array'
     or jsonb_array_length(coalesce(v_bet_json,'[]'::jsonb))=0
     or not (v_predicted<v_deadline)
     or abs(v_margin-2.920)>=0.001
  then
    raise exception 'ID 615639 audit guard failed: predicted=%, deadline=%, margin=%, timing=%, published=%',v_predicted,v_deadline,v_margin,v_timing,v_published;
  end if;
end $$;

create temporary table _bsc_restore_inserted (
  official_prediction_id bigint primary key,
  source_id text not null unique
) on commit drop;

with inserted as (
  insert into public.bsc_official_predictions (
    race_date,course_code,race_no,character_code,timing,ranking_type,rank_no,
    source_table,source_id,prediction_label,tickets,unit_stake,snapshot,published_at
  )
  select a.race_date,a.course_code,a.race_no,a.character_code,a.timing,null,null,
    'bs_ai_predictions',a.id::text,
    case a.character_code when 'ichika' then '一果 公開買い目' when 'hatsune' then '初音 公開買い目' when 'kiina' then 'キイナ 公開買い目' else '公開買い目' end,
    t.frozen_tickets,100,
    jsonb_build_object(
      'source','published_page_prediction','ai_prediction_id',a.id,
      'displayed_bet_json',a.bet_json,'ticket_scores',t.ticket_scores,
      'bet_count',t.ticket_count,'bet_count_rule',a.detail_json->>'bet_count_rule',
      'frozen_model_version',a.model_version
    ),
    clock_timestamp()
  from _bsc_restore_manifest m
  join public.bs_ai_predictions a on a.id=m.id
  join _bsc_restore_transformed t on t.id=a.id
  on conflict (character_code,timing,source_table,source_id) do nothing
  returning id,source_id
)
insert into _bsc_restore_inserted (official_prediction_id,source_id)
select id,source_id from inserted;

do $$
declare v bigint;
begin
  select count(*) into v from _bsc_restore_inserted;
  if v<>384 then raise exception 'INSERT RETURNING count mismatch: expected 384, got %',v; end if;

  select count(*) into v from (
    select id::text source_id from _bsc_restore_manifest
    except
    select source_id from _bsc_restore_inserted
  ) q;
  if v<>0 then raise exception 'manifest minus INSERT RETURNING mismatch: expected 0, got %',v; end if;

  select count(*) into v from (
    select source_id from _bsc_restore_inserted
    except
    select id::text from _bsc_restore_manifest
  ) q;
  if v<>0 then raise exception 'INSERT RETURNING minus manifest mismatch: expected 0, got %',v; end if;
end $$;

do $$
declare v bigint;
begin
  select count(*) into v
  from _bsc_restore_inserted i join public.bsc_official_predictions p on p.id=i.official_prediction_id;
  if v<>384 then raise exception 'post official mismatch: expected 384, got %',v; end if;

  select count(*) into v from _bsc_restore_inserted i join public.bsc_official_predictions p on p.id=i.official_prediction_id where p.timing='previous_day';
  if v<>170 then raise exception 'post previous_day mismatch: expected 170, got %',v; end if;
  select count(*) into v from _bsc_restore_inserted i join public.bsc_official_predictions p on p.id=i.official_prediction_id where p.timing='after_exhibition';
  if v<>214 then raise exception 'post after_exhibition mismatch: expected 214, got %',v; end if;

  select coalesce(sum(jsonb_array_length(p.tickets)),0) into v
  from _bsc_restore_inserted i join public.bsc_official_predictions p on p.id=i.official_prediction_id;
  if v<>1152 then raise exception 'post ticket mismatch: expected 1152, got %',v; end if;
  select count(*) into v from _bsc_restore_inserted i join public.bsc_official_predictions p on p.id=i.official_prediction_id where p.unit_stake=100;
  if v<>384 then raise exception 'unit stake mismatch: expected 384 rows at 100, got %',v; end if;

  select coalesce(sum(p.investment),0) into v from _bsc_restore_inserted i join public.bsc_official_predictions p on p.id=i.official_prediction_id;
  if v<>115200 then raise exception 'generated investment mismatch: expected 115200, got %',v; end if;
  select count(*) into v from _bsc_restore_inserted i join public.bsc_official_predictions p on p.id=i.official_prediction_id
  where p.investment<>jsonb_array_length(p.tickets)*p.unit_stake;
  if v<>0 then raise exception 'investment formula mismatch rows: expected 0, got %',v; end if;

  select count(*) into v from (
    select id::text source_id from _bsc_restore_manifest except select source_id from _bsc_restore_inserted
  ) q;
  if v<>0 then raise exception 'post manifest minus inserted source mismatch: expected 0, got %',v; end if;
  select count(*) into v from (
    select source_id from _bsc_restore_inserted except select id::text from _bsc_restore_manifest
  ) q;
  if v<>0 then raise exception 'post inserted source minus manifest mismatch: expected 0, got %',v; end if;

  select count(*) into v
  from _bsc_restore_inserted i
  join public.bsc_official_predictions p on p.id=i.official_prediction_id
  join public.bs_ai_predictions a on a.id=i.source_id::bigint
  where p.snapshot->'displayed_bet_json' is distinct from a.bet_json;
  if v<>0 then raise exception 'snapshot displayed_bet_json mismatch: expected 0, got %',v; end if;

  select count(*) into v
  from _bsc_restore_inserted i
  join public.bsc_official_predictions p on p.id=i.official_prediction_id
  join _bsc_restore_transformed t on t.id=i.source_id::bigint
  where p.snapshot->'ticket_scores' is distinct from t.ticket_scores;
  if v<>0 then raise exception 'ticket_scores mismatch: expected 0, got %',v; end if;

  select count(*) into v
  from _bsc_restore_inserted i
  join public.bsc_official_predictions p on p.id=i.official_prediction_id
  join _bsc_restore_transformed t on t.id=i.source_id::bigint
  where (p.snapshot->>'bet_count')::integer is distinct from t.ticket_count;
  if v<>0 then raise exception 'bet_count mismatch: expected 0, got %',v; end if;

  select count(*) into v from (
    select p.character_code,p.timing,p.source_table,p.source_id,count(*) n
    from _bsc_restore_inserted i join public.bsc_official_predictions p on p.id=i.official_prediction_id
    group by p.character_code,p.timing,p.source_table,p.source_id having count(*)>1
  ) q;
  if v<>0 then raise exception 'duplicate source mismatch: expected 0, got %',v; end if;

  select count(*) into v
  from public.bsc_official_results r
  join _bsc_restore_inserted i on i.official_prediction_id=r.prediction_id;
  if v<>0 then raise exception 'manifest official results created: expected 0, got %',v; end if;
end $$;

commit;
