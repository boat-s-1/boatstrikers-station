import { NextResponse } from "next/server";
import {
  assertAiAdminRequest,
  getAiAdminSupabase,
} from "../../../../../lib/aiAdminSupabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_JOB_TYPES = new Set([
  "generate_features",
  "train_ichika_v3",
  "predict_history_v3",
  "run_training_all",
  "predict_previous_day",
  "predict_after_exhibition",
]);

function errorResponse(error) {
  return NextResponse.json(
    {
      error: error?.message || "処理に失敗しました",
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

    const { data, error } = await supabase
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
        worker_name,
        file_id,
        ai_uploaded_files (
          original_name,
          file_type,
          status
        )
      `)
      .order("created_at", { ascending: false })
      .limit(30);

    if (error) throw error;

    return NextResponse.json({
      jobs: data || [],
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request) {
  try {
    assertAiAdminRequest(request);

    const body = await request.json();
    const jobType = String(body?.job_type || "");

    if (!ALLOWED_JOB_TYPES.has(jobType)) {
      return NextResponse.json(
        { error: "許可されていないジョブです" },
        { status: 400 }
      );
    }

    const supabase = getAiAdminSupabase();

    const { data, error } = await supabase
      .from("ai_jobs")
      .insert({
        job_type: jobType,
        status: "pending",
        progress: 0,
        parameters: body?.parameters || {},
        requested_by: "bsc-ai-admin",
        message: "実行待ち",
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      job: data,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
