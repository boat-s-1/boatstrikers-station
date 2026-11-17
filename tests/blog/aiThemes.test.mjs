import { test } from "node:test";
import assert from "node:assert/strict";
import { AI_CATEGORIES, RESEARCH_ROTATION, candidateTopics, datasetFor } from "../../lib/blog/ai/topics.mjs";
import { DATASETS } from "../../lib/blog/ai/data/datasets.mjs";
import { BLOG_CATEGORIES } from "../../lib/blog/catalogue.mjs";
import { PERSONAS } from "../../lib/blog/ai/personas.mjs";

test("the existing stadium themes are kept unchanged", () => {
  for (const slug of ["stadium-charm", "stadium-basics", "stadiums", "data-lab", "characters"]) assert.ok(AI_CATEGORIES[slug], slug);
  assert.equal(candidateTopics({ categorySlug: "stadium-basics" }).length, 24 * 3);
  assert.equal(AI_CATEGORIES["stadium-basics"].research, undefined);
});

test("each character leads research themes in their speciality, written from a defined dataset", () => {
  const byCharacter = { ichika: [], hatsune: [], kiina: [] };
  for (const [slug, c] of Object.entries(AI_CATEGORIES).filter(([, c]) => c.research)) {
    byCharacter[c.author].push(slug);
    for (const [angle] of c.angles) {
      const spec = datasetFor(slug, angle);
      assert.ok(spec && DATASETS[spec.definition], `${slug}:${angle}`);
      assert.equal(DATASETS[spec.definition].character, c.author, `${slug}:${angle} belongs to ${c.author}`);
      assert.ok(spec.days >= 7 && spec.days <= 731);
    }
  }
  assert.deepEqual(byCharacter, { ichika: ["inside-course", "beginner"], hatsune: ["women"], kiina: ["longshot"] });
  assert.deepEqual(RESEARCH_ROTATION.map(r => r.character), ["ichika", "hatsune", "kiina"]);
  for (const r of RESEARCH_ROTATION) for (const c of r.categories) assert.equal(AI_CATEGORIES[c].author, r.character);
  for (const key of ["ichika", "hatsune", "kiina"]) assert.ok(PERSONAS[key]);
});

test("research categories use category slugs that already exist in the BLOG catalogue (no new category rows)", () => {
  const known = new Set(BLOG_CATEGORIES.map(c => c.slug));
  for (const slug of Object.keys(AI_CATEGORIES).filter(s => AI_CATEGORIES[s].research)) assert.ok(known.has(slug), slug);
});

test("research candidates: one per stadium for stadium themes, one nationwide otherwise; keys are unique", () => {
  const longshot = candidateTopics({ categorySlug: "longshot" });
  assert.equal(longshot.length, 24 * 2);
  assert.ok(longshot.every(t => t.character_key === "kiina" && t.stadium_slug));
  const women = candidateTopics({ categorySlug: "women" });
  assert.deepEqual(women.map(t => [t.topic_key, t.stadium_slug, t.character_key]), [["women:all:women-escape-national-90", null, "hatsune"]]);
  const all = Object.keys(AI_CATEGORIES).flatMap(c => candidateTopics({ categorySlug: c }));
  assert.equal(new Set(all.map(t => t.topic_key)).size, all.length);
  assert.equal(candidateTopics({ categorySlug: "inside-course", existingKeys: ["inside-course:kiryu:escape-365"] }).some(t => t.stadium_slug === "kiryu"), false);
  assert.equal(datasetFor("stadium-basics", "water"), null);
});
