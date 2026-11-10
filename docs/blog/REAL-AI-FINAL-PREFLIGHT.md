# Final preflight

These commands describe a later, separately authorized run. This implementation task permits only offline tests.

For an approval restricted to one smoke call, use REAL-AI-SMOKE-ONLY-PLAN.md. Its mode is smoke-only, it reserves 21.42 JPY, explicitly sends store:false, and exits after smoke. Never use the four-stage plan below for smoke-only authorization. Approval formats from before the mode-bound version-2 record are invalid.

1. Use the dedicated checkout on `verification/pr295-safety` or `verification/pr295-ai-safety-guards`. Confirm fixed base `94677eedebfffb7cfef3f857e3d2a87a0f42a61d` is an ancestor of HEAD. The source guard checks every descendant commit, index and working-tree changes: only named safety additions and exact reviewed legacy-CLI wrappers are allowed; existing application/verification dependencies must match the base. Review the safety source fingerprint. Do not change the original work checkout.
2. Run the free checks in VERIFICATION-BUDGET-SAFETY.md. Confirm current official model prices/FX and genuine availability of `gpt-6.1-terra` through approved sources; never guess. No API probe is permitted during offline preparation.
3. Confirm Cloud status has current observations, the HTTP secret ready, api.openai.com enforced, and inherited proxy/CA trust. Never display the variable value. Actual model access, credential replacement and billing remain unverified until separately authorized real execution.
4. Complete an external plan using REAL-AI-THREE-ARTICLE-PLAN.md. Reuse the established stateDir, preserve its ledger, choose a new output directory, and run **offline** plan validation:

   `node scripts/blog/verification-cli.mjs preflight /absolute/external/plan.json`

5. Only after the user explicitly authorizes real execution, run:

   `node scripts/blog/verification-cli.mjs approve /absolute/external/plan.json`

   Enter the exact displayed phrase on an interactive terminal. It binds the full plan, source digest, 1,000/700 JPY limits, maximum four calls and output path. This creates approval only; it does not call OpenAI.

6. Within one hour, on an interactive terminal:

   `node scripts/blog/verification-cli.mjs run /absolute/external/plan.json APPROVAL-ID`

   The parent maps the injected HTTP secret to the child-only OPENAI_API_KEY without printing or saving it. The child enables Node24 proxy support, consumes approval, reserves all four calls, and asks separately before each call. Do not type any secret into a prompt. Any answer except the exact confirmation phrase stops the run.

7. Preserve output, approval consumption markers and ledger. Do not delete a stale lock, replace stateDir, restore spent budget, or retry after a timeout without manual review of unknown spend and a fresh explicit approval.

No GitHub push/PR update/merge, environment-config edit, database write, scheduled job or publication is part of this procedure.
