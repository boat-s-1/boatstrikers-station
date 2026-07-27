import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isAdminAuthenticated } from "../../../admin/sync/_lib/adminAuth";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

export async function GET(request) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const date = new URL(request.url).searchParams.get("date");
  const supabase = getSupabase();
  let query = supabase.from("bs_race_note_features").select("*").order("course_code").order("race_no");
  if (date) query = query.eq("race_date", date);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data || [] });
}

export async function POST(request) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json();
  const payload = {
    id: body.id || undefined,
    race_date: body.race_date,
    course_code: Number(body.course_code),
    race_no: Number(body.race_no),
    character_name: body.character_name || "一果",
    feature_title: body.feature_title || "詳細分析公開中",
    teaser_text: body.teaser_text || null,
    note_url: body.note_url || null,
    target_timing: body.target_timing || "both",
    is_paid: Boolean(body.is_paid),
    cta_label: body.cta_label || null,
    is_published: Boolean(body.is_published),
    is_pickup: Boolean(body.is_pickup),
    sort_order: Number(body.sort_order || 100),
    updated_at: new Date().toISOString(),
  };
  if (!payload.id) delete payload.id;
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("bs_race_note_features")
    .upsert(payload, { onConflict: "race_date,course_code,race_no" })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data });
}

export async function DELETE(request) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  const { error } = await getSupabase().from("bs_race_note_features").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
