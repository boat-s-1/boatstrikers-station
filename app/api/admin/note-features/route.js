import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "../../../admin/sync/_lib/adminAuth";
import { getAdminSupabase } from "../../../admin/sync/_lib/supabaseAdmin";

export async function GET(request) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const date = new URL(request.url).searchParams.get("date");
  const supabase = getAdminSupabase();
  let query = supabase.from("bs_race_note_features").select("*").order("course_code").order("race_no");
  if (date) query = query.eq("race_date", date);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(request) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json();
  const row = {
    race_date: body.race_date,
    course_code: Number(body.course_code),
    race_no: Number(body.race_no),
    character_name: String(body.character_name || "一果").trim(),
    feature_title: String(body.feature_title || "詳細分析公開中").trim(),
    teaser_text: String(body.teaser_text || "").trim() || null,
    note_url: String(body.note_url || "").trim() || null,
    is_published: Boolean(body.is_published),
    is_pickup: Boolean(body.is_pickup),
    sort_order: Number(body.sort_order || 100),
    updated_at: new Date().toISOString(),
  };
  if (!row.race_date || !row.course_code || !row.race_no) return NextResponse.json({ error: "日付・場・Rは必須です。" }, { status: 400 });
  if (row.is_published && !/^https:\/\//.test(row.note_url || "")) return NextResponse.json({ error: "公開時はhttps://から始まるnote URLが必要です。" }, { status: 400 });
  const supabase = getAdminSupabase();
  const { data, error } = await supabase.from("bs_race_note_features").upsert(row, { onConflict: "race_date,course_code,race_no" }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data });
}

export async function DELETE(request) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const { error } = await getAdminSupabase().from("bs_race_note_features").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
