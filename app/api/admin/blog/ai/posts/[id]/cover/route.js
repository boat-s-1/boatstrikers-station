import { blogBody, blogResponse, requireBlogAdmin } from "../../../../../../../../lib/blog/server";
import { aiServerDeps } from "../../../../../../../../lib/blog/ai/server";
import { regenerateCover } from "../../../../../../../../lib/blog/ai/coverRegen.mjs";
import { renderCoverPng } from "../../../../../../../../lib/blog/ai/cover.mjs";
import { UUID } from "../../../../../../../../lib/blog/document.mjs";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Template cover from existing character art (no generative AI). Works for any post.
export async function POST(request, { params }) {
  return blogResponse(async () => {
    await requireBlogAdmin(request, { write: true });
    const id = (await params).id, body = await blogBody(request);
    if (!UUID.test(id) || !Number.isSafeInteger(body.version)) throw Object.assign(new Error("記事と版を確認してください。"), { status: 400 });
    const character = ["ichika", "hatsune", "kiina"].includes(body.character) ? body.character : null;
    const pose = ["pose1", "pose2", "pose3", "pose4", "pose5"].includes(body.pose) ? body.pose : "pose5";
    const { repo, store } = aiServerDeps();
    return regenerateCover({ repo, store, postId: id, version: body.version, character, pose, renderCover: renderCoverPng });
  });
}
