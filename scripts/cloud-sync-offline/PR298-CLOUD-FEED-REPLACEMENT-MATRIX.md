# PR298 — Cloud feed replacement matrix (initial audit)

**Status: assessment only; no source declared production-ready.** Confirm every
row against current production consumers before Windows retirement.

| Data family | Known existing path | Cloud replacement candidate | Remaining evidence | Decision |
|---|---|---|---|---|
| Today's race program / 6 boats | Windows v7 program; production OpenAPI Cron currently omits bootstrap | Atomic OpenAPI candidate including bootstrap | Official schedule parity, provider rights, live payload, production schema | HOLD |
| Race results / trifecta | Production OpenAPI result RPC already populates results | Keep existing result source, protect payout parity | Trigger effects, full schedule parity, overlap fencing | HOLD |
| Previews / start data | OpenAPI preview RPC updates existing entries only | Atomic candidate after program bootstrap | Actual field completeness and source priority | HOLD |
| Exhibition details | Windows/PC-KYOTEI and other feeds; incomplete currently | **No proven complete replacement** | Exact fields, provider terms, cadence, downstream consumers | HOLD |
| BRDB specialized fields | Team-Nave BRDB via Windows/BRDB-API | **No proven complete replacement** | Q009/Q011 compliance, data mapping, permissions | HOLD |
| TRINITY pre-race snapshots | Supabase snapshots + scheduled checks | Retain independent data provenance and time gating | No leakage from results, complete six-boat inputs | HOLD |
| Alerts / Discord / app notifications | Mixed consumers, potentially Windows-dependent | To be inventoried | Actual job owners, credentials, side effects | HOLD |
| Historical missing program 11/13–11/17 | Results exist, program missing | Archive-backed program-only repair candidate | Verified original archive and license, exact race-key allowlist | HOLD |

## Acceptance criteria per data family

1. Name the authoritative provider and permission to store/process/publish.
2. List required columns, schema and consumers. Do not treat a matching race
   count as field-level parity.
3. Compare production and candidate on a representative race-day sample.
4. Prove time semantics (pre-race vs post-race) and JST day rollover.
5. Prove replay, failure isolation, duplicate suppression and recovery.
6. Prove monitoring and rollback without dependence on a Windows machine.
7. Require separate sign-off before switching the production writer.

**No Windows service or scheduler may be disabled while a critical row remains
HOLD.** This matrix is intentionally conservative; it is not a claim that
Windows is currently required for every feature.
