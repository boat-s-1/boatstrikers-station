import { noteText } from "../document.mjs";
import { BLOG_ORIGIN } from "../seo.mjs";
import { articleHref } from "../articleModel.mjs";
import { BLOG_CHARACTERS } from "../characterAssets.mjs";
import { PERSONAS, BANNED_PHRASES } from "./personas.mjs";
import { authoredTexts, blockingCount } from "./validate.mjs";
import { draftStatus } from "./approval.mjs";

export const DERIVATIVE_PROMPT_VERSION = "blog-derivatives-v1";
export const CHANNELS = ["note", "x", "youtube_script", "youtube_description"];
const X_URL_LENGTH = 23; // X counts any link as 23 characters
const NUMBER = /\d+(?:[.,]\d+)*/g;
const norm = t => String(t ?? "").normalize("NFKC");

// Derivatives are made only from content a person has signed off: the approved current version of an
// AI draft, or a sealed (published or scheduled) revision with no newer unreleased edits.
export async function approvedSnapshot({ repo, store, postId }) {
  const [state, editor] = await Promise.all([store.postState(postId), repo.editor(postId)]);
  const ai = await draftStatus({ repo, store, postId });
  const sealed = !state.editing_revision_id && Boolean(state.published_revision_id || state.scheduled_revision_id);
  if (!(ai.ai ? ai.approved_current || sealed : sealed))
    throw Object.assign(new Error("承認済みの版、または公開・予約済みで未公開の修正がない記事からだけ作成できます。"), { status: 409 });
  return { postId, slug: editor.slug, revisionId: editor.revision_id, version: editor.version, document: editor.document,
    url: `${BLOG_ORIGIN}${articleHref(editor.slug)}`, live: state.state === "published" && !state.editing_revision_id };
}

function sourcesText(document) {
  return document.blocks.filter(b => b.data?.placement === "sources").map(b => `・${b.data.text}`).join("\n");
}

export function noteDerivative(snapshot) {
  const { document, url } = snapshot;
  const body = [noteText({ ...document, blocks: document.blocks.filter(b => b.data?.placement !== "sources") }),
    "――", "出典", sourcesText(document), "", `元記事：${url}`, "※ この記事はBoatStrikers公式ブログからの転載です。最終判断は読者自身で。"].join("\n");
  return { channel: "note", body, metadata: { title: document.title } };
}

export function youtubeDescription(snapshot) {
  const { document, url } = snapshot;
  const body = [document.excerpt || document.title, "", `▼記事で詳しく読む\n${url}`, "", "▼出典", sourcesText(document), "",
    "※ 舟券の購入はご自身の判断でお願いします。"].join("\n");
  return { channel: "youtube_description", body, metadata: { title: document.title } };
}

export const SOCIAL_SCHEMA = {
  type: "object", additionalProperties: false, required: ["x_post", "x_hashtags", "yt_title", "yt_scenes", "yt_closing"],
  properties: {
    x_post: { type: "string" }, x_hashtags: { type: "array", items: { type: "string" } },
    yt_title: { type: "string" },
    yt_scenes: { type: "array", items: { type: "object", additionalProperties: false, required: ["speaker", "line"], properties: {
      speaker: { type: "string", enum: Object.keys(PERSONAS) }, line: { type: "string" } } } },
    yt_closing: { type: "string" },
  },
};

export function socialInstructions(lead) {
  const p = PERSONAS[lead] || PERSONAS.ichika;
  return `BoatStrikers公式ブログの記事から、X投稿とYouTubeショート（約45〜60秒）の台本を作ります。
- 使ってよい内容は入力の記事本文だけです。記事にない数値・固有名詞・予想・結果を足してはいけません。数値は記事の表記のまま使います。
- 「${BANNED_PHRASES.join("」「")}」など、的中の保証や購入を促す表現は使いません。URLは書きません（システムが付けます）。
- x_post：${p.name}の口調（${p.speech}）で全角90文字以内。x_hashtags：#を付けずに2〜3個（例 ボートレース）。
- yt_title：32文字以内（「30秒で」など記事にない数字も入れない）。yt_scenes：4〜8行。話し手は一果・初音・キイナ。1行は40文字以内。yt_closing：記事への誘導を1文。`;
}

