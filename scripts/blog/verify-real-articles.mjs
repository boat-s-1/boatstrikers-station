// PHASE 2: research-article gate check on REAL race data with MOCK AI answers (no OpenAI call).
// For each case: real rows (export) → computeDataset → source pack → mock AI answer → compose → validate → 7 gates,
// then the same answer with one number changed (must be HOLD) and with the period removed (must not PASS).
//   node scripts/blog/verify-real-articles.mjs <cases.json>
// cases.json: [{ name, character, export, definition, period:{from,to}, params:{scope_name,course_code?}, topic:{...}, mock }]
// "mock" is a path to a mock AI answer (tests/blog/fixtures/mock-ai/*.json). Results are printed as JSON lines.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { computeDataset } from "../../lib/blog/ai/data/datasets.mjs";
import { buildResearchPack } from "../../lib/blog/ai/data/researchPack.mjs";
import { composeDocument } from "../../lib/blog/ai/compose.mjs";
import { validateAiDocument } from "../../lib/blog/ai/validate.mjs";
import { runQualityGates } from "../../lib/blog/ai/gates.mjs";
import { duplicateFindings, articleText } from "../../lib/blog/ai/duplicates.mjs";
import { decodeExport } from "./verify-real-data.mjs";
import { aiConfig } from "../../lib/blog/ai/config.mjs";
import { callOpenAIJson, estimateCostUsd } from "../../lib/blog/ai/openai.mjs";
import { ARTICLE_SCHEMA, buildInstructions, buildInput } from "../../lib/blog/ai/prompt.mjs";

const catalogue = { categoryId: "11111111-1111-4111-8111-111111111111", categoryName: "研究", authorIds: { ichika: "22222222-2222-4222-8222-222222222221", hatsune: "22222222-2222-4222-8222-222222222222", kiina: "22222222-2222-4222-8222-222222222223", editorial: "22222222-2222-4222-8222-222222222224" } };
const COVER = "33333333-3333-4333-8333-333333333333";

function evaluate({ c, rows, ai, others }) {
  const evidence = computeDataset({ definition: c.definition, rows, period: c.period, params: c.params, now: new Date(`${c.period.to}T20:00:00Z`) });
  if (evidence.status !== "ok") return { evidence, verdict: "DATA_HOLD" };
  const pack = buildResearchPack({ topic: c.topic, evidence, now: new Date() });
  const composed = composeDocument({ ai, pack, topic: c.topic, catalogue, coverMediaId: COVER, coverAlt: "表紙" });
  const validation = [...composed.issues, ...validateAiDocument({ document: composed.document, pack })];
  // The dataset is recomputed from the same real rows, as the gate does from the database.
  const recomputed = computeDataset({ definition: c.definition, rows, period: c.period, params: c.params, now: new Date() });
  const duplicates = duplicateFindings({ document: composed.document, dataset: evidence, existing: others });
  const result = runQualityGates({ document: composed.document, pack, validation, datasets: [{ stored: evidence, recomputed }], duplicates });
  return { evidence, pack, document: composed.document, result };
}

const summary = r => Object.fromEntries(Object.entries(r.result?.gates || {}).map(([k, g]) => [k, `${g.verdict}${g.issues.filter(i => i.verdict !== "NOTE").length ? ":" + g.issues.filter(i => i.verdict !== "NOTE").map(i => i.code).join(",") : ""}`]));

// --ai: the answer comes from the real OpenAI API instead of the mock file. ONE call per case, no retry, at most
// --max-calls calls in total (default 3), BLOG_AI_MAX_OUTPUT_TOKENS per call. Tokens, time and estimated cost are printed.
async function realAnswer({ c, rows, config, calls, fetchImpl = fetch }) {
  const evidence = computeDataset({ definition: c.definition, rows, period: c.period, params: c.params, now: new Date(`${c.period.to}T20:00:00Z`) });
  if (evidence.status !== "ok") return { skipped: "data_hold", evidence };
  const pack = buildResearchPack({ topic: c.topic, evidence, now: new Date() });
  let info = null;
  calls.count++;
  try {
    const { data } = await callOpenAIJson({ fetchImpl, apiKey: config.apiKey, model: config.model, maxOutputTokens: config.maxOutputTokens, instructions: buildInstructions(pack),
      input: buildInput(pack), schema: ARTICLE_SCHEMA, schemaName: "boatstrikers_blog_article", onUsage: i => { info = i; } });
    return { ai: data, info };
  } catch (error) {
    return { error: { kind: error.kind || "unknown", message: String(error.message) }, info };
  }
}

