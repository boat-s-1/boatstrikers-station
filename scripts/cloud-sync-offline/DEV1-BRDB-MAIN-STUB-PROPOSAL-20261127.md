# Manual workflow activation proposal — not applied to main (2026-11-27 JST)

GitHub only shows `workflow_dispatch` for a workflow whose file exists on the default branch. Draft #306 has the full, reviewed `.github/workflows/dev1-brdb-private-one-shot.yml`, but main has no file at that path. To enable the UI without merging Draft #306, place **only** the inert file below at the identical path on main after explicit approval. This changes GitHub Actions discovery only; it contains no secrets and no provider HTTP call.

```yaml
name: Dev1 BRDB private one-shot (candidate)

on:
  workflow_dispatch:
    inputs:
      target_date:
        description: 'JST race date YYYYMMDD'
        required: true
        type: string
      course_code:
        description: 'One venue code 1-24'
        required: true
        type: string
      race_no:
        description: 'One race number 1-12'
        required: true
        type: string
      approval_phrase:
        description: 'Enter APPROVED_PRIVATE_ONE_SHOT after concrete approval'
        required: true
        type: string

permissions:
  contents: read

jobs:
  unavailable-on-main:
    if: ${{ github.ref != 'refs/heads/main' && false }}
    runs-on: ubuntu-24.04
    steps:
      - run: echo 'This inert default-branch stub does not access BRDB.'
```

The Draft branch version additionally requires the exact ref `refs/heads/codex/dev1-openapi-offline-fix-20261118` and the approval phrase, and uses the protected environment. Check the branch ref in Actions before approval. A GitHub Environment reviewer must approve the run before secrets become available. The branch selected in the UI must be the Draft branch, not main.

Before applying even this inert main stub, verify branch protection, workflow syntax, and that GitHub dispatch loads the chosen branch version. Do not merge #306, trigger a live run, or alter production DB/Cron/Vercel. Separately approve the exact date/venue/race and maximum 6 provider HTTP POST requests before any live run. On completion, remove the main stub and revoke the test environment secrets after evidence is preserved, subject to user approval.
