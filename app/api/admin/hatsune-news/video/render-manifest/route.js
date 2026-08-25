import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isAdminAuthenticated } from "../../../../../admin/sync/_lib/adminAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase管理用環境変数が未設定です。");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function authorized(request) {
  if (await isAdminAuthenticated()) return true;
  const secret = process.env.HATSUNE_NEWS_ADMIN_SECRET || process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

export async function GET(request) {
  if (!(await authorized(request))) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    const id = Number(new URL(request.url).searchParams.get("id"));
    if (!Number.isFinite(id)) {
      return NextResponse.json({ ok: false, error: "id is required" }, { status: 400 });
    }

    const supabase = getSupabase();
    const { data: video, error } = await supabase
      .from("hatsune_news_videos")
      .select("id,video_type,target_date,period_start,period_end,source_article_ids,title,script,caption_json,youtube_title,youtube_description,x_text,hashtags,status,duration_seconds,ai_model,ai_generated_at,rendered_at,render_meta,render_error")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!video) return NextResponse.json({ ok: false, error: "video not found" }, { status: 404 });

    const ids = Array.isArray(video.source_article_ids) ? video.source_article_ids : [];
    let sources = [];
    if (ids.length) {
      const { data, error: sourceError } = await supabase
        .from("hatsune_news")
        .select("id,title,summary,category,source_name,source_url,place,published_at")
        .in("id", ids)
        .order("published_at", { ascending: true });
      if (sourceError) throw sourceError;
      sources = data || [];
    }

    return NextResponse.json({
      ok: true,
      manifest: {
        renderer_version: "hatsune-news-v1",
        ...video,
        sources,
        visual: {
          width: 1080,
          height: 1920,
          fps: 30,
          character_url: "/bsc/status-hatsune.png",
          brand: "BoatStrikers",
          program: video.video_type === "weekly_news" ? "週間ヴィーナスNEWS" : "今日のヴィーナスNEWS",
        },
      },
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error?.message || String(error) }, { status: 500 });
  }
}
