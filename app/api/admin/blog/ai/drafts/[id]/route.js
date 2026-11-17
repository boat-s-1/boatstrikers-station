import { blogResponse, requireBlogAdmin } from "../../../../../../../lib/blog/server";
import { aiServerDeps } from "../../../../../../../lib/blog/ai/server";
import { draftStatus } from "../../../../../../../lib/blog/ai/approval.mjs";
import { UUID } from "../../../../../../../lib/blog/document.mjs";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Not gated by BLOG_AI_DRAFTS_ENABLED: the editor must always know whether a post needs approval.
export async function GET(request, { params }) {
  return blogResponse(async () => {
    await requireBlogAdmin(request);
    const id = (await params).id;
    if (!UUID.test(id)) throw Object.assign(new Error("記事が見つかりません。"), { status: 404 });
    const { repo, store } = aiServerDeps();
    return draftStatus({ repo, store, postId: id });
  });
}
