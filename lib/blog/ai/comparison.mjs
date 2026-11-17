import { PROMPT_VERSION } from "./config.mjs";
import { topicSlug } from "./topics.mjs";

// Comparison drafts: a second AI draft of a theme that already has one, made with the current prompt so the two
// versions can be compared (e.g. blog-ai-v4 and blog-ai-v5). The original post, its topic, approvals and sources
// are never changed.
//
// A comparison draft is marked in its source pack (pack.comparison), which is written once when the draft is
// generated and never edited. While marked it can be neither approved nor published or scheduled:
// - validateAiDocument reports a blocking "comparison_draft" issue, so approveDraft refuses and the stored
//   blocking_issues stays above zero, which the database's blog_ai_approve refuses too;
// - without an approval the database's blog_release refuses publication and scheduling of an AI draft;
// - the approve and release routes also refuse it before reaching the database, with a readable message.
// Adopting a comparison draft as the article would need its own explicit action (not implemented).

export const COMPARISON_MESSAGE = "比較用に再生成した下書きです。承認・公開・予約公開はできません（正式に採用するには、別途の採用操作が必要です）。";

export const comparisonOf = draftOrPack => (draftOrPack?.source_pack ?? draftOrPack)?.comparison ?? null;

// "stadium-basics-tokoname-course" + blog-ai-v5 → "stadium-basics-tokoname-course-v5".
export function comparisonSlug(topic, promptVersion = PROMPT_VERSION) {
  const version = String(promptVersion).replace(/^blog-ai-/, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${topicSlug(topic)}-${version}`;
}

export function comparisonIssue(pack) {
  const of = comparisonOf(pack);
  return of ? { level: "blocking", code: "comparison_draft", message: `${COMPARISON_MESSAGE}元記事：/${of.of_slug}（${of.of_prompt_version ?? "版不明"}）。` } : null;
}

// Server-side refusal used by the approve and release routes (the database refuses as well).
export async function assertNotComparison({ store, postId, action }) {
  const draft = await store.aiDraft(postId);
  if (comparisonOf(draft)) throw Object.assign(new Error(`${COMPARISON_MESSAGE}（${action}）`), { status: 409 });
}
