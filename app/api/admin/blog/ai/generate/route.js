import { blogBody, blogResponse, requireBlogAdmin } from "../../../../../../lib/blog/server";
import { aiServerDeps, aiCaller, dataLabTitles } from "../../../../../../lib/blog/ai/server";
import { requireAiEnabled } from "../../../../../../lib/blog/ai/config.mjs";
import { runDraftPipeline } from "../../../../../../lib/blog/ai/pipeline.mjs";
import { renderCoverPng } from "../../../../../../lib/blog/ai/cover.mjs";
import { UUID } from "../../../../../../lib/blog/document.mjs";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Creates a draft only. Publication remains a separate, approval-gated action.
export async function POST(request) {
  return blogResponse(async () => {
    await requireBlogAdmin(request, { write: true });
    const config = requireAiEnabled();
    const body = await blogBody(request);
    if (!UUID.test(String(body.topic_id || ""))) throw Object.assign(new Error("テーマを選んでください。"), { status: 400 });
    const { repo, store } = aiServerDeps();
    return runDraftPipeline({ topicId: body.topic_id, store, repo, callAi: aiCaller(config), renderCover: renderCoverPng, fetchImpl: fetch, config, extraTitles: dataLabTitles() });
  });
}
