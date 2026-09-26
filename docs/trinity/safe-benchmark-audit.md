# TRINITY V2 SAFE benchmark: point-in-time source audit

Status: **BLOCKED — no official STRICT number is defensible yet.** Work is confined to `feature/trinity-war-room`. No production schema or TRINITY prediction behavior was changed, and V3 condition exploration is suspended.

## Race classification

The previous July grade treated 2,076 races as SAFE-B because their six rows existed before closing. This was too generous: all were updated after closing, with no immutable record of the feature values used by V2. They are now **UNSAFE**. In the legacy 11,557 settled races, no race currently meets the required full-feature SAFE-A or independently verified SAFE-B standard. See [`data/trinity/safe-race-classification.csv`](../../data/trinity/safe-race-classification.csv).

| July reason | Races | Entry rows | Race dates | Source assessment |
|---|---:|---:|---|---|
| U1: entry created after race day | 2,856 | 17,136 | Jul 1–18 | 2,852 eligible races exist in `ai_v2_training_rows`, but all are later historical reconstructions. No verified as-of substitute. |
| U2: entered before closing, feature values later updated or unproven | 2,076 | 12,456 | Jul 19–31 | Historical reconstruction exists for eligible races; no per-feature as-of proof. Previously mislabeled SAFE-B. |
| U3: time missing | 0 | 0 | — | July `closing_time` and row timestamps exist. |
| U4: historical reconstruction | 2,852 | 17,112 | Jul 1–18 | **Overlapping provenance tag with U1**, not an additional exclusive group; captured timestamp is NULL. |
| U5: other | 0 | 0 | — | — |

U1 and U2 partition all 4,932 July races. U4 is an overlap tag and must not be added to that total. The original UNSAFE set of 2,856 races is entirely U1. The last entry creation time for each U1 race is on a calendar day **after** its race day in JST, so this conclusion does not depend on an estimate of finishing time. Full details: [`unsafe-reasons.csv`](../../data/trinity/unsafe-reasons.csv) and the [July timestamps](../trinity-july-entry-time-grades-2026-09-26.csv). `deadline_time` is NULL throughout the period, so the audit uses `bs_race_events.closing_time` in JST.

## Alternative source inventory

The audit searched the public schema for prediction, history, snapshot, training, archive, accumulated and feature tables, then checked feature columns, timestamps and race coverage. The strongest candidates are:

| Source | Coverage and provenance | Can fully reconstruct V2 as-of input? |
|---|---|---|
| `ai_v2_training_rows` | July: 4,913 previous-day races ×6; August: 756 ×6. `source_mode=historical_reconstructed`, `captured_at=NULL`; loaded on August 20. It also contains target/outcome columns. | **No.** Later reconstruction is not proof that values were available before prediction. Targets must never be prediction inputs. |
| `ai_v2_predictions.feature_snapshot` | No July rows. August: 10,188 previous-day rows covering 1,554 races; September: 21,168 rows covering 3,528 races. All these prediction/cutoff timestamps precede race closing. The JSON has national/local win rates and motor/boat rates and a race-wide `is_female_race`. | **Incomplete.** No row contains `average_st` or individual gender. V2 uses average ST. Some August races have more than one prediction record per boat; exact snapshot selection needs version auditing. |
| `bs_ai_entry_history` | No July–September historical entry rows. | **No.** |
| `bs_ai_predictions` / legacy archive | Predictions exist from mid-July, with some pre-closing timestamps; their saved opinions are not six-boat feature vectors. | **No.** |
| `bsc_official_predictions` | September previous-day: 1,316 records, 1,211 published before closing; others were published later. Stored selections, not complete V2 input. | **No.** |
| `ai_predictions.input_snapshot` | July saved JSON examples contain only `historical_replay: true`; no six-boat features. | **No.** |
| `ichika_training_features` / stadium snapshots / elimination training view | Partial first-boat metrics, venue aggregates, or mutable views. | **No.** |

The current `bs_race_entries` for **every** July, August and September race were updated after its recorded closing time. Some updates may have touched only result fields, but no column-level historical copy proves the V2 feature values were unchanged. The `source_updated_at` field is NULL for all 82,656 entry rows in this period. These facts bar promotion of a reconstructed race to SAFE-A or validated SAFE-B.

## Three benchmark outputs

| Dataset | Races | Purchased | ROI | Decision |
|---|---:|---:|---:|---|
| [A STRICT](../../data/trinity/v2-strict-benchmark.json) | 0 | 0 | **undefined** | No complete, verifiable six-boat inputs from before prediction. No official benchmark yet. |
| [B EXTENDED](../../data/trinity/v2-extended-benchmark.json) | 0 | 0 | **undefined** | No historical reconstruction qualifies as independently verified. |
| [C LEGACY](../../data/trinity/v2-legacy-benchmark.json) | 11,557 | 11,311 | 71.8673% | Current-row JS reconstruction for comparison only; cannot represent historical profitability. |

STRICT race counts are July 0, August 0, September 0. JSON uses `null` for unavailable financial metrics, rather than presenting zero ROI or a fabricated performance. Legacy JSON contains investment, payout, profit, hits, hit rate, PASS count, average tickets, losing streak, maximum payout and top-1/3/5-excluded ROI, with monthly slices. Historical top-20%, Ichika and provisional V3 performance remain reference-only and are **not rerun or promoted** until STRICT inputs exist. TRAIN and VALIDATION periods cannot responsibly be assigned to this empty STRICT dataset.

## Forward path to an official benchmark

1. Preserve all six original entry feature vectors **at generation time**, together with source capture time, timing, version, V2 outputs and BUY/PASS. Never update the snapshot; store results separately. A review-only schema draft is in [`forward-snapshot-schema.sql`](./forward-snapshot-schema.sql), with a capture/validation helper at `app/lib/trinitySnapshotV1.js`. They have **not** been applied or wired into a production job; consequently they do not create SAFE-A observations yet.
2. Keep upcoming races' predictions and inputs immutable before their closing time. Verify source capture and publication timestamps; only these become SAFE-A. If a trustworthy independent historical source containing average ST is later found, re-evaluate SAFE-B with a written feature-by-feature proof.
3. Once enough forward SAFE-A races exist, compute STRICT and establish a fixed version/hash. Only then choose new TRAIN/VALIDATION windows and freeze V3 conditions before a future TEST start date. Any post-TEST tuning must be a new model version.

The precise 71.43% SQL-vs-JS race-level discrepancy also still requires the original SQL/ledger. That issue does not justify using either historical number as the official point-in-time benchmark.
