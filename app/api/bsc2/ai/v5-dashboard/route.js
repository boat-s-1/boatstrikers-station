import { NextResponse } from "next/server";
import {
  assertAiAdminRequest,
  getAiAdminSupabase,
} from "../../../../../lib/aiAdminSupabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fail(error) {
  return NextResponse.json(
    { error: error?.message || "取得に失敗しました" },
    { status: error?.status || 500 }
  );
}

export async function GET(request) {
  try {
    assertAiAdminRequest(request);

    const { searchParams } = new URL(request.url);
    const targetDate =
      searchParams.get("date") ||
      new Date().toISOString().slice(0, 10);

    const supabase = getAiAdminSupabase();

    const [
      systemResult,
      modelsResult,
      jobsResult,
      rankingResult,
      livePerformanceResult,
      historicalPerformanceResult,
      racesCountResult,
      featuresCountResult,
    ] = await Promise.all([
      supabase
        .from("ai_system_status")
        .select("*")
        .eq("id", "main")
        .maybeSingle(),

      supabase
        .from("ai_model_versions")
        .select(`
          model_version,
          data_timing,
          model_type,
          training_race_count,
          auc,
          brier_score,
          log_loss,
          accuracy,
          calibration_error,
          is_active,
          created_at
        `)
        .eq("character", "ichika")
        .order("created_at", { ascending: false })
        .limit(30),

      supabase
        .from("ai_jobs")
        .select(`
          id,
          job_type,
          status,
          progress,
          message,
          error_message,
          created_at,
          started_at,
          completed_at,
          worker_name
        `)
        .order("created_at", { ascending: false })
        .limit(30),

      supabase
        .from("v_ai_today_ranking")
        .select("*")
        .eq("race_date", targetDate)
        .order("current_probability", { ascending: false }),

      supabase
        .from("v_ai_live_prediction_performance")
        .select("*")
        .order("data_timing"),

      supabase
        .from("ai_model_versions")
        .select(`
          model_version,
          data_timing,
          model_type,
          auc,
          brier_score,
          log_loss,
          accuracy,
          calibration_error,
          training_race_count,
          created_at
        `)
        .eq("character", "ichika")
        .order("created_at", { ascending: false })
        .limit(20),

      supabase
        .from("races")
        .select("id", { count: "exact", head: true }),

      supabase
        .from("ichika_training_features")
        .select("race_id", { count: "exact", head: true }),
    ]);

    const results = [
      systemResult,
      modelsResult,
      jobsResult,
      rankingResult,
      livePerformanceResult,
      historicalPerformanceResult,
      racesCountResult,
      featuresCountResult,
    ];

    const firstError = results.find((result) => result.error)?.error;
    if (firstError) throw firstError;

    const ranking = rankingResult.data || [];

    const summary = {
      prediction_count: ranking.length,
      ss_count: ranking.filter((row) =>
        ["SS", "S"].includes(row.current_rank)
      ).length,
      settled_count: ranking.filter(
        (row) => row.escape_success !== null
      ).length,
      correct_count: ranking.filter((row) => {
        if (row.escape_success === null) return false;
        return (
          (Number(row.current_probability) >= 0.5) ===
          Boolean(row.escape_success)
        );
      }).length,
    };

    return NextResponse.json({
      target_date: targetDate,
      system_status: systemResult.data || null,
      models: modelsResult.data || [],
      jobs: jobsResult.data || [],
      ranking,
      live_performance: livePerformanceResult.data || [],
      model_comparison: historicalPerformanceResult.data || [],
      counts: {
        races: racesCountResult.count || 0,
        training_features: featuresCountResult.count || 0,
      },
      summary,
    });
  } catch (error) {
    return fail(error);
  }
}
