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

export async function POST(request) {
  if (!(await authorized(request))) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const id = Number(body?.id);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ ok: false, error: "id is required" }, { status: 400 });
    }

    const success = body?.success !== false;
    const patch = success
      ? {
          status: "rendered",
          rendered_at: new Date().toISOString(),
          render_meta: body?.render_meta && typeof body.render_meta === "object" ? body.render_meta : {},
          render_error: null,
          updated_at: new Date().toISOString(),
        }
      : {
          render_error: String(body?.error || "レンダーに失敗しました。").slice(0, 2000),
          updated_at: new Date().toISOString(),
        };

    const { data, error } = await getSupabase()
      .from("hatsune_news_videos")
      .update(patch)
      .eq("id", id)
      .select("id,status,rendered_at,render_meta,render_error")
      .single();
    if (error) throw error;
    return NextResponse.json({ ok: true, item: data });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error?.message || String(error) }, { status: 500 });
  }
}
