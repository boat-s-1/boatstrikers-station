import { randomUUID } from "node:crypto";
import { normalizeSourceUrl } from "./officialSources.mjs";
import { sourceLine } from "./compose.mjs";

const bad = message => Object.assign(new Error(message), { status: 400 });

// A fact a reviewer adds must carry: what it says, where it was checked (https), when, and who added it.
export function validateManualSource(input, now = () => new Date()) {
  const statement = String(input?.statement ?? "").normalize("NFKC").trim();
  const label = String(input?.source_label ?? "").trim();
  const url = normalizeSourceUrl(input?.source_url);
  const by = String(input?.registered_by ?? "").normalize("NFKC").replace(/\s+/g, " ").trim();
  const checked = Date.parse(input?.checked_at);
  if (!statement || statement.length > 500) throw bad("追記した事実（500文字以内）を入力してください。");
  if (!label || label.length > 200) throw bad("出典名（200文字以内）を入力してください。");
  if (!url) throw bad("出典URLは https で始まる正しいURLを入力してください。");
  if (!Number.isFinite(checked) || checked > now().getTime() + 5 * 60 * 1000) throw bad("出典を確認した日時を入力してください（未来の日時は不可）。");
  if (!by || by.length > 80) throw bad("登録者名（80文字以内）を入力してください。");
  return { statement, source_label: label, source_url: url, checked_at: new Date(checked).toISOString(), registered_by: by };
}

// Manual sources join the pack as sources M1.. with their check time as fetched_at.
export function withManualSources(pack, rows = []) {
  if (!rows.length) return pack;
  const sources = [...pack.sources], facts = [...pack.facts];
  rows.forEach((row, i) => {
    const id = `M${i + 1}`;
    sources.push({ id, kind: "manual", label: row.source_label, url: row.source_url, fetched_at: row.checked_at, registered_by: row.registered_by });
    facts.push({ id: `MF${i + 1}`, source_id: id, label: row.statement, value: row.statement, unit: "" });
  });
  return { ...pack, sources, facts };
}

export function manualSourceBlock(row) {
  return { id: randomUUID(), type: "QUOTE", data: { text: `${sourceLine({ label: row.source_label, fetched_at: row.checked_at })}（確認・登録：${row.registered_by}）`,
    source_url: row.source_url, source_label: row.source_label.slice(0, 500), placement: "sources", system: true } };
}

// Records the source and adds it to the article's sources section in one save (the version moves,
// so an existing approval no longer matches and the post must be approved again).
export async function addManualSource({ repo, store, postId, version, input, now }) {
  const row = validateManualSource(input, now);
  const editor = await repo.editor(postId);
  if (editor.version !== version) throw Object.assign(new Error("画面の版が最新ではありません。保存してから登録してください。"), { status: 409 });
  if (!await store.aiDraft(postId)) throw Object.assign(new Error("AI下書きではありません。"), { status: 404 });
  await store.insertManualSource({ post_id: postId, ...row });
  const document = { ...editor.document, blocks: [...editor.document.blocks, manualSourceBlock(row)] };
  const saved = await repo.save(postId, version, document);
  return { version: saved.version, source: row };
}
