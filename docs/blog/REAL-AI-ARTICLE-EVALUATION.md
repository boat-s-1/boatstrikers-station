# Article evaluation

The secure runner calls the existing research-pack composition, validation and seven gates without changing their thresholds. Each mock or future actual article is checked for data integrity, sources, duplicates, usefulness, SEO, copyright and safety.

Expected free-test result: 一果・初音・キイナ all PASS, each deliberately tampered number HOLD, each removed period not PASS. A real article may fail; do not weaken gates or regenerate it automatically. A failure stops the remaining calls.

The external `report.json` records status, approval ID, code digest, model, reserved JPY, attempted call count, known input/output tokens, duration, estimated actual JPY, and article results. Unknown or untrusted usage produces HOLD, retains reservations and does not include raw error payloads. If secret screening fails, report saving itself is refused. An absent report is not proof of zero spend: consult the persistent reservation ledger and provider usage through an authorized account workflow.

No article is published, saved to a DB, or sent to production by these scripts.
