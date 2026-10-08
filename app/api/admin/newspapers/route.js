import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isAdminAuthenticated } from "../../../admin/sync/_lib/adminAuth";
import { NEWSPAPER_TABLE, saveNewspaperPublication } from "../../../../lib/newspaper/publicationStore.mjs";

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase管理接続が未設定です");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function GET(request) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const search = new URL(request.url).searchParams;
  let query = db().from(NEWSPAPER_TABLE).select("*").order("race_date", { ascending: false }).order("updated_at", { ascending: false }).limit(100);
  if (search.get("date")) query = query.eq("race_date", search.get("date"));
  if (search.get("character")) query = query.eq("character_key", search.get("character"));
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data || [] });
}

// 公開済み新聞は通常の保存では変更しない（409 published_exists）。
// 変更する場合は confirmPublishedUpdate: true と、取得時の updated_at（expectedUpdatedAt）が必要。
export async function POST(request) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json();
  const { status, body: responseBody } = await saveNewspaperPublication(db(), body);
  return NextResponse.json(responseBody, { status });
}
