import { NextResponse } from "next/server";
import { aiServerDeps, aiCaller, dataLabTitles } from "../../../../lib/blog/ai/server";
import { aiConfig } from "../../../../lib/blog/ai/config.mjs";
import { scheduleConfig, runScheduledDrafts } from "../../../../lib/blog/ai/schedule.mjs";
import { renderCoverPng } from "../../../../lib/blog/ai/cover.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Scheduled AI drafts. Off unless BLOG_AI_DRAFTS_ENABLED and BLOG_AI_SCHEDULE_ENABLED are both "true".
// Creates drafts only; publication always needs a person's approval. Not registered in vercel.json.
export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const schedule = scheduleConfig();
  if (!schedule.enabled) return NextResponse.json({ ok: true, status: "disabled" });
  try {
    const { repo, store } = aiServerDeps();
    const result = await runScheduledDrafts({ store, repo, callAi: aiCaller(aiConfig()), renderCover: renderCoverPng, fetchImpl: fetch, schedule, extraTitles: dataLabTitles() });
    return NextResponse.json({ ok: result.failed?.length ? false : true, status: result.status,
      created: (result.created || []).map(r => ({ post_id: r.post_id, slug: r.slug, blocking: r.blocking })), failed: result.failed || [] });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error?.message || String(error) }, { status: 500 });
  }
}
