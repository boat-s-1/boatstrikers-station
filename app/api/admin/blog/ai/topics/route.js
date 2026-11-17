import { blogBody, blogResponse, requireBlogAdmin } from "../../../../../../lib/blog/server";
import { aiServerDeps } from "../../../../../../lib/blog/ai/server";
import { requireAiEnabled, aiConfig } from "../../../../../../lib/blog/ai/config.mjs";
import { AI_CATEGORIES, candidateTopics } from "../../../../../../lib/blog/ai/topics.mjs";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const bad = message => Object.assign(new Error(message), { status: 400 });

export async function GET(request) {
  return blogResponse(async () => {
    await requireBlogAdmin(request);
    const params = new URL(request.url).searchParams, category = params.get("category"), stadium = params.get("stadium") || null;
    const registered = await aiServerDeps().store.topics();
    const candidates = category ? candidateTopics({ categorySlug: category, stadiumSlug: stadium, existingKeys: registered.map(t => t.topic_key) }) : [];
    return { enabled: aiConfig().enabled, categories: Object.entries(AI_CATEGORIES).map(([slug, c]) => ({ slug, name: c.name, perStadium: c.perStadium })), registered, candidates };
  });
}

export async function POST(request) {
  return blogResponse(async () => {
    await requireBlogAdmin(request, { write: true });
    requireAiEnabled();
    const body = await blogBody(request), { store } = aiServerDeps();
    if (body.action === "register") {
      // Only themes produced by the generator can be registered; free-form input is not accepted.
      const candidate = candidateTopics({ categorySlug: body.category_slug, stadiumSlug: body.stadium_slug || null }).find(c => c.angle === body.angle);
      if (!candidate) throw bad("テーマ候補を確認してください。");
      return store.registerTopic(candidate);
    }
    if (body.action === "reject") {
      const topic = await store.topic(String(body.id || ""));
      if (topic.status !== "candidate") throw bad("下書き化済みのテーマは不採用にできません。");
      return store.setTopic(topic.id, { status: "rejected", note: String(body.note || "").slice(0, 500) || null });
    }
    throw bad("操作を確認してください。");
  });
}
