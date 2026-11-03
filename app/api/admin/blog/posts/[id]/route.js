import { blogAdminRepository, blogBody, blogResponse, requireBlogAdmin } from "../../../../../../lib/blog/server";
import { aiServerDeps } from "../../../../../../lib/blog/ai/server";
import { assertRegisteredCitations } from "../../../../../../lib/blog/ai/approval.mjs";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request, { params }) {
  return blogResponse(async () => {
    await requireBlogAdmin(request);
    return blogAdminRepository().editor((await params).id);
  });
}
export async function PUT(request, { params }) {
  return blogResponse(async () => {
    await requireBlogAdmin(request, { write: true });
    const body = await blogBody(request), id = (await params).id;
    // AI drafts may only cite their registered sources (no extra query for documents without citations).
    if (body.document?.blocks?.some?.(b => b?.data?.source_ids?.length)) await assertRegisteredCitations({ store: aiServerDeps().store, postId: id, document: body.document });
    return blogAdminRepository().save(id, body.version, body.document);
  });
}
