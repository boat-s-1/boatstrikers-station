import { PROMPT_VERSION } from "./config.mjs";
import { AI_CATEGORIES, similarTitles, stadiumBySlug } from "./topics.mjs";
import { defaultSourceUrls, fetchOfficialDocument } from "./officialSources.mjs";
import { buildSourcePack } from "./sourcePack.mjs";
import { ARTICLE_SCHEMA, buildInstructions, buildInput } from "./prompt.mjs";
import { composeDocument } from "./compose.mjs";
import { validateAiDocument, blockingCount } from "./validate.mjs";
import { coverSpec } from "./cover.mjs";

const REFRESH_AFTER_MS = 7 * 24 * 60 * 60 * 1000;
const DUPLICATE_STOP = 0.8, DUPLICATE_WARN = 0.6;
const stop = (status, message) => Object.assign(new Error(message), { status });

// Fetch every active URL for the stadium (defaults + registered). Each attempt is stored with its time.
export async function refreshOfficialSources({ store, stadiumSlug, fetchImpl, now = () => new Date() }) {
  if (!stadiumBySlug(stadiumSlug)) throw stop(400, "場を確認してください。");
  await store.ensureSourceUrls(defaultSourceUrls(stadiumSlug));
  const urls = (await store.sourceUrls(stadiumSlug)).filter(u => u.active);
  const results = [];
  for (const source of urls) {
    const record = await fetchOfficialDocument({ fetchImpl, source, registeredUrls: urls, now });
    await store.insertDocument(record);
    results.push({ url: record.url, fetched_at: record.fetched_at, ok: !record.fetch_error, error: record.fetch_error });
  }
  return results;
}

// topic → official sources → AI → validation → cover → draft. Never publishes.
export async function runDraftPipeline({ topicId, store, repo, callAi, renderCover, fetchImpl, config, extraTitles = [], now = () => new Date() }) {
  const topic = await store.topic(topicId);
  if (topic.status !== "candidate") throw stop(409, "このテーマはすでに下書き化または不採用になっています。");
  const category = AI_CATEGORIES[topic.category_slug];
  if (!category) throw stop(400, "AI下書きに対応していないカテゴリーです。");

  const titles = [...await store.postTitles(), ...extraTitles];
  const similar = similarTitles(topic.title_hint, titles, DUPLICATE_WARN);
  if (similar[0]?.score >= DUPLICATE_STOP) throw stop(409, `よく似た記事があります：「${similar[0].title}」。テーマを見直してください。`);

  let documents = [];
  if (topic.stadium_slug) {
    documents = await store.documents(topic.stadium_slug);
    const fresh = documents.find(d => !d.fetch_error && now() - new Date(d.fetched_at) < REFRESH_AFTER_MS);
    if (!fresh) {
      await refreshOfficialSources({ store, stadiumSlug: topic.stadium_slug, fetchImpl, now });
      documents = await store.documents(topic.stadium_slug);
    }
  }
  const pack = buildSourcePack({ topic, documents, now });
  if (pack.gaps.includes("official_documents_missing")) throw stop(422, "公式情報を取得できていません。「公式情報」で公式サイトのURLを登録・取得してから生成してください。");

  const catalogue = await store.catalogue(topic.category_slug);
  const { data: ai, model } = await callAi({ instructions: buildInstructions(pack), input: buildInput(pack), schema: ARTICLE_SCHEMA, schemaName: "boatstrikers_blog_article" });

  const character = topic.character_key || category.author;
  let cover = null; const coverIssues = [];
  try {
    const spec = coverSpec({ title: ai.title, categoryName: catalogue.categoryName || category.name, stadiumName: stadiumBySlug(topic.stadium_slug)?.name, character });
    const media = await store.uploadCover(await renderCover(spec), { alt: spec.alt, source: spec.source });
    if (media) cover = { id: media.id, alt: spec.alt };
    else coverIssues.push({ level: "warning", code: "cover_not_stored", message: "画像保管先が未設定のため、表紙画像は保存していません。" });
  } catch (error) {
    coverIssues.push({ level: "warning", code: "cover_failed", message: `表紙画像を作成できませんでした：${error.message}` });
  }

  const composed = composeDocument({ ai, pack, topic, catalogue, coverMediaId: cover?.id ?? null, coverAlt: cover?.alt ?? "" });
  const issues = [...composed.issues, ...validateAiDocument({ document: composed.document, pack }), ...coverIssues,
    ...similar.map(s => ({ level: "warning", code: "similar_title", message: `似た記事があります（類似度${Math.round(s.score * 100)}%）：「${s.title}」` }))];

  let post;
  try { post = await repo.create(composed.slug, composed.document); }
  catch (error) { if (error.code === "23505") throw stop(409, `slug「${composed.slug}」の記事がすでにあります。`); throw error; }
  await store.insertAiDraft({ post_id: post.id, topic_id: topic.id, model, prompt_version: PROMPT_VERSION, source_pack: pack,
    validation: issues, blocking_issues: blockingCount(issues), validated_version: post.version, cover_media_id: cover?.id ?? null });
  await store.setTopic(topic.id, { status: "drafted", post_id: post.id });
  return { post_id: post.id, slug: composed.slug, version: post.version, blocking: blockingCount(issues), warnings: issues.length - blockingCount(issues), issues };
}
