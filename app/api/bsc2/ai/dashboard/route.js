import { NextResponse } from "next/server";
import {
  assertAiAdminRequest,
  getAiAdminSupabase,
} from "../../../../../lib/aiAdminSupabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(error) {
  return NextResponse.json(
    {
      error: error?.message || "取得に失敗しました",
    },
    {
      status: error?.status || 500,
    }
  );
}

export async function GET(request) {
  try {
    assertAiAdminRequest(request);
    const supabase = getAiAdminSupabase();

    const [
      statusResult,
      modelsResult,
      jobsResult,
      predictionsResult,
      featuresCountResult,
      racesCountResult,
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
        .eq("is_active", true)
        .order("created_at", { ascending: false }),

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
        .limit(15),

      supabase
        .from("ichika_live_predictions")
        .select(`
          id,
          data_timing,
          model_version,
          calibrated_probability,
          confidence_rank,
          positive_factors,
          negative_factors,
          generated_at,
          upcoming_races (
            race_date,
            stadium_code,
            race_no
          )
        `)
        .order("generated_at", { ascending: false })
        .limit(100),

      supabase
        .from("ichika_training_features")
        .select("race_id", { count: "exact", head: true }),

      supabase
        .from("races")
        .select("id", { count: "exact", head: true }),
    ]);

    const errors = [
      statusResult.error,
      modelsResult.error,
      jobsResult.error,
      predictionsResult.error,
      featuresCountResult.error,
      racesCountResult.error,
    ].filter(Boolean);

    if (errors.length > 0) {
      throw errors[0];
    }

    return NextResponse.json({
      system_status: statusResult.data || null,
      models: modelsResult.data || [],
      jobs: jobsResult.data || [],
      predictions: predictionsResult.data || [],
      counts: {
        training_features: featuresCountResult.count || 0,
        races: racesCountResult.count || 0,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
