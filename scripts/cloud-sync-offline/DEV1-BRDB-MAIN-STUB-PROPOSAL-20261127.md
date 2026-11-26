# Manual workflow activation record (2026-11-27 JST)

GitHub only shows `workflow_dispatch` for a workflow whose file exists on the default branch. Draft #306 has the executable `.github/workflows/dev1-brdb-private-one-shot.yml`. The approved inert entry was added on main in commit `4f064c26f92b389a54349b59a38587c947d1c3cc`; the Draft branch gained a no-secret `DRY_RUN_ONLY` preflight in commit `778ba9c2bd70e9b103360bfecfaeb14d0511043d`. The entry below documents the main-side concept; the actual deployed input description also accepts `DRY_RUN_ONLY`. No provider call has been run. This changes GitHub Actions discovery only; it contains no secrets and no provider HTTP call.

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

Next dispatch the Draft branch with `approval_phrase=DRY_RUN_ONLY`, `target_date=20261127`, `course_code=1`, `race_no=1`; these three coordinates are inert in the preflight. Confirm the `no-secret-preflight` job succeeds and `private-trial` is skipped. This verifies selected-branch execution without checkout, Secrets, or provider calls. GitHub dispatch has not yet been performed because the connector lacks dispatch capability. Do not merge #306, trigger a live run, or alter production DB/Cron/Vercel. Separately approve the exact date/venue/race and maximum 6 provider HTTP POST requests before any live run. After concrete approval, a separate run with the live phrase, exact target coordinates, and maximum 6 provider POST calls can be considered. The current trial validates feed connectivity and one race in memory; it does not yet save or show real data on the admin page. On completion, remove the main stub and revoke test environment secrets after evidence is preserved, subject to user approval.
