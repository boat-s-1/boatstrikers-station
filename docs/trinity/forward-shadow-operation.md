# TRINITY prospective shadow operation (candidate-01)

Start boundary: first actual `trinity_prediction_snapshots.inserted_at` after deployment. No historical rows are backfilled.

- The scheduled route `/api/cron/trinity-shadow` reads six contemporaneous entry rows before the official JST closing time, normalizes legacy rate scales, and removes exhibition fields from `previous_day`. The `after_exhibition` capture requires all six exhibition time and ST values.
- V2 and V3-candidate-01 are calculated from the same saved inputs and inserted atomically. V3 selects only non-women, non-Kiina-led races with boat 1 top-ranked and `top_combination.probability >= 0.11148521803720483`, otherwise PASS. This threshold and logic are fixed; any change requires a new candidate version and a fresh prospective window.
- User-facing TRINITY predictions are not changed. Neither shadow candidate places a bet or publishes a prediction.
- Result settlements are appended to `trinity_prediction_results`. Both tables reject UPDATE/DELETE/TRUNCATE. Database guards verify pre-close generation and insertion, source odds capture time, six complete features, and official result existence. Snapshot identity is unique per race/timing/engine version.
- `/admin/trinity-shadow` is accessible only through the existing admin authentication. It shows daily and cumulative comparisons, with ROI on settled purchased races only. The first seven days are provisional, day 30 is the first formal prospective evaluation, and day 60 with at least 300 bought V3 races is an adoption consideration, not an automatic switch.
- The existing 11,557 race / 71.87% result remains a LEGACY research comparator only; no prospective STRICT ROI exists until results settle.
- `previous_day` names the **pre-exhibition** input configuration. Same-day early capture is possible if prior-day event data were not available. The captured clock timestamp, race date and timing field permit later stratification by calendar lead time.
- Odds signals are recorded for future investigation and are never consulted by V3 candidate-01 selection. Missing odds or unavailable individual ticket price is recorded as NULL rather than estimated.
- Any new candidate must use its own engine version, a documented first snapshot timestamp, and remain separate in daily metrics. Never retune candidate-01 using its future results.
