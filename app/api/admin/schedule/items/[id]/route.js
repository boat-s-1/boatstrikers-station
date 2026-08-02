import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { isScheduleAdminAuthenticated } from "../../../../../admin/schedule/_lib/scheduleAdminAuth";
import { getAdminScheduleSupabase } from "../../../../../../lib/scheduleSupabase";

function clean(body) {
  return {
    event_date: String(body.event_date || ""),
    start_time: String(body.start_time || "").slice(0, 5),
    content_type: String(body.content_type || "other"),
    title: String(body.title || "").trim(),
    episode: String(body.episode || "").trim(),
    host: String(body.host || "BoatStrikers"),
    description: String(body.description || "").trim(),
    link_url: String(body.link_url || "").trim() || null,
    status: body.status === "published" ? "published" : "draft",
    is_featured: Boolean(body.is_featured),
  };
}

export async function PUT(request, { params }) {
  if (!(await isScheduleAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const item = clean(await request.json());
    const supabase = getAdminScheduleSupabase();
    const { data, error } = await supabase
      .from("weekly_schedule_items")
      .update(item)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return NextResponse.json({ item: data });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "更新に失敗しました。" },
      { status: 500 }
    );
  }
}

export async function DELETE(_request, { params }) {
  if (!(await isScheduleAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const supabase = getAdminScheduleSupabase();
    const { error } = await supabase
      .from("weekly_schedule_items")
      .delete()
      .eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "削除に失敗しました。" },
      { status: 500 }
    );
  }
}
