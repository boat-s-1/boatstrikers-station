# Approval plan (not approved for execution)

Order: smoke → 一果 (ichika) → 初音 (hatsune) → キイナ (kiina). Use only the fixed, existing `tests/blog/fixtures/real-data/cases.json`. No DB, Supabase, Cron, Vercel or GitHub write is involved. Every stage is optional to continue: any cancellation ends the whole run, with no retry.

Copy this template to a file **outside all Git repositories**. The null fields deliberately force HOLD. No secret belongs in this file. Determine official prices for `gpt-6.1-terra`, the USD/JPY reference, verification time, a conservative input cap, and a unique output directory before requesting approval.

```json
{
  "model": "gpt-6.1-terra",
  "budgetYen": 1000,
  "limitYen": 700,
  "margin": 0.2,
  "inputTokens": 100000,
  "articleOutputTokens": 12000,
  "inputUsdPerMillion": null,
  "outputUsdPerMillion": null,
  "usdJpy": null,
  "pricingSource": "https://openai.com/api/pricing/",
  "fxSource": "https://www.boj.or.jp/statistics/market/forex/fxdaily/index.htm",
  "ratesVerifiedAt": null,
  "output": "/workspace/boatstrikers-ai-results/CHOOSE-A-NEW-RUN",
  "stateDir": "/workspace/boatstrikers-ai-verification-state",
  "maxCalls": 4
}
```

Maximum configured output: 37,000 tokens. Maximum reserved input: four times inputTokens. The operating reservation is the higher conservative bound, not a prediction that all tokens will be used. The same shared stateDir must be retained across new approvals; a new output directory alone does not reset the budget. New approval is not authorization to exceed the remaining persistent budget.
