import { blogBody, blogResponse, requireBlogAdmin } from "../../../../../../../../lib/blog/server";
import { aiServerDeps } from "../../../../../../../../lib/blog/ai/server";
import { addManualSource } from "../../../../../../../../lib/blog/ai/manualSources.mjs";
import { UUID } from "../../../../../../../../lib/blog/document.mjs";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// A reviewer registers the source of a fact they added (URL, label, when it was checked, who).
// The source is appended to the article's sources section; the version moves, so re-approval is needed.
export async function POST(request, { params }) {
  return blogResponse(async () => {
    await requireBlogAdmin(request, { write: true });
    const id = (await params).id, body = await blogBody(request);
    if (!UUID.test(id) || !Number.isSafeInteger(body.version)) throw Object.assign(new Error("記事と版を確認してください。"), { status: 400 });
    const { repo, store } = aiServerDeps();
    return addManualSource({ repo, store, postId: id, version: body.version, input: body });
  });
}
