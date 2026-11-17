# Agent Controller — synthetic integrated pipeline artifact (2026-11-17)

The offline GitHub Actions workflow now runs `tools/agent-controller/offline-pipeline-report.mjs` and uploads `offline-report/pipeline-validation.json` alongside the existing diagnostic artifact.

The script uses six **fixed synthetic fixtures** (normal abnormal-review, stale, unverified, unapproved, synthetic receipt, worker crash replay). It asserts the expected decision for each and that **every** result has `writeAllowed:false` and `sendAllowed:false`. Any mismatch fails the job.

Artifact fields include `kind:synthetic_offline_only` and `productionEvidence:false` to avoid confusion with real monitoring evidence. No live source is read, no notification is sent, no credentials are used and no production schema is modified. This is a CI traceability improvement, not an operational worker. Deployment HOLD.
