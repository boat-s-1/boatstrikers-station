# Approval plan (not approved for execution)

Order: smoke → 一果 (ichika) → 初音 (hatsune) → キイナ (kiina). Use only the fixed, existing `tests/blog/fixtures/real-data/cases.json`. No DB, Supabase, Cron, Vercel or GitHub write is involved. Every stage is optional to continue: any cancellation ends the whole run, with no retry.

Copy this template to a file **outside all Git repositories** only in a later authorized preparation step. The null verification timestamp deliberately forces HOLD. No secret belongs in this file. Rates below reflect the user's supplied official-model reference; the public model page was not independently retrievable in this environment (proxy 403). USD/JPY 170 is the user's fixed budgeting assumption, not a verified BOJ market quote. The FX link is a reference only. Record accurate provenance and verification time before requesting approval.

```json
{
  "model": "gpt-6.1-terra",
  "budgetYen": 1000,
  "limitYen": 700,
  "margin": 0.2,
  "inputTokens": 100000,
  "articleOutputTokens": 12000,
  "inputUsdPerMillion": 1,
  "outputUsdPerMillion": 5,
  "usdJpy": 170,
  "pricingSource": "https://developers.openai.com/api/docs/models/gpt-6.1-terra",
  "fxSource": "https://www.boj.or.jp/statistics/market/forex/fxdaily/index.htm",
  "ratesVerifiedAt": null,
  "output": "/workspace/boatstrikers-ai-results/CHOOSE-A-NEW-RUN",
  "stateDir": "/workspace/boatstrikers-ai-verification-state",
  "maxCalls": 4
}
```

Maximum configured output: 37,000 tokens. Maximum reserved input: four times inputTokens. The operating reservation is the higher conservative bound, not a prediction that all tokens will be used. The same shared stateDir must be retained across new approvals; a new output directory alone does not reset the budget. New approval is not authorization to exceed the remaining persistent budget.

Standard processing is forced as `service_tier: "default"`; the actual response must also report `default`. User-supplied standard prices: input $1.00, output $5.00, cached input $0.05 per million tokens. Cached-input discount is deliberately not used in reservations or usage-based upper cost estimates; no unsupported cached-price field should be added to this plan. Output bounds include reasoning tokens, not a separate additional reasoning allowance.

At 170 JPY/USD and 20% margin, smoke reserves 21.42 JPY and each article reserves 32.64 JPY; all four reserve 119.34 JPY (99.45 JPY before margin). A fresh 700 JPY local pool would retain 580.66 JPY; prior reservations still count. A non-default/missing response tier stops without recording an unjustified standard-cost estimate, and its full reservation is retained. A request may already have incurred cost before the mismatched response is detected; never retry it automatically or infer that the provider charged the reserved rate.
