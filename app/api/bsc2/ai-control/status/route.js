import { NextResponse } from "next/server";
import { assertAiAdmin, getSupabaseAdmin } from "../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    assertAiAdmin(request);

    const supabase = getSupabaseAdmin();

    const [
      historyResult,
      upcomingResult,
      diagnosisResult,
      modelResult,
    ] = await Promise.all([
      supabase
        .from("ai_predictions")
        .select("*", { count: "exact", head: true })
        .eq("race_source", "history"),
      supabase
        .from("ai_predictions")
        .select("*", { count: "exact", head: true })
        .eq("race_source", "upcoming"),
      supabase
        .from("v_ai_latest_diagnoses_v3")
        .select("race_date")
        .order("race_date", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("v_ai_active_calibration_models")
        .select("character_code,data_timing,calibration_method,created_at")
        .order("created_at", { ascending: false }),
    ]);

    for (const result of [
      historyResult,
      upcomingResult,
      diagnosisResult,
      modelResult,
    ]) {
      if (result.error) throw result.error;
    }

    return NextResponse.json({
      predictionCounts: {
        history: historyResult.count || 0,
        upcoming: upcomingResult.count || 0,
      },
      latestDiagnosisDate: diagnosisResult.data?.race_date || null,
      calibrationModels: modelResult.data || [],
    });
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || "AI状態取得に失敗しました" },
      { status: error?.status || 500 },
    );
  }
}
