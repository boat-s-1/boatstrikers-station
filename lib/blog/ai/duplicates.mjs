import { similarity as titleSimilarity } from "./topics.mjs";

// Duplicate checks against past articles (PHASE 1). Three independent signals:
//   1. title: character-bigram Dice similarity (the existing check, topics.mjs).
//   2. theme: the same dataset definition and scope with an overlapping period — the same research done again.
//   3. body: character-trigram cosine similarity of the article text — catches reused wording under a new title.
// None of these is a true semantic (meaning) comparison; an embedding-based check is a later phase. The thresholds
// were set from the staging drafts (tests/blog/aiDuplicates.test.mjs): the same theme rewritten scored 0.90–0.92
// body similarity, the same template for another stadium 0.79–0.82. 0.86 holds the first; 0.75 warns on the second
// (template repetition), without stopping a genuinely different stadium.
export const DUPLICATE_THRESHOLDS = { titleHold: 0.8, titleWarn: 0.6, bodyHold: 0.86, bodyWarn: 0.75, themeOverlap: 0.5, themeLookbackDays: 180 };

const norm = text => String(text || "").normalize("NFKC").toLowerCase().replace(/[\s「」『』（）()【】・、。！？!?:：|｜\-—〜~]/g, "");

function trigrams(text) {
  const s = norm(text), out = new Map();
  for (let i = 0; i < s.length - 2; i++) { const g = s.slice(i, i + 3); out.set(g, (out.get(g) || 0) + 1); }
  return out;
}
export function bodySimilarity(a, b) {
  const x = trigrams(a), y = trigrams(b);
  let dot = 0, nx = 0, ny = 0;
  for (const [g, n] of x) { nx += n * n; dot += n * (y.get(g) || 0); }
  for (const n of y.values()) ny += n * n;
  return nx && ny ? dot / Math.sqrt(nx * ny) : 0;
}

// The text a reader reads (system notes/sources blocks excluded, so shared boilerplate does not count).
export function articleText(document) {
  const parts = [document.title, document.excerpt];
  for (const b of document.blocks || []) {
    if (b.data?.system) continue;
    if (b.type === "DIALOGUE_SCENE") parts.push(...(b.data.turns || []).map(t => t.text));
    else if (b.type === "LIST") parts.push(...(b.data.items || []));
    else if (b.type === "TABLE") parts.push(b.data.caption, ...(b.data.rows || []).flat());
    else parts.push(b.data?.text ?? b.data?.caption ?? "");
  }
  return parts.filter(Boolean).join("\n");
}

const days = (a, b) => (new Date(`${b}T00:00:00Z`) - new Date(`${a}T00:00:00Z`)) / 86400000 + 1;
export function periodOverlap(p, q) {
  const from = p.from > q.from ? p.from : q.from, to = p.to < q.to ? p.to : q.to;
  if (from > to) return 0;
  return days(from, to) / Math.min(days(p.from, p.to), days(q.from, q.to));
}

// dataset: { definition, params: { course_code }, period }; history: [{ post_id, title, dataset, created_at }].
export function themeDuplicates(dataset, history, { now = new Date(), thresholds = DUPLICATE_THRESHOLDS } = {}) {
  if (!dataset) return [];
  const since = now.getTime() - thresholds.themeLookbackDays * 86400000;
  return (history || []).filter(h => h.dataset && h.dataset.definition === dataset.definition
    && (h.dataset.params?.course_code ?? null) === (dataset.params?.course_code ?? null)
    && (!h.created_at || new Date(h.created_at).getTime() >= since)
    && periodOverlap(h.dataset.period, dataset.period) >= thresholds.themeOverlap)
    .map(h => ({ post_id: h.post_id, title: h.title, overlap: periodOverlap(h.dataset.period, dataset.period) }));
}

// existing: [{ post_id, title, text }]. Returns HOLD/warn findings; the caller excludes the post itself.
export function duplicateFindings({ document, dataset = null, existing = [], history = [], now = new Date(), thresholds = DUPLICATE_THRESHOLDS }) {
  const findings = [];
  const text = articleText(document);
  for (const post of existing) {
    const t = titleSimilarity(document.title, post.title);
    if (t >= thresholds.titleHold) findings.push({ level: "hold", code: "duplicate_title", score: t, post_id: post.post_id, message: `既存記事とタイトルがほぼ同じです（類似度${Math.round(t * 100)}%）：「${post.title}」` });
    else if (t >= thresholds.titleWarn) findings.push({ level: "warning", code: "similar_title", score: t, post_id: post.post_id, message: `既存記事とタイトルが似ています（類似度${Math.round(t * 100)}%）：「${post.title}」` });
    if (post.text) {
      const b = bodySimilarity(text, post.text);
      if (b >= thresholds.bodyHold) findings.push({ level: "hold", code: "duplicate_body", score: b, post_id: post.post_id, message: `既存記事と本文の大部分が同じです（類似度${Math.round(b * 100)}%）：「${post.title}」` });
      else if (b >= thresholds.bodyWarn) findings.push({ level: "warning", code: "similar_body", score: b, post_id: post.post_id, message: `既存記事と本文が似ています（類似度${Math.round(b * 100)}%）：「${post.title}」` });
    }
  }
  for (const d of themeDuplicates(dataset, history, { now, thresholds })) {
    findings.push({ level: "hold", code: "duplicate_theme", score: d.overlap, post_id: d.post_id, message: `同じ集計（同じ対象・重なる期間${Math.round(d.overlap * 100)}%）の記事がすでにあります：「${d.title ?? d.post_id}」` });
  }
  return findings;
}
