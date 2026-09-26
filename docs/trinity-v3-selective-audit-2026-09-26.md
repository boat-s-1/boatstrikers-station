# TRINITY SAFE V2 / SELECTIVE V3 exploratory audit (2026-09-26)

Branch: `feature/trinity-war-room`. No production or database changes.

## Inputs and limits

- Read-only export of `bs_race_entries`, `bs_race_events`, and `bs_race_results` for 2026-07-01 through 2026-09-25 (82,656 entries, 11,557 eligible settled races). The raw export remains local and is **not committed**.
- `buildTrinityCoreV2` is executed in Node with the same SAFE thresholds as `backtest-v2-compare.mjs`; the new analyzer and V3 backtest require a local JSONL export as their argument. Aggregated results: [V2 breakdown](./trinity-v2-selective-2026-09-26.json), [V3 comparison](./trinity-v3-selective-2026-09-26.json).
- These are **current database rows**, not immutable snapshots taken before prediction. The results do not establish historical profitability. The supplied previous benchmark (71.43%, 11,315 bought races) does not reproduce: current rows produce 71.87%, 11,311 bought races. September alone currently returns 71.50%, whereas the supplied figure was 72.02%. Data version or export context must be reconciled before fixing an official benchmark.
- July entries: 29,592 rows updated after race day (JST), and many created after race day; e.g. all 1,008 July 1 rows were created August 5. July gender is incomplete in 3,643 of 4,913 settled races. September rows have complete gender and no updates after the race day, but entries for September 25 were first created just after midnight on September 25 JST. The exact `previous_day` publication cutoff must be compared with input timestamps. There is no historical July–September immutable entry snapshot in `bs_ai_entry_history`.
- `bs_elimination_odds_snapshots` has 391 rows in this period, all in September and **zero** captured before the race date begins in JST. A `previous_day` V3 value rule using these odds would leak future information. This exploratory V3 therefore uses confidence and specialist agreement only.

## SAFE V2 and the first requested decomposition

SAFE V2: 11,557 eligible races, 11,311 bought, ¥4,993,400 invested, ¥3,588,620 returned, ROI **71.87%**, 1,352 hits, maximum losing streak 61. Top 20% of bought races by `top_combination.probability`, 2,262 races: ¥670,900 invested, ¥544,500 returned, ROI **81.16%**, 334 hits, 2.97 tickets on average, losing streak 36. Excluding the three largest payouts yields 76.62%.

Mutually exclusive descriptive classes: Hatsune = six women (when gender is available); Kiina = fifth boat is top first-place choice, or Kiina's top choice is fifth boat and the top trifecta contains it; Ichika = remaining races whose top first-place boat is 1; Other = remainder. This is a descriptive partition of V2 predictions, **not a claim that any character independently produced the tickets**. Tickets containing 5 occur in every top-20% race and alone cannot identify Kiina leadership.

| Top 20% class | Races | Investment | Payout | ROI | Hit rate | Avg tickets | Max losses |
|---|---:|---:|---:|---:|---:|---:|---:|
| Ichika | 1,074 | ¥306,400 | ¥309,060 | 100.87% | 12.29% | 2.85 | 36 |
| Hatsune | 202 | ¥55,700 | ¥33,800 | 60.68% | 13.86% | 2.76 | 26 |
| Kiina | 977 | ¥306,400 | ¥201,640 | 65.81% | 17.81% | 3.14 | 32 |
| Other | 9 | ¥2,400 | ¥0 | 0% | 0% | 2.67 | 9 |

The globally selected top-20% set uses September to determine its cutoff and is **descriptive only**. On the full bought-race set, 1/2/3/4/5-ticket ROI is respectively 40.45% (22 races), 97.72% (500), 76.31% (1,522), 70.23% (1,989), and 70.98% (7,278). The complete aggregate JSON also reports venue, race number, women's race, fifth-boat involvement, first-boat probability, probability gap, monthly and ticket-count slices. Venue/race-number spikes were not promoted to rules because many slices have small samples and no separate validation.

## V3 candidate and holdout

Experimental `selectTrinityV3` passes only non-women, non-Kiina-led races whose first-place top boat is 1 and whose top trifecta confidence exceeds a threshold determined **exclusively on July–August V2 purchases** (80th percentile cutoff: `0.11148521803720483`). It preserves V2's original tickets. No odds or result is read by the selector. The threshold is passed explicitly instead of becoming a production default.

| Sample | Model | Bought | Investment | Payout | ROI | ROI excluding top 1 / 3 payouts |
|---|---|---:|---:|---:|---:|---:|
| July–August TRAIN | SAFE V2 | 7,568 | ¥3,342,100 | ¥2,407,940 | 72.05% | 70.94% / 69.38% |
| July–August TRAIN | V3 candidate | 715 | ¥204,000 | ¥203,380 | 99.70% | 95.17% / 87.25% |
| September VALIDATION | SAFE V2 | 3,743 | ¥1,651,300 | ¥1,180,680 | 71.50% | 70.08% / 68.28% |
| September VALIDATION | V3 candidate | 369 | ¥106,200 | ¥107,910 | 101.61% | 91.46% / 72.90% |

V3's September surplus is ¥1,710 before fees and disappears when the single largest payout is removed. The top-three-excluded result is close to the V2 baseline and below the 85% aspiration. In addition, the July training data was created/updated after the races and gender was incomplete. **Do not deploy, claim a validated edge, or promote this candidate to production.**

## Next verification gate

1. Reconcile exported row versions and race inclusion against the originally cited 71.43% SAFE run. Save a repeatable export identifier or immutable snapshot.
2. Determine the exact previous-day publication timestamp and locate entries and feature values actually present before it. If unavailable, evaluate forward snapshots rather than calling a reconstructed July result a historical backtest.
3. Freeze rules on reliable input history and rerun on a new untouched period. Record point-in-time odds only for an after-exhibition Value version where a pre-prediction snapshot exists.

The missing Ichika/Hatsune daily AI rankings in the separate admin flow were caused by partial `ai_v2_daily_rankings` materialization and its health check. This TRINITY feature branch neither writes that table nor explains that earlier publishing failure.
