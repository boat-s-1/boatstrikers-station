import { MODEL, stagesFor, executionMode, estimate, assertSafe, hold } from './verification-budget.mjs';

export function createGuardedTransport({ plan, apiKey, runId, confirm, fetchImpl, onRecord = () => {}, timeoutMs = 90000, approvalExpiresAt = Infinity, now = Date.now }) {
  let calls = 0, stopped = false, inFlight = false;
  const stages = stagesFor(plan);
  const secrets = [apiKey];
  const request = async (url, init) => {
    if (stopped) hold('RUN_STOPPED');
    if (calls >= stages.length) { stopped = true; hold('CALL_LIMIT'); }
    if (inFlight) { stopped = true; hold('CONCURRENT_CALL'); }
    inFlight = true;
    try {
      if (!apiKey || typeof fetchImpl !== 'function') hold('TRANSPORT_REQUIRED');
      if (now() >= approvalExpiresAt) hold('APPROVAL_EXPIRED');
      if (url !== 'https://api.openai.com/v1/responses' || init.method !== 'POST' || init.headers.Authorization !== `Bearer ${apiKey}`) hold('DESTINATION');
      const body = JSON.parse(init.body), stage = stages[calls];
      const outputLimit = stage === 'smoke' ? 1000 : plan.articleOutputTokens;
      if (body.store !== false) hold('STORE_FALSE_REQUIRED');
      if (body.model !== MODEL || body.max_output_tokens !== outputLimit || body.text?.format?.name !== (stage === 'smoke' ? 'smoke' : 'boatstrikers_blog_article')) hold('REQUEST_PLAN');
      // Omission means auto in the API; force standard pricing, never the project default.
      if (body.service_tier !== undefined && body.service_tier !== 'default') hold('REQUEST_SERVICE_TIER');
      body.service_tier = 'default';
      const requestBody = JSON.stringify(body);
      assertSafe(requestBody, secrets);
      // Conservative upper bound: UTF-8 bytes of the WHOLE request plus framing allowance.
      // API-reported input above this approved cap freezes the run; no cheaper guessed tokenizer is used.
      if (Buffer.byteLength(requestBody, 'utf8') + 4096 > plan.inputTokens) hold('INPUT_RESERVATION');
      const phrase = `CONFIRM ${runId} MODE=${executionMode(plan)} ${stage} MODEL=${MODEL} STORE=false RESERVED=${estimate(plan, stage)}JPY`;
      if (typeof confirm !== 'function' || await confirm(phrase) !== phrase) hold('STAGE_CANCELLED');
      if (stopped || now() >= approvalExpiresAt) hold('APPROVAL_EXPIRED_OR_STOPPED');
      calls++;
      const start = Date.now();
      const timeout = AbortSignal.timeout(Math.min(timeoutMs, stage === 'smoke' ? 30000 : 90000));
      const signal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
      let listener;
      try {
        const aborted = new Promise((_, reject) => {
          listener = () => reject(new Error('HOLD:TIMEOUT_OR_ABORT'));
          if (signal.aborted) listener(); else signal.addEventListener('abort', listener, { once: true });
        });
        const response = await Promise.race([fetchImpl(url, { ...init, body: requestBody, signal, redirect: 'error' }), aborted]);
        if (!response.ok) hold('API_ERROR');
        const payload = await Promise.race([response.json(), aborted]);
        assertSafe(payload, secrets);
        if (payload.status !== 'completed' || payload.model !== MODEL) hold('INCOMPLETE_OR_MODEL_MISMATCH');
        // The response reports actual routing, which may differ from the request.
        if (payload.service_tier !== 'default') hold('RESPONSE_SERVICE_TIER');
        const u = payload.usage;
        if (!u || !['input_tokens','output_tokens','total_tokens'].every(k => Number.isSafeInteger(u[k]) && u[k] > 0) || u.total_tokens !== u.input_tokens + u.output_tokens) hold('USAGE_UNKNOWN');
        if (u.input_tokens > plan.inputTokens || u.output_tokens > outputLimit) hold('USAGE_OVER_RESERVATION');
        const actualYen = (u.input_tokens * plan.inputUsdPerMillion + u.output_tokens * plan.outputUsdPerMillion) / 1e6 * plan.usdJpy;
        if (!Number.isFinite(actualYen) || actualYen > estimate(plan, stage)) hold('COST_OVER_RESERVATION');
        onRecord({ stage, serviceTier: payload.service_tier, inputTokens: u.input_tokens, outputTokens: u.output_tokens, totalTokens: u.total_tokens, durationMs: Date.now() - start, actualYen, reservedYen: estimate(plan, stage) });
        return new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json' } });
      } finally { if (listener) signal.removeEventListener('abort', listener); }
    } catch { stopped = true; hold('TRANSPORT_STOPPED'); }
    finally { inFlight = false; }
  };
  return { fetch: request, get calls() { return calls; }, get stopped() { return stopped; } };
}
