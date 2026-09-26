# SAFE V2 benchmark reconciliation and July input-time audit

Branch: `feature/trinity-war-room`; read-only database queries, no production changes. **No official point-in-time SAFE V2 benchmark can yet be certified.** This audit stops before changing V3 selection conditions.

## 71.43% versus 71.87%

The handoff supplied only aggregate values for the 71.43% run, with no SQL implementation, race-level tickets, normalized inputs, result snapshot or per-race ledger. It describes that run as a Supabase SQL reconstruction of V2; the JS result is the formal authority. The exact JS `backtest-v2-compare.mjs` has now been run from a fixed local export using `TRINITY_INPUT_JSONL`. Its result matches the independent JS analyzer from the prior checkpoint **exactly** for races, purchases, investments, payouts, hits, ROI, and monthly totals.

| Metric | Supplied SQL reconstruction | Current V2 JS | Difference (JS minus supplied) |
|---|---:|---:|---:|
| Eligible races | 11,557 | 11,557 | 0 |
| Bought races | 11,315 | 11,311 | -4 |
| PASS | 242 | 246 | +4 |
| Tickets | 50,036 | 49,934 | -102 |
| Investment | ¥5,003,600 | ¥4,993,400 | -¥10,200 |
| Payout | ¥3,574,130 | ¥3,588,620 | +¥14,490 |
| Hits | 1,353 | 1,352 | -1 |
| ROI | 71.43% | 71.8673% | +0.44 points |

The supplied RAW comparison also states 11,212 bought races, while the JS raw mode on this exact export has 8,983. This large discrepancy proves the supplied RAW/SAFE summary cannot be an execution of the current JS script on the fixed export; SQL translation, source version, query pagination or another historical implementation differs. **Which individual races account for the supplied numbers cannot be established from aggregate totals**: many different race-level ledgers can produce the same totals. The original SQL and per-race 71.43% ledger (or its complete original input snapshot) are necessary to identify each changed race and the precise cause. Do not label either result an official, leakage-free benchmark yet.

The current JS input SHA-256 is `277a9d09206d289dc4f7920a8dbc2caa17e98658ca611bead5346df28ccc2e61`. It is preserved as a [compressed, fixed reconstruction input](./trinity-v2-reconstructed-input-2026-09-26.jsonl.gz) with archive SHA-256 `7a586587643c46af6481bd929535ee5708bed52b22876082d4b1649d09367e90`. Uncompress to a local JSONL file and pass its path to `TRINITY_INPUT_JSONL`; this is **not** a contemporaneous snapshot or a certified TRAIN set. The CLI also supports `TRINITY_LEDGER_PATH`; `compare-v2-ledgers.mjs` compares two ledgers by race key, selection, buy/PASS, normalized feature vector, outcome, and payout. This makes the missing comparison executable when the original ledger becomes available. Entry/result queries now use stable explicit ordering when run against Supabase. `result_status` and `race_status` are captured in the new ledger; V2 inclusion still follows the original script's nonzero payout and valid trifecta rules. The DB has 82,656 unique entry rows, 13,776 unique events, 11,758 unique result rows in this period. There are two positive-payout results with neither trifecta alias; conflicting non-null trifecta aliases: zero.

## July race-level time audit

The database's `bs_race_events.deadline_time` is NULL in **every** July–September event. `closing_time` has the actual cutoff for every July event and is interpreted as Japan time. [Per-race CSV](./trinity-july-entry-time-grades-2026-09-26.csv) lists the first and last entry creation, latest update, closing time, proxy `bs_ai_predictions` previous-day prediction creation, six-entry count, classification, and reason for each July race. Source race-time export SHA-256: `bb4e267101005a9faf0d314dc8d8e585e9869b17dc55d338526ff1db3e98a655`.

| July classification | Races | Meaning |
|---|---:|---|
| SAFE-A | 0 | No immutable evidence that the feature values at prediction time equal the current rows. |
| SAFE-B | 2,076 | All six rows existed before closing, but were updated after closing; historical reconstruction only. |
| UNSAFE | 2,856 | At least one entry row was first created after the race closing time. |

All 4,932 July races have entry rows with `updated_at` after closing. July 1's 1,008 entry rows were created on August 5. In the 4,913 July races included by the JS backtest, 2,061 are SAFE-B and 2,852 are UNSAFE. Even the SAFE-B subset cannot be used as certified as-of TRAIN data. `bs_ai_entry_history` has no July–September frozen entry history. The 619 July races with a pre-closing `bs_ai_predictions` timestamp still have entry rows later updated after closing; that timestamp is only a proxy, not a saved TRINITY input snapshot.

The same preliminary cross-month audit found every August (4,932) and September (3,912) event's entry rows updated after closing. Twelve August and 155 September races contain entries first created after closing. September also has 12 events whose recorded closing time is midnight and must be checked separately before classification. None of these present-day rows alone proves that their current features were known at the previous-day prediction cutoff.

## Decision and next dependency

The **reproducible current-row JS reconstruction** is 71.8673%. It is not the official leakage-free SAFE V2 benchmark. The 71.43% SQL total remains a legacy, unverified figure; it is not used to choose V3 rules. No benchmark is frozen as official and no V3 conditions are added in this audit. To finish the requested race-level reconciliation, recover the original SQL plus its race-level output, or the exact original input data/version. To create a SAFE-A backtest, obtain immutable feature snapshots captured before the relevant prediction time; if none exist, start collecting them prospectively. Do not relabel historical reconstructions SAFE-A.
