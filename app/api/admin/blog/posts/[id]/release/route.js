import { blogAdminRepository, blogBody, blogResponse, requireBlogAdmin } from "../../../../../../../lib/blog/server";
import { releaseTime } from '../../../../../../../lib/blog/publicationRequest.mjs';
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request, { params }) {
  return blogResponse(async () => {
    await requireBlogAdmin(request, { write: true });
    const body = await blogBody(request);
    try { return await blogAdminRepository().release((await params).id, body.version, releaseTime(body)); }
    catch (error) {
      // The database enforces the rule; this only turns its code into a readable message.
      if (/BLOG_AI_APPROVAL_REQUIRED|BLOG_AI_CONTENT_CHANGED/.test(String(error?.message || "")))
        throw Object.assign(new Error("AI生成の下書きです。現在の版を承認してから公開・予約してください（承認後に修正した場合は再承認が必要です）。"), { status: 403 });
      throw error;
    }
  });
}
