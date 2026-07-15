import { NextResponse } from "next/server";
import {
  assertAiAdminRequest,
  getAiAdminSupabase,
} from "../../../../../lib/aiAdminSupabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    assertAiAdminRequest(request);
    const supabase = getAiAdminSupabase();

    const [characters, models, summary, system, jobs] = await Promise.all([
      supabase.from("ai_characters").select("*").order("character_code"),
      supabase.from("v_boat_strikers_ai_latest_models").select("*"),
      supabase.from("v_boat_strikers_ai_summary").select("*"),
      supabase.from("ai_system_status").select("*").eq("id","main").maybeSingle(),
      supabase.from("ai_jobs").select("*").order("created_at",{ascending:false}).limit(30),
    ]);

    const error =
      characters.error ||
      models.error ||
      summary.error ||
      system.error ||
      jobs.error;

    if (error) throw error;

    return NextResponse.json({
      characters: characters.data || [],
      models: models.data || [],
      summary: summary.data || [],
      system_status: system.data || null,
      jobs: jobs.data || [],
    });
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || "取得に失敗しました" },
      { status: error?.status || 500 }
    );
  }
}
