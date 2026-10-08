import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isAdminAuthenticated } from "../../../admin/sync/_lib/adminAuth";
import { newspaperSlug } from "../../../../lib/newspaperContent";

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase管理接続が未設定です");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function GET(request) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const search = new URL(request.url).searchParams;
  let query = db().from("bs_newspaper_publications").select("*").order("race_date", { ascending: false }).order("updated_at", { ascending: false }).limit(100);
  if (search.get("date")) query = query.eq("race_date", search.get("date"));
  if (search.get("character")) query = query.eq("character_key", search.get("character"));
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data || [] });
}

export async function POST(request) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json();
  const required = ["date", "course", "raceNo", "character", "edition", "title"];
  if (required.some((key) => !body[key])) return NextResponse.json({ error: "新聞の必須情報が不足しています" }, { status: 400 });
  const status = ["draft", "published", "archived"].includes(body.status) ? body.status : "draft";
  const payload = {
    slug: newspaperSlug(body), race_date: body.date, course_name: body.course, race_no: Number(body.raceNo),
    character_key: body.character, edition: body.edition, title: body.title,
    summary: body.summary || null, article_body: body.articleBody || null, image_url: body.imageUrl || null,
    note_title: body.noteTitle || null, note_body: body.noteBody || null, note_url: body.noteUrl || null,
    x_post: body.xPost || null, shorts_script: body.shortsScript || null,
    source_payload: body.sourcePayload || {}, status,
    published_at: status === "published" ? (body.publishedAt || new Date().toISOString()) : null,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await db().from("bs_newspaper_publications").upsert(payload, { onConflict: "race_date,course_name,race_no,character_key,edition" }).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data });
}
