# BoatStrikers — FINAL GOAL CHARTER

Version: 1.0 | Approved: 2026-11-18 JST | Authority: APPROVED BY PROJECT OWNER
Status: Authoritative goal for all BoatStrikers development chats once this document is consulted. Stored on branch `docs/chat-handoff-20261118`; not yet merged to main.

## Approved final goal (owner's wording)

ボートレースのデータ収集、AI予想、TRINITY、キャラクターによる研究記事・教育コンテンツ、会員機能、通知機能を統合したWebサイト・アプリを完成させる。

すべての機能を安全かつ安定して運用でき、将来的な有料会員サービスにも対応する。

## Goal invariants

1. All BoatStrikers development chats must use the above approved goal as the common North Star.
2. No chat, agent, or PR may silently rewrite, narrow, or remove the approved goal. Scope changes require explicit owner approval and a recorded charter revision.
3. Implementation phases and prioritization may evolve without changing the final goal; separate MVP criteria from final completion.
4. Evidence-based completion: PR created != merged; tests passing != deployed; deployed != accepted. Verify real state.
5. Never invent a percent completion. Calculate only from explicit, agreed acceptance criteria.
6. Keep production DB, ACL/RLS, Cron, Vercel, integrations, billing, and secrets safe; request operation-specific approval before high-impact actions.
7. Record conflicts, blockers and source freshness rather than assume prior chat context is current.

## Workstream map

- W1: Race data collection, accuracy, entries, schedules, results, historical data integrity.
- W2: AI predictions and TRINITY, V2/V3 snapshots, validation and performance measurement.
- W3: Public web experience, mobile/PWA app, authentication and UX.
- W4: Character-based research, education, editorial workflow, free/premium content.
- W5: Membership, notifications, community, staged migration from external channels.
- W6: Security, migration reproducibility, monitoring, CI/CD, operations and reliability.

Workstreams are organizational categories, not a claim that every subfeature is approved for immediate release.

## Cross-chat protocol

At the beginning of each chat:
1. Fetch this charter and `docs/handoff/CHATGPT_HANDOFF.md` from a verified Git ref; prefer merged main once available.
2. State the exact charter version and Git ref/commit.
3. Identify the current workstream and how it contributes to the approved goal.
4. Inspect current relevant GitHub PRs, commits, CI and (when applicable) read-only Supabase/Vercel status.
5. Separate VERIFIED DONE, IN PROGRESS, BLOCKED, UNKNOWN and NOT STARTED.
6. Propose or execute the next safe batch; obtain scoped approval for production/billable/high-impact actions.
7. At handoff, update evidence, blockers, next steps and timestamps. Do not overwrite the approved goal.

## Change-control process

A goal change requires: (a) explicit owner request or approval; (b) documented rationale and scope impact; (c) version increment; (d) a reviewed GitHub change; (e) reconciliation of all workstreams. Until then v1.0 remains binding.

## Completion evidence

Each workstream must have documented user-facing acceptance criteria, functional/regression/security tests, verified data quality, intended deployment evidence where applicable, operations/monitoring/rollback, and explicit owner acceptance for release-sensitive steps.

## Pending planning decisions (do not block the approved goal)

- MVP vs later release scope and priorities.
- Quantified whole-platform acceptance criteria and operating targets.
- Exact rollout sequence and membership pricing.

## Related handoff

`docs/handoff/CHATGPT_HANDOFF.md` contains the current cross-chat startup and safety checklist. The charter governs the goal; the handoff describes evolving implementation status.
