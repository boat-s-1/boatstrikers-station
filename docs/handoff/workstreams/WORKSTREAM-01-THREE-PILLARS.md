# Workstream 01 — レース・ブログ・掲示板（3分類）

Record version: 1.0 | Recorded: 2026-11-18 JST | Status: ACTIVE / NOT COMPLETE
Parent goal: `docs/handoff/FINAL_GOAL_CHARTER.md` v1.0 (APPROVED).

## Identity and handoff chain
- Workstream ID: WS-01
- Original conversation (reference only; may require user access): https://chatgpt.com/c/6afca913-537c-83ee-ad65-a3be8026ef4a
- Continuations: WS-01-1, WS-01-2, etc. Each continuation MUST preserve this goal and read current GitHub state; ChatGPT conversation links do not automatically expose full conversation contents.
- Source design: `docs/community/three-pillars-forum-design-2026-11-17.md` on `codex/community-three-pillars-design-20261117`.
- Active implementation PR: https://github.com/boat-s-1/boatstrikers-station/pull/300 (Draft at registration).

## Fixed workstream final goal
BoatStrikersサイトを「レース・ブログ・掲示板」の3分類で構成し、公式・キャラクター発信、レース実況、会員向け返信と公開範囲の安全な制御、サイト内通知と将来のアプリ通知への拡張を、既存機能を壊さず安定運用できる形で実現する。

This workstream goal is a documented synthesis of the user's supplied first-chat decisions and design, subordinate to the owner-approved platform charter v1.0. Any material change to the goal must be explicitly approved; planning details remain amendable.

## Locked requirements currently established by design
- First-level site sections: レース / ブログ / 掲示板. Preserve existing URLs; new forum entry `/community`.
- Homepage: 5 most recent publicly displayable official threads; each Ichika/Hatsune/Kiina page: 3 character-matching items.
- Community homepage, character categories, live race category, thread URL, event page containing 12 race threads.
- Official/admin-controlled thread creation/editing and moderation; eligible signed-in members can reply to official threads; initial release disallows member-to-member threading at database layer.
- **Superseding approved design (2026-11-17):** `audience=public|members|paid`, `reply_policy=paid|disabled`, and separate `status`. Initial reply permission is active paid members only, including on public threads. Previous `visibility=public_all|public_post_members_replies|members_only` was provisional scaffold design and MUST NOT be deployed unchanged. Server, DB, API, HTML, caching, SEO and Realtime enforce this consistently. Source: `docs/community/official-post-visibility-contract-2026-11-17.md` at PR #300 head.
- 12R generation idempotent, search/indexing safeguards, mobile usability, report/abuse controls, prior race/blog/member routes regression-free.
- Existing LINE/Discord outbound messaging must not be disabled as part of early staged migration.

## Definition of done (evidence required)
1. 3-category navigation, homepage + character widgets, and forum URLs verified in the intended deployed environment.
2. Thread CRUD for staff, authorized member replies, reports/moderation, and 12R event creation passed functional and mobile tests.
3. Subscription and role permissions tested end to end with positive/negative tests; no restricted content leakage via HTML/API/Realtime/cache.
4. Race and blog features preserve existing behavior, with regression evidence.
5. Notifications implementation, membership lifecycle (expired, deleted, banned), moderation, SEO and observability verified to agreed release scope.
6. Reproducible safe migration/bootstrap, CI, staging, rollout/rollback evidence; explicit owner approval before production changes.

## Verified status at registration (2026-11-18)
- Design file verified on source branch. Original user-provided design commit: `cfc28864`.
- PR #300 verified as open, Draft, unmerged; head at `bbed67b1e80c086e02c6c38a0efd9f9b84c57dff` during inspection; 86 files changed. These numbers are snapshots and must be refreshed.
- PR #300 notes Supabase isolated branch migration failed at `20260820210127` because fresh DB lacks `public.bs_race_results`. DB migration records and repository migration files diverge. No successful full isolated bootstrap yet.
- PR describes partial forum public UI scaffold; complete community features and notification DB/API/read/Web Push not established.
- Production DB and existing messaging unchanged according to PR evidence. No completion percentage assigned.

## Immediate blockers and next steps
1. Obtain and safely audit a production **schema-only** export, no data or secrets, per `docs/community/production-schema-only-export-runbook-2026-11-18.md`; avoid exposing DB passwords.
2. Reconcile baseline objects against 133 recorded migrations and repository sources; review least-privilege baseline/migrations.
3. Validate on new isolated environment only after scoped approval for hourly resource; prove complete migration and ACL/API behavior.
4. Complete community backend/UI, notification lifecycle, tests, preview/staging verification and documented release plan.
5. Production deploy, membership permission changes, merges and paid resources require scoped approval.

