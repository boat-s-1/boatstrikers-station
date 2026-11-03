import { STADIUMS } from "../../../stadiums.js";
import { AI_CATEGORIES, datasetFor, stadiumBySlug } from "../topics.mjs";
import { computeDataset, datasetSource, researchPeriod } from "./datasets.mjs";

// Research article (PHASE 1): the topic's dataset is read (read-only), checked race by race, aggregated and, only
// when the dataset passes its own gate, turned into the source pack. The AI then writes from these facts alone.

export function researchPlan(topic, { now = new Date() } = {}) {
  const category = AI_CATEGORIES[topic.category_slug];
  const spec = datasetFor(topic.category_slug, topic.angle);
  if (!category?.research || !spec) return null;
  const stadium = topic.stadium_slug ? stadiumBySlug(topic.stadium_slug) : null;
  if (category.perStadium && !stadium) throw Object.assign(new Error("場を確認してください。"), { status: 400 });
  const period = researchPeriod({ now, days: spec.days });
  const params = { scope_name: stadium ? stadium.name : "全国", ...(stadium ? { course_code: stadium.courseCode } : {}) };
  return { definition: spec.definition, period, params, stadium };
}

// readRows({ period, courseCode }) → { results, events, entries, genders } (data/reader.mjs).
export async function computeResearchDataset({ topic, readRows, now = new Date() }) {
  const plan = researchPlan(topic, { now });
  if (!plan) throw Object.assign(new Error("研究テーマではありません。"), { status: 400 });
  const rows = await readRows({ period: plan.period, courseCode: plan.params.course_code });
  return computeDataset({ definition: plan.definition, rows, period: plan.period, params: plan.params, now });
}

export function buildResearchPack({ topic, evidence, now = new Date() }) {
  const stadium = topic.stadium_slug ? stadiumBySlug(topic.stadium_slug) : null;
  const { source, facts } = datasetSource(evidence);
  return {
    version: 5, built_at: now.toISOString(), research: true,
    topic: { topic_key: topic.topic_key, category_slug: topic.category_slug, stadium_slug: topic.stadium_slug ?? null,
      angle: topic.angle, title_hint: topic.title_hint, character_key: topic.character_key ?? null },
    stadium: stadium ? { slug: stadium.slug, name: stadium.name, course_code: stadium.courseCode } : null,
    stadium_count: stadium ? 1 : STADIUMS.length,
    sources: [source], facts, documents: [], gaps: [], readings: [],
    // The full evidence (exclusions by reason, coverage, hash) is kept with the draft for the gates and for audit.
    datasets: [evidence],
  };
}
