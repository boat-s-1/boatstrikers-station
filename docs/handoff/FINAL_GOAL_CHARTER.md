# BoatStrikers — Goal Charter (draft, pending owner confirmation)

Version: 0.1 | Date: 2026-11-18 JST | Authority: PROVISIONAL

## North Star (proposed, not yet approved)
Build a reliable BoatStrikers web/app platform that integrates accurate boat-racing data, explainable AI predictions (including TRINITY V2/V3), editorial and educational content, notifications, and membership offerings, while maintaining safe operations and verifiable data provenance.

This is a candidate synthesis of known workstreams. The owner must confirm scope and success criteria before it becomes a fixed goal.

## Invariants
- No chat, agent, or PR may silently rewrite the approved final goal or remove a requirement.
- Distinguish product outcome, implementation plan, and temporary experiments.
- Keep all major workstreams aligned to the approved goal, with explicit acceptance criteria and evidence.
- Production changes, deployment, merge, billable resources and secrets require scoped approval.
- A test passing is not equivalent to a feature being deployed or accepted.
- Never infer percent completion from PR counts.

## Workstreams to reconcile with owner
1. Data ingestion and integrity, race schedules, entries, results and historical validation.
2. TRINITY V2/V3 predictions, snapshot audit, outcome measurement and quality gates.
3. Public site and app/PWA, authentication, user experience.
4. Free/paid content, editorial workflow, characters, educational series.
5. Notifications, community, account model and staged transition from external channels.
6. Reliability, security, schema reproducibility, monitoring, CI/CD, operations.

## Goal change control
1. Propose a numbered goal-change request with rationale, affected workstreams, acceptance criteria, risk, and cost.
2. Obtain explicit owner approval.
3. Update this charter in a reviewed PR and record version/date.
4. Update each workstream's status and dependencies. Until approved, retain the previous accepted goal.

## Every new chat must
1. Read this charter AND `docs/handoff/CHATGPT_HANDOFF.md` from a verified Git ref.
2. Say whether the charter is still PROVISIONAL or APPROVED.
3. Compare the task against the North Star and identify its workstream.
4. Verify actual GitHub/Supabase/Vercel state as applicable, and state unknowns.
5. Report what advances the goal, what is blocked, and what requires approval.
6. Never claim completion without measurable evidence.

## Definition of Done template (per workstream)
- User-facing outcome and acceptance tests documented.
- Code merged and deployed to intended environment where required.
- Functional, security, regression and data-quality tests passed with evidence.
- Monitoring, rollback and operations documented.
- Owner acceptance recorded for release-sensitive changes.

## Open decisions requiring owner confirmation
- Is the North Star wording accurate?
- Which features are required for initial launch versus later phases?
- What are the concrete acceptance criteria for the whole platform?
- Is this charter authoritative across all BoatStrikers development chats?
