import { coverSpec } from "./cover.mjs";
import { stadiumBySlug } from "./topics.mjs";

// Re-creates the template cover from the current title and sets it as cover + OGP image in one save.
// The save moves the version, so an AI draft must be approved again afterwards.
export async function regenerateCover({ repo, store, postId, version, character = null, pose = "pose5", renderCover }) {
  const editor = await repo.editor(postId);
  if (editor.version !== version) throw Object.assign(new Error("画面の版が最新ではありません。保存してから作り直してください。"), { status: 409 });
  const doc = editor.document;
  if (!doc.title?.trim()) throw Object.assign(new Error("タイトルを入力してから作り直してください。"), { status: 400 });
  const authors = await store.authors();
  const fromAuthor = doc.author_ids.map(id => authors.find(a => a.id === id)?.character_key).find(Boolean);
  const spec = coverSpec({ title: doc.title, categoryName: await store.categoryName(doc.category_id), stadiumName: stadiumBySlug(doc.seo?.stadium_slug)?.name ?? null,
    character: character || fromAuthor || "ichika", pose });
  const media = await store.uploadCover(await renderCover(spec), { alt: spec.alt, source: spec.source });
  if (!media) throw Object.assign(new Error("BLOG画像の保管先が未設定です。"), { status: 503 });
  const saved = await repo.save(postId, version, { ...doc, cover: { ...doc.cover, media_id: media.id }, seo: { ...doc.seo, og_media_id: media.id, og_alt: spec.alt } });
  if (await store.aiDraft(postId)) await store.setDraftCover(postId, media.id);
  return { version: saved.version, media_id: media.id };
}