## Every continuation must
- Read platform charter v1.0, this WS-01 register, source design, and live PR #300 status; check other PRs for conflicts.
- Report VERIFIED DONE / IN PROGRESS / BLOCKED / UNKNOWN before coding.
- Retain this fixed workstream goal. Update status evidence with timestamp and commit/PR references; do not overwrite prior facts with unsupported claims.
- Avoid concurrent changes to shared DB/schema without cross-workstream coordination.

## 2026-11-18 follow-up: user-supplied continuation audit

- Continuation conversation supplied: https://chatgpt.com/c/6afc60d1-ea08-83ee-b82d-d1ebdb5090ea
- Source: user-uploaded `BoatStrikers開発 総合引き継ぎ・最終目標確認書` (2026-11-18), reviewed in chat. This is a **secondary audit report**, not direct access to the full prior conversations. Its claims about other PRs/DB are not automatically current and must be verified before actions.
- Audit conclusion: no evidence of authorized scope reduction, but full identity of original goal remains unproven because complete original conversation/goal history was not available.
- Preserve three levels: (1) approved platform-wide charter v1.0, (2) this workstream's race/blog/community integration, (3) individual PRs such as #300/#301. Completion of PR #300 is **not** completion of WS-01 or platform.
- Scope safeguard: race (24 venues, entries/exhibition/results/payout/history and prediction), blog (character articles, editor, AI quality-gated publishing), community (official threads, member replies, 12R live), account and tier permissions, notifications, AI/TRINITY, educational content, reliable cloud collection/monitoring all remain within platform-wide completion. Not all are owned solely by WS-01; cross-workstream ownership must be reconciled.
- Audit cites PR #295/#296 blog, #297 DATA LAB, #298 cloud sync, #300 forum, #301 Cron, #303 HTTP workflow, plus TRINITY. These are **audit-reported snapshots**; re-fetch current GitHub status before treating as verified.
- Open: clarify full original goal from available artifacts, exact paid membership/payment scope, distribution form, acceptance thresholds, and PR overlap; do not silently narrow scope to forum.
- Audit reports an hourly isolation branch associated with PR #301 may still exist. This is **unverified current state**; check with Supabase before any delete/charge-related action. Never confuse it with the already deleted PR #300 test branch.

## 2026-11-18 second supplied audit — comparison and scope control

- Second chat supplied as user-identified "2つ目": https://chatgpt.com/c/6afc7abb-d820-83ee-a48e-b73804012123
- User pasted `BoatStrikers開発 — 最終目標・引き継ぎ内容の統合確認書`. Its subject is **the same** platform charter and race/blog/community workstream, rather than evidence establishing a distinct independent goal. Register as another evidence source for WS-01 pending explicit chat-lineage verification; do not silently create a separate WS-02 from the ordinal "second".
- Cross-audit convergence: no recorded formally approved reduction of approved platform scope; PR #300 is not complete site or platform; full chat-original equivalence remains unproven.
- Material confirmed discrepancy: initial forum scaffold `visibility` taxonomy conflicts with later contract in `docs/community/official-post-visibility-contract-2026-11-17.md`. Latter says `audience=public|members|paid`, `reply_policy=paid|disabled`; paid members can reply, free members only read eligible content, and initial member-to-member threading remains disabled. The old scaffold requires migration before production.
- Verified via connected GitHub at 2026-11-18: PR #300 head `bbed67b1e80c086e02c6c38a0efd9f9b84c57dff`, branch `codex/community-three-pillars-design-20261117`; later contract file fetched successfully. The second report's claimed inability to identify PR branch is not a remaining unknown.
- Notifications: `docs/community/unified-notification-app-migration-plan-2026-11-17.md` confirms common BoatStrikers Auth identity, server-authorized notification event vs transport separation, inbox as source of truth, optional PWA Push and staged LINE/Discord coexistence. These are **design decisions**, not deployed implementations.
- Reported PR #294/#295/#296/#297/#298/#299/#300, SEO #274 and cross-PR overlaps need independent current status verification before release; not completed by preserving this record.
- Native iOS/Android release, exact payment scope and all acceptance thresholds remain unverified as v1.0 initial release commitments; preserve future-facing intent without asserting those are shipped or mandatory for initial milestone.
- No production, database, deployment or merge modifications made for this audit. Documentation-only correction on existing PR #304 working branch.
