import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { aiServerDeps, aiCaller, raceDataReader } from "../../../../lib/blog/ai/server";
import { aiConfig } from "../../../../lib/blog/ai/config.mjs";
import { runDailyCycle } from "../../../../lib/blog/ai/daily.mjs";
import { renderCoverPng } from "../../../../lib/blog/ai/cover.mjs";
import { blogCronAuthorized } from "../../../../lib/blog/ai/cronAuth.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

// BLOG daily cycle (PHASE 2). Not registered in vercel.json or pg_cron. Refused unless BLOG_AI_CRON_SECRET is set and
// matches; does nothing unless BLOG_AI_DRAFTS_ENABLED=true and blog_ai_settings.generation_enabled. Publication happens
// only in the automatic mode with automatic publication on (both off by default), through blog_ai_auto_publish.
export async function GET(request) {
  if (!blogCronAuthorized(request)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const config = aiConfig();
  if (!config.enabled) return NextResponse.json({ ok: true, status: "disabled" });
  try {
    const { repo, store } = aiServerDeps();
    const result = await runDailyCycle({ store, repo, callAi: aiCaller(config), renderCover: renderCoverPng, readRaceRows: raceDataReader(), owner: `cron-${randomUUID()}` });
    return NextResponse.json({ ok: !["failed"].includes(result.status), ...result });
  } catch {
    // Details stay in blog_ai_runs / blog_ai_jobs; the response never carries database or API error text.
    return NextResponse.json({ ok: false, error: "blog daily cycle failed" }, { status: 500 });
  }
}