// Runs every case and returns one result object per case. log(line) is called for each (no key is ever in a line).
export async function runVerification({ casesFile, useAi = false, maxCalls = 3, config = aiConfig(), log = () => {}, fetchImpl = fetch }) {
  if (useAi && !config.apiKey) throw Object.assign(new Error("OPENAI_API_KEY が設定されていません。"), { exit: 2 });
  const calls = { count: 0 };
  const cases = JSON.parse(readFileSync(casesFile, "utf8"));
  const base = dirname(casesFile);
  const done = [], lines = [];
  let ok = true;
  const emit = line => { lines.push(line); log(line); };
  for (const c of cases) {
    const rows = decodeExport(JSON.parse(readFileSync(resolve(base, c.export), "utf8")));
    let ai, generation = null;
    if (useAi) {
      if (calls.count >= maxCalls) { emit({ name: c.name, character: c.character, skipped: "max_calls_reached" }); ok = false; continue; }
      const r = await realAnswer({ c, rows, config, calls, fetchImpl });
      generation = r.info ? { model: r.info.model, usage: r.info.usage, duration_ms: r.info.duration_ms, estimated_cost_usd: estimateCostUsd(r.info.usage, config.prices) } : null;
      if (r.skipped === "data_hold") { emit({ name: c.name, character: c.character, real_ai: true, verdict: "HOLD", reason: "data_quality", ai_called: false, dataset: { status: r.evidence.status, issues: r.evidence.issues.map(i => i.code) } }); continue; }
      if (!r.ai) { emit({ name: c.name, character: c.character, real_ai: true, ai_called: true, error: r.error, generation }); ok = false; continue; }
      ai = r.ai;
    } else ai = JSON.parse(readFileSync(resolve(base, c.mock), "utf8"));
    const others = done.map(d => ({ post_id: d.name, title: d.document.title, text: articleText(d.document) }));
    const r = evaluate({ c, rows, ai, others });
    if (!r.result) { emit({ name: c.name, character: c.character, verdict: "HOLD", reason: "data_quality", ai_called: false }); continue; }
    // Tampered: the dataset's rate written one higher; when the text does not state the rate, the race count instead.
    const fact = r.pack.facts.find(f => /率$/.test(f.label));
    let json = JSON.stringify(ai.sections).replace(`${fact.value}%`, `${(Number(fact.value) + 1).toFixed(1)}%`);
    if (json === JSON.stringify(ai.sections)) json = JSON.stringify(ai.sections).replace(`${r.evidence.usable}レース`, `${r.evidence.usable + 1}レース`);
    const t = evaluate({ c, rows, ai: { ...ai, sections: JSON.parse(json) }, others });
    // Period removed from the text.
    const noPeriod = JSON.parse(JSON.stringify(ai).replaceAll(r.pack.sources[0].period, "この期間"));
    const p = evaluate({ c, rows, ai: noPeriod, others });
    const line = { name: c.name, character: c.character, mock_ai: !useAi, real_ai: useAi, ai_called: useAi, generation, title: r.document.title,
      dataset: { definition: c.definition, period: c.period, population: r.evidence.population, usable: r.evidence.usable, coverage: r.evidence.coverage, excluded: r.evidence.excluded, metrics: r.evidence.metrics },
      verdict: r.result.verdict, reason: r.result.reason, gates: summary(r), scorecard: r.result.scorecard,
      tampered: { changed: json !== JSON.stringify(ai.sections), verdict: t.result.verdict, data_integrity: t.result.gates.data_integrity.verdict },
      period_removed: { verdict: p.result.verdict, usefulness: p.result.gates.usefulness.verdict },
      document: useAi ? r.document : undefined };
    emit(line);
    // With a real AI answer, RETRY/HOLD are results to report, not script failures; the safety checks must still hold.
    if ((!useAi && r.result.verdict !== "PASS") || (line.tampered.changed && t.result.verdict !== "HOLD") || p.result.verdict === "PASS") ok = false;
    done.push({ name: c.name, document: r.document });
  }
  return { ok, calls: calls.count, lines };
}

// Run directly (works with Windows paths too).
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const useAi = process.argv.includes("--ai");
  const maxCalls = Number(process.argv[process.argv.indexOf("--max-calls") + 1]) || 3;
  try {
    const { ok } = await runVerification({ casesFile: resolve(process.argv[2]), useAi, maxCalls,
      log: line => console.log(JSON.stringify({ ...line, document: undefined })) });
    process.exit(ok ? 0 : 1);
  } catch (error) { console.error(error.message); process.exit(error.exit ?? 1); }
}
