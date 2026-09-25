# BoatStrikers TRINITY War Room — Phase 2

Status: design-only / no Production changes

## Goal
Add a members-only aggregation layer above the existing Ichika, Hatsune, and Kiina prediction systems without changing their existing prediction logic.

## Safety boundaries
- Do not modify existing character prediction logic in Phase 2.
- Do not apply migrations to Production from this branch.
- Do not call `/api/members/session` repeatedly from the TRINITY page; reuse the existing member cookie/entitlement flow.
- TRINITY APIs must enforce member entitlement server-side.
- Prediction inputs must retain source identifiers and timing so results are auditable.
- `previous_day` and `after_exhibition` must be stored as separate snapshots; never silently overwrite the former with the latter.

## Proposed flow
1. Read existing character prediction/ranking outputs.
2. Normalize each character opinion into a common race-level shape.
3. Build a TRINITY session for `(race_date, course_code, race_no, timing)`.
4. Store source opinions and the deterministic aggregation output.
5. Expose the result only through a member-protected API.
6. Settle the published TRINITY selection after official results are available.
7. Use settled history for later calibration/backtesting; do not let live outcome data leak into an already-published prediction.

## Proposed tables

### `bs_trinity_sessions`
One immutable prediction snapshot per race/timing/version.

Suggested fields:
- `id uuid primary key`
- `race_date date not null`
- `course_code integer not null`
- `race_no integer not null`
- `timing text not null check (timing in ('previous_day','after_exhibition'))`
- `model_version text not null`
- `status text not null default 'draft'`
- `agreement_level numeric`
- `confidence numeric`
- `final_summary text`
- `final_tickets jsonb not null default '[]'::jsonb`
- `source_snapshot jsonb not null default '{}'::jsonb`
- `published_at timestamptz`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Recommended unique key:
`(race_date, course_code, race_no, timing, model_version)`

### `bs_trinity_opinions`
Normalized per-character evidence used by a TRINITY session.

Suggested fields:
- `id uuid primary key`
- `session_id uuid not null references bs_trinity_sessions(id) on delete cascade`
- `character_code text not null check (character_code in ('ichika','hatsune','kiina'))`
- `source_type text not null`
- `source_id text`
- `probability numeric`
- `weight numeric not null default 1`
- `stance jsonb not null default '{}'::jsonb`
- `summary text`
- `risk_notes text`
- `created_at timestamptz not null default now()`

Recommended unique key:
`(session_id, character_code, source_type, source_id)`

### `bs_trinity_results`
Settlement record for a published session.

Suggested fields:
- `session_id uuid primary key references bs_trinity_sessions(id) on delete cascade`
- `result_combination text`
- `tickets integer not null default 0`
- `hits integer not null default 0`
- `investment_yen integer not null default 0`
- `payout_yen integer not null default 0`
- `recovery_rate numeric`
- `settled_at timestamptz`
- `created_at timestamptz not null default now()`

## API design

### `GET /api/members/trinity`
- Requires existing BoatStrikers member entitlement.
- Returns published TRINITY sessions for a date.
- Optional filters: `date`, `timing`, `course_code`, `race_no`.
- Must not expose unpublished source/internal fields.

### `POST /api/admin/trinity/build`
- Admin-only.
- Builds a draft snapshot from existing character outputs.
- Idempotent for the same race/timing/model version.
- Does not alter any existing character prediction row.

### `POST /api/admin/trinity/publish`
- Admin-only.
- Publishes an already-built immutable snapshot.
- Publication time is recorded.

### `POST /api/cron/trinity-settle`
- Protected by `CRON_SECRET`.
- Settles only published sessions whose official result is available.
- Idempotent; re-running must not double-count investment or payout.

## Aggregation v1
Start deterministic and auditable before introducing a learned meta-model.

1. Normalize each available specialist output to a 0–1 confidence scale.
2. Apply condition-specific weights only when backed by settled historical sample data.
3. Track missing specialists explicitly rather than treating missing as zero confidence.
4. Produce an agreement score separately from prediction confidence.
5. Generate a limited ticket set from the combined race-order probabilities.
6. Store all source inputs and weights used for each published snapshot.

No claim of improved accuracy should be shown until backtesting and forward results demonstrate it.

## Members page
Proposed route: `/members/trinity`

Sections:
- TRINITY hero / three-character meeting visual
- Today's selected races
- Previous-day meeting
- After-exhibition final meeting
- Three specialist opinions
- Final TRINITY tickets
- Settled performance history

Access should be checked server-side through the existing entitlement helpers, not only hidden in the client UI.

## Next implementation checkpoint
Before writing a Production migration:
1. Map the exact source tables/IDs for Ichika, Hatsune, and Kiina published predictions.
2. Map official-result and payout source columns used by the current settlement flow.
3. Confirm the desired entitlement level (`active`, `plus`, or `premium`).
4. Backtest candidate weighting rules against historical frozen predictions without rewriting historical rows.
5. Only then create the SQL migration and API implementation on this feature branch.
