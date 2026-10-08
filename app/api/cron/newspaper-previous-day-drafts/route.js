import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { runNewspaperAiWrite } from "../../../../lib/newspaper/aiWriter.mjs";
import { recordAutoDraftRun, resolveRunMode, runAutoDraft } from "../../../../lib/newspaper/autoDraft.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

// 前日版新聞（レース当日の展示前予想）の自動下書き。vercel.json にはまだ登録していない。
// - 本番環境では NEWSPAPER_AUTO_DRAFT_ALLOW_PRODUCTION=true が無い限り何もしない。
// - ?dry_run=1 はDB読み取りのみ（AI呼び出し・書き込みなし）。
// - NEWSPAPER_AUTO_DRAFT_ENABLED=true でなければ書き込まない。
function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase管理接続が未設定です");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const now = new Date();
  const run = resolveRunMode({ env: process.env, searchParams, now });
  if (run.mode === "blocked" || run.mode === "disabled") {
    return NextResponse.json({ ok: true, mode: run.mode, reason: run.reason, date: run.date });
  }

  const supabase = db();
  const model = process.env.OPENAI_NEWSPAPER_MODEL?.trim() || null;
  try {
    const result = await runAutoDraft({
      supabase,
      mode: run.mode,
      date: run.date,
      now,
      model,
      aiWrite: (body) => runNewspaperAiWrite({
        apiKey: process.env.OPENAI_API_KEY,
        model: process.env.OPENAI_NEWSPAPER_MODEL,
        readBody: async () => body,
        getSupabase: () => supabase,
      }),
    });
    if (run.mode === "write") await recordAutoDraftRun(supabase, result);
    console.info("[newspaper-previous-day-drafts]", JSON.stringify({ mode: result.mode, date: result.date, summary: result.summary }));
    return NextResponse.json(result, { status: result.ok ? 200 : 500 });
  } catch (error) {
    const message = String(error?.message || error);
    console.error("[newspaper-previous-day-drafts] failed", message);
    if (run.mode === "write") await recordAutoDraftRun(supabase, { date: run.date, mode: run.mode }, { error: message });
    return NextResponse.json({ ok: false, mode: run.mode, date: run.date, error: message }, { status: 500 });
  }
}
