-- Backfill only provenance that can be proven from existing API result records.
-- Unknown legacy sources remain NULL rather than being guessed.

update public.bs_race_events e
set result_source = r.api_result_source,
    result_synced_at = coalesce(r.api_result_synced_at, r.synced_at)
from public.bs_race_results r
where e.race_date = r.race_date
  and e.course_code = r.course_code
  and e.race_no = r.race_no
  and e.result_source is null
  and r.api_result_source is not null;

update public.bs_race_events e
set payout_source = r.api_result_source,
    payout_synced_at = coalesce(r.api_result_synced_at, r.synced_at)
from public.bs_race_results r
where e.race_date = r.race_date
  and e.course_code = r.course_code
  and e.race_no = r.race_no
  and e.payout_source is null
  and r.api_result_source is not null
  and r.trifecta_payout is not null
  and e.trifecta_payout = r.trifecta_payout;
