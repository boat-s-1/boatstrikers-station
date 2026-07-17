import { NextResponse } from "next/server";
import { assertAdmin, getSupabaseAdmin } from "../_shared.js";
export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    assertAdmin(request);
    const { searchParams } = new URL(request.url);
    const character = searchParams.get("character");
    const timing = searchParams.get("timing");
    let query = getSupabaseAdmin().from("ai_model_registry").select("*").order("created_at",{ascending:false});
    if (character && character !== "all") query = query.eq("character_code", character);
    if (timing && timing !== "all") query = query.eq("data_timing", timing);
    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ models: data || [] });
  } catch (error) {
    return NextResponse.json({ error: error.message || "モデル取得に失敗しました" }, { status: error.status || 500 });
  }
}
