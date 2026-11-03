import { blogBody, blogResponse, requireBlogAdmin } from "../../../../../../../../lib/blog/server";
import { aiServerDeps, aiCaller } from "../../../../../../../../lib/blog/ai/server";
import { aiConfig, requireAiEnabled } from "../../../../../../../../lib/blog/ai/config.mjs";
import { approvedSnapshot, generateDerivatives, CHANNELS } from "../../../../../../../../lib/blog/ai/derivatives.mjs";
import { UUID } from "../../../../../../../../lib/blog/document.mjs";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;
const notFound = () => Object.assign(new Error("記事が見つかりません。"), { status: 404 });

export async function GET(request, { params }) {
  return blogResponse(async () => {
    await requireBlogAdmin(request);
    const id = (await params).id;
    if (!UUID.test(id)) throw notFound();
    return { derivatives: await aiServerDeps().store.derivatives(id) };
  });
}

// Texts for note / X / YouTube from the approved or sealed version. Nothing is posted automatically.
export async function POST(request, { params }) {
  return blogResponse(async () => {
    await requireBlogAdmin(request, { write: true });
    const id = (await params).id, body = await blogBody(request);
    if (!UUID.test(id)) throw notFound();
    const { repo, store } = aiServerDeps();
    if (body.action === "discard") {
      if (!UUID.test(String(body.derivative_id || ""))) throw notFound();
      await store.discardDerivative(id, body.derivative_id);
      return { discarded: true };
    }
    const channels = Array.isArray(body.channels) ? body.channels.filter(c => CHANNELS.includes(c)) : [];
    const createdBy = String(body.created_by || "").trim();
    if (!createdBy || createdBy.length > 80) throw Object.assign(new Error("作成者名（80文字以内）を入力してください。"), { status: 400 });
    const needsAi = channels.some(c => c === "x" || c === "youtube_script");
    const config = needsAi ? requireAiEnabled() : aiConfig();
    const snapshot = await approvedSnapshot({ repo, store, postId: id });
    const authors = await store.authors();
    const authorSlug = snapshot.document.author_ids.map(a => authors.find(x => x.id === a)?.character_key).find(Boolean) || "ichika";
    const made = await generateDerivatives({ snapshot, channels, callAi: aiCaller(config), authorSlug });
    await store.insertDerivatives(made.map(d => ({ post_id: id, revision_id: snapshot.revisionId, created_by: createdBy, ...d })));
    return { derivatives: await store.derivatives(id) };
  });
}
