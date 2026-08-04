import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { isScheduleAdminAuthenticated } from "../../../../admin/schedule/_lib/scheduleAdminAuth";
import { getAdminScheduleSupabase } from "../../../../../lib/scheduleSupabase";

const TYPES = ["radio", "short", "note", "live", "comic", "other"];
const HOSTS = ["一果", "初音", "キイナ", "3人", "BoatStrikers"];

function clean(body) {
  return {
    event_date: String(body.event_date || ""),
    start_time: String(body.start_time || "").slice(0, 5),
    content_type: TYPES.includes(body.content_type)
      ? body.content_type
      : "other",
    title: String(body.title || "").trim(),
    episode: String(body.episode || "").trim(),
    host: HOSTS.includes(body.host) ? body.host : "BoatStrikers",
    description: String(body.description || "").trim(),
    link_url: String(body.link_url || "").trim() || null,
    status: body.status === "published" ? "published" : "draft",
    is_featured: Boolean(body.is_featured),
  };
}

function validate(item) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(item.event_date)) {
    return "日付を入力してください。";
  }
  if (!/^\d{2}:\d{2}$/.test(item.start_time)) {
    return "開始時刻を入力してください。";
  }
  if (!item.title) return "番組タイトルを入力してください。";
  return null;
}

export async function GET() {
  if (!(await isScheduleAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = getAdminScheduleSupabase();
    const { data, error } = await supabase
      .from("weekly_schedule_items")
      .select("*")
      .order("event_date", { ascending: true })
      .order("start_time", { ascending: true });
    if (error) throw error;

    return NextResponse.json({ items: data || [] });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "番組表を取得できませんでした。" },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  if (!(await isScheduleAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const item = clean(await request.json());
    const validationError = validate(item);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const supabase = getAdminScheduleSupabase();
    const { data, error } = await supabase
      .from("weekly_schedule_items")
      .insert(item)
      .select("*")
      .single();
    if (error) throw error;
    return NextResponse.json({ item: data }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "登録に失敗しました。" },
      { status: 500 }
    );
  }
}
