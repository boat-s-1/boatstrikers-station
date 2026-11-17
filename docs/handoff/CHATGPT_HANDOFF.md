# BoatStrikers — ChatGPT cross-chat handoff

Updated: 2026-11-18 JST
Status: handoff framework only; not a verified complete project audit.

## Purpose
This file is the durable starting point for a new ChatGPT conversation. Do not assume a previous chat's tool state, local files, permissions, or approvals persist.

## Canonical sources and precedence
1. GitHub repository `boat-s-1/boatstrikers-station` current branches, commits, PRs, CI.
2. Supabase production read-only metadata and catalog (project identity must be verified).
3. Vercel deployment status and actual environment configuration.
4. Project documents and chat handoff summaries.
When sources conflict, report the discrepancy rather than silently choosing a version.

## Known workstreams (reverify every session)
- PR #297: isolated integration validation / audit.
- PR #298: OpenAPI sync safety, draft.
- PR #299: AI agent controller offline smoke, draft.
- PR #300: community UI and permissions, draft; migration/bootstrap gap.
- PR #301: Cron completion-log update observability, unmerged at last check.
- TRINITY V2/V3 snapshot comparison and data collection.
These are pointers, not authorization to deploy or merge.

## Critical current risk (from PR #300 description, verify latest)
Fresh Supabase branch bootstrap failed on missing base schema dependencies. Production schema-only export and reconciliation were proposed as the next step. Do not interpret a FUNCTIONS_DEPLOYED status as successful DB migration. No production schema change should be made merely to fix a fresh branch.

## Session-start procedure
1. Read this file and inspect latest PR #297-#301 and newer related PRs.
2. Check branch heads, CI status, unmerged changes, current migrations and docs.
3. Read-only inspect Supabase/Vercel only if relevant and authorized; do not expose secrets.
4. Produce a table of verified completed, in-progress, blocked, and unknown items with evidence and dates.
5. State the next safe batch and what needs explicit approval.
6. Never claim work was executed unless tool output confirms it.

## Safety
- No production DB writes, RLS/ACL changes, Cron changes, deployments, merges, secrets handling, billable branches, or paid actions without scoped approval.
- Never store passwords, tokens, service-role keys, DB connection strings, customer data, or unredacted schema dumps in this document.
- Previous approval for a specific isolated branch or operation is not blanket approval for a new one.
- Prefer isolated tests and draft PRs; preserve existing work.

## End-of-session update format
- Timestamp (JST)
- Goal and scope
- Verified actions (URLs, branch, commit SHA, tests)
- What was not performed
- Current blockers / safety concerns
- Next 1-3 concrete actions
- Required user approval
- Source freshness / unknowns

## Paste into a new chat
「BoatStrikersの開発を引き継いでください。GitHubの `docs/handoff/CHATGPT_HANDOFF.md` を読み、最新PR・コミット・CIを再確認し、必要に応じてSupabaseを読み取り専用で照合してください。前のチャットの完了報告を鵜呑みにせず、証拠を示して現在地を整理してください。本番変更・デプロイ・マージ・有料操作は私の承認前に実行しないでください。確認が必要なところまで、安全な作業をまとめて進めてください。」
