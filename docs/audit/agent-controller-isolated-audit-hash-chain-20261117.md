# Agent Controller — isolated DB audit hash-chain test (2026-11-17)

The disposable PostgreSQL workflow now runs a Node.js SHA-256 hash-chain test over ordered synthetic conflict-audit rows. The test verifies the original in-memory chain and rejects modified content, a missing middle record, and reordered records. The resulting tail digest is printed as CI evidence.

**Limitations:** This chain is computed in the CI process, not durably stored or independently anchored. An attacker who controls all rows and can recompute the chain can conceal tampering; an independently protected trusted tail/anchor and stable canonical encoding would be required. The database fixture and audit records are synthetic. No real provider authentication, production DB mutation or notification delivery. Release HOLD.
