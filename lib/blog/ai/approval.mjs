import { createHash } from "node:crypto";
import { validateAiDocument, blockingCount } from "./validate.mjs";
import { withManualSources } from "./manualSources.mjs";
import { scorecard } from "./scorecard.mjs";
import { unknownSourceIds } from "../blockEdits.mjs";

// The admin login is a single shared cookie, so the approver is recorded as: typed name +
// a hash of the login session token + the login time contained in the token. The token itself is never stored.
export function approverSession(token) {
  const [rawTimestamp] = String(token || "").split(".");
  const seconds = Number(rawTimestamp);
  if (!token || !Number.isFinite(seconds)) throw Object.assign(new Error("管理者ログインが必要です。"), { status: 401 });
  return { hash: createHash("sha256").update(String(token)).digest("hex").slice(0, 32), loginAt: new Date(seconds * 1000).toISOString() };
}

export function approverName(value) {
  const name = String(value ?? "").normalize("NFKC").replace(/\s+/g, " ").trim();
  if (!name || name.length > 80 || /[\u0000-\u001f<>]/.test(name)) throw Object.assign(new Error("承認者名（80文字以内）を入力してください。"), { status: 400 });
  return name;
}

// Notes made when the draft was generated that the validator cannot recompute (AI's own "needs check" list,
// automatic citations, cover and similar-title notes). All are warnings; they are kept next to every new check.
const GENERATION_NOTES = new Set(["needs_check", "auto_cited", "cover_failed", "cover_not_stored", "similar_title"]);
const generationNotes = draft => (draft.validation || []).filter(i => GENERATION_NOTES.has(i.code) && i.level !== "blocking");

// Re-validates the exact version being approved, then asks the DB to record the approval.
// The DB rejects approval if the version moved or blocking issues remain.
export async function approveDraft({ repo, store, postId, version, name, session }) {
  const draft = await store.aiDraft(postId);
  if (!draft) throw Object.assign(new Error("AI下書きではありません。"), { status: 404 });
  const editor = await repo.editor(postId);
  if (editor.version !== version) throw Object.assign(new Error("承認しようとした版より新しい保存があります。画面を再読み込みしてください。"), { status: 409 });
  const pack = withManualSources(draft.source_pack, await store.manualSources(postId));
  const issues = validateAiDocument({ document: editor.document, pack });
  await store.recordValidation(postId, [...issues, ...generationNotes(draft)], editor.version);
  if (blockingCount(issues)) return { approved: false, issues };
  const result = await store.approve(postId, version, approverName(name), session);
  return { approved: true, approval: result, issues };
}

// Status shown in the editor: is the current editing version approved? The saved document is checked again on
// every request, so citations and figures edited in the editor are re-verified against the article's sources.
export async function draftStatus({ repo, store, postId }) {
  const draft = await store.aiDraft(postId);
  if (!draft) return { ai: false };
  const [editor, approval, manual] = await Promise.all([repo.editor(postId), store.latestApproval(postId), store.manualSources(postId)]);
  const sameVersion = Boolean(approval && approval.edit_version === editor.version && approval.revision_id === editor.revision_id);
  // Also compare content, exactly as blog_release does, so the screen never shows "approved" for changed content.
  const sameContent = sameVersion && (!approval.document_md5 || !store.documentMd5 || await store.documentMd5(postId) === approval.document_md5);
  const approvedCurrent = Boolean(sameVersion && sameContent);
  const pack = withManualSources(draft.source_pack, manual);
  const live = validateAiDocument({ document: editor.document, pack });
  const notes = generationNotes(draft).map(i => ({ ...i, origin: "generation" }));
  return { ai: true, status: draft.status, version: editor.version, approved_current: approvedCurrent,
    approval: approval ? { name: approval.approver_name, at: approval.created_at, version: approval.edit_version } : null,
    validation: [...live, ...notes], checked_version: editor.version, live_blocking: blockingCount(live),
    // Reference for the reviewer only; approval depends on live_blocking alone.
    scorecard: scorecard({ document: editor.document, pack, issues: live }),
    validated_version: draft.validated_version, blocking_issues: draft.blocking_issues,
    model: draft.model, generated_at: draft.generated_at,
    sources: (pack.sources || []).map(s => ({ id: s.id, label: s.label, url: s.url, fetched_at: s.fetched_at, period: s.period ?? null, kind: s.kind, registered_by: s.registered_by ?? null })) };
}

// Refuses to save an AI draft whose blocks cite ids that are not registered for it (its pack plus manual sources),
// so an unregistered id can neither be chosen in the editor nor stored through the API. Posts without an AI draft
// (and documents without source_ids) are saved exactly as before.
export async function assertRegisteredCitations({ store, postId, document }) {
  if (!(document?.blocks || []).some(b => Array.isArray(b?.data?.source_ids) && b.data.source_ids.length)) return;
  const draft = await store.aiDraft(postId);
  if (!draft) return;
  const registered = withManualSources(draft.source_pack, await store.manualSources(postId)).sources.map(s => s.id);
  const [first] = unknownSourceIds(document, registered);
  if (first) throw Object.assign(new Error(`ブロック${first.index + 1}：この記事に登録されていない出典ID「${first.ids.join("・").slice(0, 60)}」は保存できません。出典の選択欄から選び直してください。`), { status: 422 });
}

// Approval state for the AI drafts list. The stored status stays "approved" after later edits, so it is only
// shown as approved while the latest approval is for the post's current version and revision (blog_release
// additionally compares the content fingerprint).
export function listApprovalState(draft, post, approval) {
  if (draft.status === "rejected") return "rejected";
  if (approval && post && approval.edit_version === post.edit_version && approval.revision_id === post.editing_revision_id) return "approved";
  return approval ? "reapproval_needed" : "needs_review";
}