export function validateDerivative(body, articleDocument, allowedUrls = []) {
  const issues = [];
  const allowed = new Set();
  for (const item of authoredTexts(articleDocument)) for (const m of norm(item.text).matchAll(NUMBER)) { allowed.add(m[0]); allowed.add(m[0].replace(/,/g, "")); }
  for (const b of articleDocument.blocks) if (b.data?.placement === "sources") for (const m of norm(b.data.text).matchAll(NUMBER)) allowed.add(m[0]);
  const text = norm(body);
  for (const m of text.matchAll(NUMBER)) if (!allowed.has(m[0]) && !allowed.has(m[0].replace(/,/g, ""))) issues.push({ level: "blocking", code: "unsupported_number", message: `記事にない数値「${m[0]}」があります。` });
  for (const phrase of BANNED_PHRASES) if (text.includes(phrase)) issues.push({ level: "blocking", code: "banned_phrase", message: `使用できない表現「${phrase}」があります。` });
  for (const url of text.match(/https?:\/\/[^\s「」（）()<>"']+/g) || []) if (!allowedUrls.includes(url)) issues.push({ level: "blocking", code: "unknown_url", message: "記事以外のURLがあります。" });
  const seen = new Set();
  return issues.filter(i => !seen.has(i.message) && seen.add(i.message));
}

export async function generateDerivatives({ snapshot, channels = CHANNELS, callAi, authorSlug = "ichika" }) {
  const wanted = channels.filter(c => CHANNELS.includes(c));
  if (!wanted.length) throw Object.assign(new Error("作成する媒体を選んでください。"), { status: 400 });
  const out = [];
  if (wanted.includes("note")) out.push(noteDerivative(snapshot));
  if (wanted.includes("youtube_description")) out.push(youtubeDescription(snapshot));
  let model = null;
  if (wanted.includes("x") || wanted.includes("youtube_script")) {
    const article = noteText({ ...snapshot.document, blocks: snapshot.document.blocks.filter(b => !b.data?.system) });
    const { data, model: used } = await callAi({ instructions: socialInstructions(authorSlug), input: article, schema: SOCIAL_SCHEMA, schemaName: "boatstrikers_blog_social", maxOutputTokens: 4000 });
    model = used;
    if (wanted.includes("x")) {
      const tags = (data.x_hashtags || []).map(t => String(t).trim().replace(/^#+/, "")).filter(t => /^[\p{L}\p{N}_]{1,30}$/u.test(t)).slice(0, 3);
      const body = `${String(data.x_post || "").trim()}${tags.length ? `\n${tags.map(t => `#${t}`).join(" ")}` : ""}\n${snapshot.url}`;
      const length = [...body.replace(snapshot.url, "")].length + X_URL_LENGTH;
      out.push({ channel: "x", body, metadata: { length, limit: 140 }, extra: length > 140 ? [{ level: "blocking", code: "too_long", message: `X投稿が長すぎます（${length}/140）。` }] : [] });
    }
    if (wanted.includes("youtube_script")) {
      const lines = (data.yt_scenes || []).map(s => `${BLOG_CHARACTERS[s.speaker]?.name || s.speaker}：${String(s.line || "").trim()}`);
      const body = [`タイトル：${String(data.yt_title || "").trim()}`, "", ...lines, "", String(data.yt_closing || "").trim(), "", "（概要欄に記事URLと出典を記載）"].join("\n");
      out.push({ channel: "youtube_script", body, metadata: { scenes: lines.length } });
    }
  }
  return out.map(d => {
    const validation = [...validateDerivative(d.body, snapshot.document, [snapshot.url]), ...(d.extra || [])];
    if (!snapshot.live) validation.push({ level: "warning", code: "not_published", message: "元記事はまだ公開されていません。記事を公開してから投稿してください。" });
    return { channel: d.channel, body: d.body, metadata: d.metadata, validation, blocking_issues: blockingCount(validation),
      model: ["x", "youtube_script"].includes(d.channel) ? model : null, prompt_version: DERIVATIVE_PROMPT_VERSION };
  });
}
