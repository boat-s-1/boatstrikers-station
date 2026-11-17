# PR #302 — no-secret preflight review

## Confirmed diff

The proposal adds a `workflow_dispatch`-only workflow accepting a 20-letter lowercase branch project ref, rejecting the known production project ref, and printing a generic pass message. The job uses `contents: read`, no checkout, no Supabase network calls, no environment, and no credentials. Its successful result **does not establish that the branch exists, is isolated, or has distinct credentials**.

## Security boundaries

- This is **not** a live HTTP runner, does not create/delete paid Supabase branches, and cannot justify registering service-role keys.
- The workflow is intended for the default branch only after separate approval; Draft PR #302 is not deployed and no manual run is claimed.
- This single-account repo cannot rely on `Required reviewers` as an independent approval boundary. Do not grant environment secrets to mutable PR code.
- The allowlist rejects only the known production ref; it does **not** prove an arbitrary other ref is a disposable branch. An authoritative Supabase branch listing and branch-only credential proof are still mandatory.
- Future live runner must use reviewed immutable code, branch-only credentials, a narrowly scoped fixture, verified cleanup, and independent branch deletion confirmation. These remain separate HOLD gates.

## Approval boundary

Merge of this no-secret preflight requires explicit user approval. That approval would **not** authorize a live runner, a paid branch, secret registration, HTTP writes, or production deployment.
