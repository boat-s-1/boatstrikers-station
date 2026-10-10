import { STADIUM_BASIC_GUIDES } from "../../stadiumBasicGuide24.js";
import { STADIUMS } from "../../stadiums.js";
import { AI_CATEGORIES, stadiumBySlug } from "./topics.mjs";
import { isStadiumDataUrl, parseStadiumDataPage, withoutTableCells, formatPeriod } from "./officialStadiumData.mjs";
import { courseReadings } from "./dataReadings.mjs";

const DOC_EXCERPT = 6000;
const MAX_DOCS = 3;

// Repository dataset: BOAT RACE official stadium data, aggregated for a fixed period and stored in
// lib/stadiumBasicGuide24.js. Its retrieval time is not recorded in the file, so fetched_at stays null
// and the validator warns the reviewer; the period is always shown. The label says it is BoatStrikers' copy,
// so it is never mistaken for the page fetched on the day.
// When the fetched page replaces its aggregated numbers, the copy only supplies undated basics and carries no period.
// Its link is BoatStrikers' own stadium page, which shows these same values: the official page shows newer
// numbers (and not the race time slot), so it would not back what the copy says. The official page it was taken
// from is kept as official_url for the record.
function guideSource(guide, id, aggregated = true) {
  const base = { id, kind: "repository_dataset", url: `/races/${String(guide.courseCode).padStart(2, "0")}/info`, official_url: guide.officialUrl,
    fetched_at: null, recorded_in: "lib/stadiumBasicGuide24.js" };
  return aggregated
    ? { ...base, label: `BoatStrikers収録データ（BOAT RACE公式・${guide.name}・${guide.periodFrom}〜${guide.periodTo}集計）`, period: `${guide.periodFrom}〜${guide.periodTo}` }
    : { ...base, label: `BoatStrikers収録データ（${guide.name}の基本情報）` };
}

// "（常滑の基本情報）" → "（常滑の基本情報：レース時間帯）": which facts the undated copy still supplies.
function labelWithFacts(source, facts, stadiumName) {
  const topics = facts.filter(f => f.source_id === source.id).map(f => f.label.replace(`${stadiumName}の`, ""));
  if (source.period || !topics.length) return;
  source.label = source.label.replace(/）$/, `：${topics.join("・")}）`);
}

// official: the stadium data page fetched on the day, when its table was read (see officialStadiumData.mjs).
// Its numbers replace the repository's course rates, whatever their periods: the newest fetched data wins and
// the two are never mixed. Memo values (水質・干満差) replace the repository's when the page states them.
// The race time slot (デイ・ナイター…) is recorded only in the repository copy, with no date it was checked on, and no
// fetched page states it. It is offered only to the theme about the water and the day (angle "water"), where the
// reviewer is asked to confirm it; course-rate articles do without it.
const RACE_TIME_ANGLES = new Set(["water"]);
function guideFacts(guide, sourceId, next, official, topic) {
  const facts = RACE_TIME_ANGLES.has(topic.angle) ? [[`${guide.name}のレース時間帯`, guide.raceType, ""]] : [];
  if (!official?.memo.waterType) facts.push([`${guide.name}の水質`, guide.waterType, ""]);
  if (!official?.memo.tide) facts.push([`${guide.name}の干満差`, guide.tide, ""]);
  if (!official) facts.push(...guide.courseWinRates.map((rate, i) => [`${guide.name}の${i + 1}コース1着率`, String(rate), "%"]));
  return facts.map(([label, value, unit]) => ({ id: next(), source_id: sourceId, label, value, unit }));
}

// Only the 1着率 per course becomes a fact (the figure articles use). The other placements stay in the pack's
// official record: as facts their values would coincide with unrelated figures and let them pass as evidence.
function officialFacts(stadium, parsed, sourceId, next) {
  const period = formatPeriod(parsed.recent.period);
  const facts = parsed.recent.rows.map(row =>
    ({ id: next(), source_id: sourceId, label: `${stadium.name}の${row.course}コース1着率`, value: row.rates[0], unit: "%", period }));
  if (parsed.memo.waterType) facts.push({ id: next(), source_id: sourceId, label: `${stadium.name}の水質`, value: parsed.memo.waterType, unit: "" });
  if (parsed.memo.tide) facts.push({ id: next(), source_id: sourceId, label: `${stadium.name}の干満差`, value: parsed.memo.tide, unit: "" });
  return facts;
}

