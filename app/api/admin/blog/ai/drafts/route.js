import { blogResponse, requireBlogAdmin } from "../../../../../../lib/blog/server";
import { aiServerDeps } from "../../../../../../lib/blog/ai/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  return blogResponse(async () => {
    await requireBlogAdmin(request);
    return { drafts: await aiServerDeps().store.aiDrafts() };
  });
}
