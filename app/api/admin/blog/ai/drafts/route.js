import { blogResponse, requireBlogAdmin } from "../../../../../../lib/blog/server";
import { aiServerDeps } from "../../../../../../lib/blog/ai/server";
import { listApprovalState } from "../../../../../../lib/blog/ai/approval.mjs";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  return blogResponse(async () => {
    await requireBlogAdmin(request);
    const { store } = aiServerDeps();
    const [drafts, runs] = await Promise.all([store.aiDrafts(), store.recentRuns(new Date(Date.now() - 7 * 86400000).toISOString()).catch(() => [])]);
    const { posts, approvals } = await store.approvalStates(drafts.map(d => d.post_id));
    const withState = drafts.map(d => ({ ...d, approval_state: listApprovalState(d, posts.find(p => p.id === d.post_id), approvals.find(a => a.post_id === d.post_id)) }));
    return { drafts: withState, runs: runs.slice(0, 20) };
  });
}
