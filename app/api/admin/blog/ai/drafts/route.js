import { blogResponse, requireBlogAdmin } from "../../../../../../lib/blog/server";
import { aiServerDeps } from "../../../../../../lib/blog/ai/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  return blogResponse(async () => {
    await requireBlogAdmin(request);
    const { store } = aiServerDeps();
    const [drafts, runs] = await Promise.all([store.aiDrafts(), store.recentRuns(new Date(Date.now() - 7 * 86400000).toISOString()).catch(() => [])]);
    return { drafts, runs: runs.slice(0, 20) };
  });
}
