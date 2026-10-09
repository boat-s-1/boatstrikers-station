import { createHash } from "node:crypto";
import { validateAiDocument, blockingCount } from "./validate.mjs";

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

// Re-validates the exact version being approved, then asks the DB to record the approval.
// The DB rejects approval if the version moved or blocking issues remain.
export async function approveDraft({ repo, store, postId, version, name, session }) {
  const draft = await store.aiDraft(postId);
  if (!draft) throw Object.assign(new Error("AI下書きではありません。"), { status: 404 });
  const editor = await repo.editor(postId);
  if (editor.version !== version) throw Object.assign(new Error("承認しようとした版より新しい保存があります。画面を再読み込みしてください。"), { status: 409 });
  const issues = validateAiDocument({ document: editor.document, pack: draft.source_pack });
  await store.recordValidation(postId, issues, editor.version);
  if (blockingCount(issues)) return { approved: false, issues };
  const result = await store.approve(postId, version, approverName(name), session);
  return { approved: true, approval: result, issues };
}

// Status shown in the editor: is the current editing version approved?
export async function draftStatus({ repo, store, postId }) {
  const draft = await store.aiDraft(postId);
  if (!draft) return { ai: false };
  const [editor, approval] = await Promise.all([repo.editor(postId), store.latestApproval(postId)]);
  const approvedCurrent = Boolean(approval && approval.edit_version === editor.version && approval.revision_id === editor.revision_id);
  return { ai: true, status: draft.status, version: editor.version, approved_current: approvedCurrent,
    approval: approval ? { name: approval.approver_name, at: approval.created_at, version: approval.edit_version } : null,
    validation: draft.validation, validated_version: draft.validated_version, blocking_issues: draft.blocking_issues,
    model: draft.model, generated_at: draft.generated_at, sources: (draft.source_pack?.sources || []).map(s => ({ label: s.label, url: s.url, fetched_at: s.fetched_at, period: s.period ?? null })) };
}
