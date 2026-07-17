import { NextResponse } from "next/server";
import {
  assertAiAdmin,
  getSupabaseAdmin,
} from "../_shared.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    assertAiAdmin(request);

    const { searchParams } = new URL(request.url);
    const limit = Math.min(
      100,
      Math.max(1, Number(searchParams.get("limit") || 50)),
    );
    const supabase = getSupabaseAdmin();

    const [jobsResult, summaryResult] =
      await Promise.all([
        supabase
          .from("ai_control_jobs")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(limit),
        supabase
          .from("v_ai_control_job_summary")
          .select("*")
          .single(),
      ]);

    if (jobsResult.error) throw jobsResult.error;
    if (summaryResult.error) throw summaryResult.error;

    return NextResponse.json({
      jobs: jobsResult.data || [],
      summary: summaryResult.data || null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error?.message || "ジョブ取得に失敗しました",
      },
      { status: error?.status || 500 },
    );
  }
}
