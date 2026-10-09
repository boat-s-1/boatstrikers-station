import { blogBody, blogResponse, requireBlogAdmin } from "../../../../../../../../lib/blog/server";
import { aiServerDeps } from "../../../../../../../../lib/blog/ai/server";
import { UUID } from "../../../../../../../../lib/blog/document.mjs";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request, { params }) {
  return blogResponse(async () => {
    await requireBlogAdmin(request, { write: true });
    const id = (await params).id, body = await blogBody(request), reason = String(body.reason || "").trim();
    if (!UUID.test(id)) throw Object.assign(new Error("記事が見つかりません。"), { status: 404 });
    if (!reason || reason.length > 500) throw Object.assign(new Error("却下の理由（500文字以内）を入力してください。"), { status: 400 });
    const { store } = aiServerDeps();
    if (!await store.aiDraft(id)) throw Object.assign(new Error("AI下書きではありません。"), { status: 404 });
    await store.reject(id, reason);
    return { rejected: true };
  });
}
