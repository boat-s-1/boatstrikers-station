import { BLOG_CHARACTERS } from "./characterAssets.mjs";

export const BLOCK_TYPES = ["TEXT", "HEADING", "IMAGE", "DIALOGUE", "DIALOGUE_SCENE", "AI_MATE", "DATA_CHECK", "POINT", "WARNING", "QUOTE", "CTA", "RELATED_ARTICLES", "RACE_LINK", "LIST", "TABLE", "YOUTUBE"];
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function invalid(message) { const e = new Error(message); e.status = 400; throw e; }
function object(x) { return x !== null && typeof x === "object" && !Array.isArray(x); }
function text(x, limit = 20000) { return typeof x === "string" && x.length <= limit; }
function uniqueIds(ids) { return Array.isArray(ids) && ids.every(x => UUID.test(x)) && new Set(ids).size === ids.length; }
export function safeLink(value) {
  if (typeof value !== "string" || /[\s\\\u0000-\u001f]/.test(value)) return false;
  if (/^\/[^/]/.test(value)) return true;
  try { return new URL(value).protocol === "https:"; } catch { return false; }
}
function turn(t, kind) {
  const c = BLOG_CHARACTERS[t?.character];
  if (!object(t) || !c || !c.poses[t.pose] || (kind && c.kind !== kind)
    || !text(t.text) || !["auto", "left", "right"].includes(t.alignment)) invalid("会話のキャラ・ポーズ・セリフ・配置を確認してください。");
}
export function validateDocument(doc) {
  if (!object(doc) || doc.schema_version !== 1 || !text(doc.title, 200) || !text(doc.excerpt ?? "", 2000)
    || (doc.category_id !== null && !UUID.test(doc.category_id)) || !object(doc.seo) || !object(doc.cover)
    || typeof doc.noindex !== "boolean" || !uniqueIds(doc.author_ids) || !uniqueIds(doc.tag_ids)
    || !Array.isArray(doc.relations) || !Array.isArray(doc.blocks) || doc.blocks.length > 300
    || !uniqueIds(doc.blocks.map(b => b?.id))) invalid("記事データの形式を確認してください。");
  if (JSON.stringify(doc).length > 1000000) invalid("記事データが大きすぎます。");
  for (const field of ["title", "description"]) if (doc.seo[field] !== undefined && !text(doc.seo[field], 1000)) invalid("SEO設定を確認してください。");
  if (doc.seo.og_media_id != null && !UUID.test(doc.seo.og_media_id)) invalid("OGP画像を確認してください。");
  if (doc.seo.og_alt !== undefined && !text(doc.seo.og_alt, 1000)) invalid("OGP画像の説明を確認してください。");
  if (doc.cover.media_id != null && !UUID.test(doc.cover.media_id)) invalid("表紙画像を確認してください。");
  for (const relation of doc.relations) {
    if (!object(relation) || Boolean(relation.post_id) === Boolean(relation.path)
      || (relation.post_id && !UUID.test(relation.post_id))
      || (relation.path && (!relation.path.startsWith("/") || !safeLink(relation.path)))) invalid("関連記事を確認してください。");
  }
  for (const b of doc.blocks) {
    if (!BLOCK_TYPES.includes(b.type) || !object(b.data)) invalid("ブロック種類を確認してください。");
    const d = b.data;
    if (b.type === "DIALOGUE_SCENE") {
      if (!Array.isArray(d.turns) || d.turns.length < 1 || d.turns.length > 100 || !uniqueIds(d.turns.map(t => t?.id))) invalid("会話シーンを確認してください。");
      d.turns.forEach(t => turn(t));
    }
    if (b.type === "DIALOGUE") turn(d, "human");
    if (b.type === "AI_MATE") turn(d, "mate");
    if (["TEXT", "POINT", "WARNING", "QUOTE", "DATA_CHECK"].includes(b.type) && !text(d.text)) invalid("ブロックの文章を確認してください。");
    if (b.type === "HEADING" && (![2, 3].includes(d.level) || !text(d.text, 200))) invalid("見出しはH2またはH3です。");
    if (b.type === "IMAGE" && (d.media_id != null && !UUID.test(d.media_id) || !text(d.alt ?? "", 1000))) invalid("画像ブロックを確認してください。");
    if (["CTA", "RACE_LINK", "YOUTUBE"].includes(b.type) && !safeLink(d.href)) invalid("リンクはサイト内URLまたはHTTPSを指定してください。");
    if (b.type === "RACE_LINK" && (!/^\d{4}-\d{2}-\d{2}$/.test(d.race_date) || !Number.isInteger(d.race_no) || d.race_no < 1 || d.race_no > 12)) invalid("レースの日付・番号を確認してください。");
    if (b.type === "RELATED_ARTICLES" && (!uniqueIds(d.post_ids ?? []) || !Array.isArray(d.paths ?? []) || (d.paths ?? []).some(p => !p.startsWith("/") || !safeLink(p)))) invalid("関連記事ブロックを確認してください。");
    if (b.type === "LIST" && (!Array.isArray(d.items) || !d.items.every(x => text(x)))) invalid("リストを確認してください。");
    if (b.type === "TABLE" && (!Array.isArray(d.rows) || !d.rows.every(row => Array.isArray(row) && row.every(x => text(x))))) invalid("表を確認してください。");
    if (d.source_url !== undefined && !safeLink(d.source_url)) invalid("出典URLを確認してください。");
  }
  return doc;
}

export function blankDocument() {
  return { schema_version: 1, title: "", excerpt: "", category_id: null, seo: {}, cover: {}, noindex: false,
    author_ids: [], tag_ids: [], relations: [], blocks: [] };
}

export function noteText(doc) {
  validateDocument(doc);
  const icons = { ichika: "🌱", hatsune: "💜", kiina: "⭐", ichimaru: "🔍", hatsukoro: "🔍", kiimoko: "🔍" };
  const speech = t => `${icons[t.character]} ${BLOG_CHARACTERS[t.character].name}\n「${t.text}」`;
  return [doc.title, doc.excerpt, ...doc.blocks.map(b => {
    if (b.type === "DIALOGUE_SCENE") return b.data.turns.map(speech).join("\n\n");
    if (["DIALOGUE", "AI_MATE"].includes(b.type)) return speech(b.data);
    if (b.type === "IMAGE") return b.data.caption || "［画像］";
    if (b.type === "LIST") return b.data.items.map(x => `・${x}`).join("\n");
    if (b.type === "TABLE") return b.data.rows.map(row => row.join(" / ")).join("\n");
    return b.data.text || b.data.label || "";
  })].filter(Boolean).join("\n\n");
}
