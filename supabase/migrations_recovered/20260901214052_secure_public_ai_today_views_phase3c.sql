-- Public access for live/today AI pages only. Keep source tables RLS-protected and limit anon/authenticated to a narrow JST date window.

-- upcoming_races
DROP POLICY IF EXISTS "public_read_live_window" ON public.upcoming_races;
CREATE POLICY "public_read_live_window"
ON public.upcoming_races
FOR SELECT
TO anon, authenticated
USING (
  race_date BETWEEN ((now() AT TIME ZONE 'Asia/Tokyo')::date - 1)
                    AND ((now() AT TIME ZONE 'Asia/Tokyo')::date + 1)
);

-- ichika_live_predictions (date is resolved through upcoming_races)
DROP POLICY IF EXISTS "public_read_live_window" ON public.ichika_live_predictions;
CREATE POLICY "public_read_live_window"
ON public.ichika_live_predictions
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.upcoming_races u
    WHERE u.id = ichika_live_predictions.upcoming_race_id
      AND u.race_date BETWEEN ((now() AT TIME ZONE 'Asia/Tokyo')::date - 1)
                          AND ((now() AT TIME ZONE 'Asia/Tokyo')::date + 1)
  )
);

-- ai_live_results (date is resolved through upcoming_races)
DROP POLICY IF EXISTS "public_read_live_window" ON public.ai_live_results;
CREATE POLICY "public_read_live_window"
ON public.ai_live_results
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.upcoming_races u
    WHERE u.id = ai_live_results.upcoming_race_id
      AND u.race_date BETWEEN ((now() AT TIME ZONE 'Asia/Tokyo')::date - 1)
                          AND ((now() AT TIME ZONE 'Asia/Tokyo')::date + 1)
  )
);

-- ai_ensemble_predictions
DROP POLICY IF EXISTS "public_read_live_window" ON public.ai_ensemble_predictions;
CREATE POLICY "public_read_live_window"
ON public.ai_ensemble_predictions
FOR SELECT
TO anon, authenticated
USING (
  race_date BETWEEN ((now() AT TIME ZONE 'Asia/Tokyo')::date - 1)
                    AND ((now() AT TIME ZONE 'Asia/Tokyo')::date + 1)
);

-- Make the public-facing views honor caller RLS instead of view-owner privileges.
ALTER VIEW public.v_ai_today_ranking SET (security_invoker = true);
ALTER VIEW public.v_ai_v8_today SET (security_invoker = true);
ALTER VIEW public.v_ai_v8_summary SET (security_invoker = true);