// documents: rows of blog_source_documents (newest first). Only successful fetches are used.
export function buildSourcePack({ topic, documents = [], now = () => new Date() }) {
  const category = AI_CATEGORIES[topic.category_slug];
  if (!category) throw Object.assign(new Error("カテゴリーを確認してください。"), { status: 400 });
  let s = 0, f = 0;
  const nextSource = () => `S${++s}`, nextFact = () => `F${++f}`;
  const sources = [], facts = [], docs = [], gaps = [], conflicts = [];
  const stadium = topic.stadium_slug ? stadiumBySlug(topic.stadium_slug) : null;
  if (category.perStadium && !stadium) throw Object.assign(new Error("場を確認してください。"), { status: 400 });
  const usesData = topic.category_slug !== "stadium-charm";

  const seen = new Set(), picked = [];
  for (const d of documents) {
    if (picked.length >= MAX_DOCS) break;
    if (d.fetch_error || !d.extracted_text || seen.has(d.url) || (stadium && d.stadium_slug !== stadium.slug)) continue;
    seen.add(d.url);
    picked.push(d);
  }
  // The newest successful fetch of the stadium's official data page (documents are newest first).
  const page = picked.find(d => isStadiumDataUrl(d.url, stadium));
  const parsed = page ? parseStadiumDataPage(page.extracted_text, stadium) : null;
  const official = parsed?.ok ? parsed : null;

  const guides = stadium ? STADIUM_BASIC_GUIDES.filter(g => g.slug === stadium.slug) : STADIUM_BASIC_GUIDES;
  if (usesData) for (const guide of guides) {
    const source = guideSource(guide, nextSource(), !official);
    const supplied = guideFacts(guide, source.id, nextFact, official, topic);
    // A copy that supplies nothing is not a source of the article (its id is left unused, so the others keep theirs).
    if (supplied.length) { sources.push(source); facts.push(...supplied); }
    if (official) for (const [label, key] of [["水質", "waterType"], ["干満差", "tide"]]) {
      if (official.memo[key] && official.memo[key] !== guide[key]) conflicts.push({ label: `${guide.name}の${label}`, repository: guide[key], official: official.memo[key] });
    }
  }

  let officialInfo = null;
  for (const d of picked) {
    const source = { id: nextSource(), kind: d.kind, label: d.title ? `${d.title}` : d.url, url: d.url, fetched_at: d.fetched_at, content_sha256: d.content_sha256 };
    sources.push(source);
    if (d === page) {
      // Readers see which stadium's page it is; the page's own title is kept for the record.
      source.page_title = source.label;
      source.label = `BOAT RACE公式 ボートレース場データ（${stadium.name}）`;
      if (official) {
        source.tables = [official.recent, ...official.seasons].map(t => ({ label: t.label, period: formatPeriod(t.period) }));
        if (usesData) facts.push(...officialFacts(stadium, official, source.id, nextFact));
        officialInfo = { source_id: source.id, status: "parsed", period: formatPeriod(official.recent.period), skipped: official.skipped,
          placements: official.recent.rows.map(row => ({ course: row.course, rates: row.rates })) };
      } else {
        source.parse_error = parsed.reason;
        officialInfo = { source_id: source.id, status: "unreadable", reason: parsed.reason };
        if (usesData) gaps.push("official_table_unreadable");
      }
      docs.push({ source_id: source.id, title: d.title || "", excerpt: withoutTableCells(d.extracted_text).slice(0, DOC_EXCERPT) });
    } else {
      docs.push({ source_id: source.id, title: d.title || "", excerpt: d.extracted_text.slice(0, DOC_EXCERPT) });
    }
  }
  if (stadium) for (const source of sources) if (source.kind === "repository_dataset") labelWithFacts(source, facts, stadium.name);
  if (conflicts.length) gaps.push("repository_data_conflict");
  if (category.requiresDocuments && !docs.length) gaps.push("official_documents_missing");
  if (docs.length && topic.category_slug === "stadium-charm" && topic.angle === "gourmet" && !docs.some(d => /グルメ|食|メニュー|売店|レストラン/.test(d.excerpt))) gaps.push("gourmet_information_not_found");

  return {
    // 3: blog-ai-v7 structure (lead, glossary, DATA CHECK reasons); the checks of that structure apply from here on.
    version: 3, built_at: now().toISOString(),
    topic: { topic_key: topic.topic_key, category_slug: topic.category_slug, stadium_slug: topic.stadium_slug ?? null,
      angle: topic.angle, title_hint: topic.title_hint, character_key: topic.character_key ?? null },
    stadium: stadium ? { slug: stadium.slug, name: stadium.name, course_code: stadium.courseCode } : null,
    stadium_count: stadium ? 1 : STADIUMS.length,
    sources, facts, documents: docs, gaps, readings: courseReadings(facts),
    ...(officialInfo ? { official: officialInfo } : {}), ...(conflicts.length ? { conflicts } : {}),
  };
}
