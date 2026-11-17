# Agent Controller — synthetic signed receipt boundary (2026-11-17)

Added a pure-function HMAC-SHA256 verifier for **synthetic receipt envelopes** and 12 offline tests. It checks exact signature format, constant-time digest comparison, bounded payload, JSON structure, expected incident ID, receipt ID, delivered status, and timestamp freshness. All outcomes have `sendAllowed:false` and `writeAllowed:false`; successful verification is only eligible for further offline review.

**Important: not a real provider authentication integration.** This HMAC envelope is a local test contract, not a claim about any provider's webhook signing format. It has no replay nonce store, no secret rotation/key ID, no canonicalization policy, no provider account binding, no TLS endpoint, no authenticated operator, and no atomic DB persistence. Timestamp freshness alone does not prevent replay. `authenticated:true` means the supplied HMAC key matched the supplied bytes, not that the actual provider has been verified. A real provider adapter must follow that provider's published protocol and independently enforce receipt replay uniqueness before production use.

No real secret, network call, delivery or production write. Release HOLD.
