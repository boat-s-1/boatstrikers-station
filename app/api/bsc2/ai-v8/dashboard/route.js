
import { NextResponse } from "next/server";
import { assertAiAdminRequest, getAiAdminSupabase } from "../../../../../lib/aiAdminSupabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    assertAiAdminRequest(request);
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date") || new Date().toISOString().slice(0, 10);
    const supabase = getAiAdminSupabase();

    const [system, models, predictions, summary, jobs] = await Promise.all([
      supabase.from("ai_system_status").select("*").eq("id","main").maybeSingle(),
      supabase.from("v_boat_strikers_ai_latest_models").select("*"),
      supabase.from("v_ai_v8_today").select("*").eq("race_date",date).order("confidence_score",{ascending:false}),
      supabase.from("v_ai_v8_summary").select("*").eq("race_date",date).maybeSingle(),
      supabase.from("ai_jobs").select("*").order("created_at",{ascending:false}).limit(40),
    ]);

    const error = system.error || models.error || predictions.error || summary.error || jobs.error;
    if (error) throw error;

    return NextResponse.json({
      target_date: date,
      system_status: system.data || null,
      models: models.data || [],
      predictions: predictions.data || [],
      summary: summary.data || null,
      jobs: jobs.data || [],
    });
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || "取得に失敗しました" },
      { status: error?.status || 500 }
    );
  }
}
