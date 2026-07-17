import { NextResponse } from "next/server";
import { assertAiAdmin, getSupabaseAdmin } from "../_shared.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    assertAiAdmin(request);
    const supabase = getSupabaseAdmin();

    const [workersResult, historyResult, upcomingResult, diagnosisResult] = await Promise.all([
      supabase.from("v_ai_worker_health_v14").select("*").order("last_seen_at", { ascending: false }),
      supabase.from("ai_predictions").select("*", { count: "exact", head: true }).eq("race_source", "history"),
      supabase.from("ai_predictions").select("*", { count: "exact", head: true }).eq("race_source", "upcoming"),
      supabase.from("v_ai_latest_diagnoses_v3").select("race_date").order("race_date", { ascending: false }).limit(1).maybeSingle(),
    ]);

    for (const result of [workersResult, historyResult, upcomingResult, diagnosisResult]) {
      if (result.error) throw result.error;
    }

    return NextResponse.json({
      workers: workersResult.data || [],
      predictionCounts: { history: historyResult.count || 0, upcoming: upcomingResult.count || 0 },
      latestDiagnosisDate: diagnosisResult.data?.race_date || null,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || "状態取得に失敗しました" },
      { status: error?.status || 500 },
    );
  }
}
