// PHASE 2: research-article gate check on REAL race data with MOCK AI answers (no OpenAI call).
// For each case: real rows (export) → computeDataset → source pack → mock AI answer → compose → validate → 7 gates,
// then the same answer with one number changed (must be HOLD) and with the period removed (must not PASS).
//   node scripts/blog/verify-real-articles.mjs <cases.json>
// cases.json: [{ name, character, export, definition, period:{from,to}, params:{scope_name,course_code?}, topic:{...}, mock }]
// "mock" is a path to a mock AI answer (tests/blog/fixtures/mock-ai/*.json). Results are printed as JSON lines.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { computeDataset } from "../../lib/blog/ai/data/datasets.mjs";
import { buildResearchPack } from "../../lib/blog/ai/data/researchPack.mjs";
import { composeDocument } from "../../lib/blog/ai/compose.mjs";
import { validateAiDocument } from "../../lib/blog/ai/validate.mjs";
import { runQualityGates } from "../../lib/blog/ai/gates.mjs";
import { duplicateFindings, articleText } from "../../lib/blog/ai/duplicates.mjs";
import { decodeExport } from "./verify-real-data.mjs";

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

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) {
  const file = resolve(process.argv[2]);
  const cases = JSON.parse(readFileSync(file, "utf8"));
  const base = dirname(file);
  const done = [];
  let ok = true;
  for (const c of cases) {
    const rows = decodeExport(JSON.parse(readFileSync(resolve(base, c.export), "utf8")));
    const ai = JSON.parse(readFileSync(resolve(base, c.mock), "utf8"));
    const others = done.map(d => ({ post_id: d.name, title: d.document.title, text: articleText(d.document) }));
    const r = evaluate({ c, rows, ai, others });
    // Tampered: the first figure of the dataset written one higher somewhere in the body.
    const tampered = structuredClone(ai);
    const fact = r.pack.facts.find(f => /率$/.test(f.label));
    const json = JSON.stringify(tampered.sections).replace(`${fact.value}%`, `${(Number(fact.value) + 1).toFixed(1)}%`);
    tampered.sections = JSON.parse(json);
    const t = evaluate({ c, rows, ai: tampered, others });
    // Period removed from the text.
    const noPeriod = JSON.parse(JSON.stringify(ai).replaceAll(r.pack.sources[0].period, "この期間"));
    const p = evaluate({ c, rows, ai: noPeriod, others });
    const line = { name: c.name, character: c.character, mock_ai: true, dataset: { definition: c.definition, period: c.period, population: r.evidence.population, usable: r.evidence.usable, coverage: r.evidence.coverage, excluded: r.evidence.excluded, metrics: r.evidence.metrics },
      verdict: r.result.verdict, gates: summary(r), scorecard: r.result.scorecard,
      tampered: { changed: json !== JSON.stringify(ai.sections), verdict: t.result.verdict, data_integrity: t.result.gates.data_integrity.verdict },
      period_removed: { verdict: p.result.verdict, usefulness: p.result.gates.usefulness.verdict } };
    console.log(JSON.stringify(line));
    if (r.result.verdict !== "PASS" || !line.tampered.changed || t.result.verdict !== "HOLD" || p.result.verdict === "PASS") ok = false;
    done.push({ name: c.name, document: r.document });
  }
  process.exit(ok ? 0 : 1);
}
