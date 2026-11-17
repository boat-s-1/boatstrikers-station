create or replace view public.v_bs_race_results_confirmed as
select
  e.*,
  (
    coalesce(e.result_available, false)
    or (
      e.race_cancel_code is null
      and e.trifecta is not null
      and btrim(e.trifecta) <> ''
      and regexp_replace(e.trifecta, '[^0-9]', '', 'g') ~ '^[1-6]{3}$'
      and e.trifecta_payout is not null
      and e.trifecta_payout > 0
      and coalesce(e.closing_time, e.deadline_time) is not null
      and (e.race_date + coalesce(e.closing_time, e.deadline_time)) <= (timezone('Asia/Tokyo', now()) - interval '5 minutes')
    )
  ) as effective_result_available,
  case
    when coalesce(e.result_available, false) then 'source_result_available'
    when e.race_cancel_code is null
      and e.trifecta is not null
      and btrim(e.trifecta) <> ''
      and regexp_replace(e.trifecta, '[^0-9]', '', 'g') ~ '^[1-6]{3}$'
      and e.trifecta_payout is not null
      and e.trifecta_payout > 0
      and coalesce(e.closing_time, e.deadline_time) is not null
      and (e.race_date + coalesce(e.closing_time, e.deadline_time)) <= (timezone('Asia/Tokyo', now()) - interval '5 minutes')
      then 'complete_result_payload_after_close'
    else 'unconfirmed'
  end as result_confirmation_reason
from public.bs_race_events e;