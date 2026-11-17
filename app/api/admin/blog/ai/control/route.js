import { blogResponse, requireBlogAdmin } from "../../../../../../lib/blog/server";
import { aiServerDeps } from "../../../../../../lib/blog/ai/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Read-only status and deduplicated HOLD list (one row per job/date).
export async function GET(request) {
  return blogResponse(async () => {
    await requireBlogAdmin(request);
    const { store } = aiServerDeps();
    const [settings, jobs] = await Promise.all([store.aiSettings(), store.recentJobs()]);
    return { settings, holds: jobs.filter(j => j.state === "HOLD"), jobs };
  });
}

// Only disables. No enable path and no external notification side effects.
export async function POST(request) {
  return blogResponse(async () => {
    await requireBlogAdmin(request, { write: true });
    const body = await request.json();
    if (body?.action !== "emergency_stop" || body?.confirmation !== "STOP") {
      throw Object.assign(new Error("緊急停止の確認が必要です。"), { status: 400 });
    }
    const { store } = aiServerDeps();
    const settings = await store.emergencyStop();
    return { stopped: true, settings };
  });
}
