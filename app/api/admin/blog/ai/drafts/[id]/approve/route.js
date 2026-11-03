import { blogBody, blogResponse, requireBlogAdmin } from "../../../../../../../../lib/blog/server";
import { aiServerDeps, currentApproverSession } from "../../../../../../../../lib/blog/ai/server";
import { approveDraft } from "../../../../../../../../lib/blog/ai/approval.mjs";
import { UUID } from "../../../../../../../../lib/blog/document.mjs";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Approval only. Publishing is still done with the editor's publish button (blog_release), which the DB
// allows only while this approval matches the current editing version.
export async function POST(request, { params }) {
  return blogResponse(async () => {
    await requireBlogAdmin(request, { write: true });
    const id = (await params).id, body = await blogBody(request);
    if (!UUID.test(id) || !Number.isSafeInteger(body.version)) throw Object.assign(new Error("記事と版を確認してください。"), { status: 400 });
    const { repo, store } = aiServerDeps();
    return approveDraft({ repo, store, postId: id, version: body.version, name: body.approver_name, session: await currentApproverSession() });
  });
}
