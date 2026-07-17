import { NextResponse } from "next/server";
import {
  assertAiAdmin,
  getSupabaseAdmin,
} from "../_shared.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_JOB_TYPES = new Set([
  "history_import",
  "previous_day_prediction",
  "after_exhibition_prediction",
  "full_pipeline",
]);

export async function POST(request) {
  try {
    assertAiAdmin(request);

    const body = await request.json();

    const jobType = String(body.jobType || "");
    const raceDate = String(body.raceDate || "") || null;
    const sourceFilename = String(
      body.sourceFilename || "upload.csv",
    );
    const storagePath = String(body.storagePath || "");

    if (!ALLOWED_JOB_TYPES.has(jobType)) {
      return NextResponse.json(
        { error: "未対応の処理種類です" },
        { status: 400 },
      );
    }

    if (!storagePath) {
      return NextResponse.json(
        { error: "storagePathが必要です" },
        { status: 400 },
      );
    }

    const supabase = getSupabaseAdmin();

    const { data: files, error: listError } =
      await supabase.storage
        .from("bsc-ai-csv")
        .list(
          storagePath.substring(
            0,
            storagePath.lastIndexOf("/"),
          ),
          {
            search: storagePath.split("/").pop(),
            limit: 1,
          },
        );

    if (listError) {
      throw listError;
    }

    if (!files?.length) {
      return NextResponse.json(
        {
          error:
            "Supabase StorageにCSVが見つかりません",
        },
        { status: 400 },
      );
    }

    const { data: job, error: jobError } =
      await supabase
        .from("ai_control_jobs")
        .insert({
          job_type: jobType,
          status: "queued",
          source_filename: sourceFilename,
          storage_bucket: "bsc-ai-csv",
          storage_path: storagePath,
          race_date: raceDate,
          options: {
            run_calibration:
              body.runCalibration !== false,
            run_diagnosis:
              body.runDiagnosis !== false,
          },
          progress_percent: 0,
          progress_message:
            "Workerの実行待ちです",
        })
        .select("*")
        .single();

    if (jobError) {
      throw jobError;
    }

    return NextResponse.json({ job });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error?.message ||
          "処理ジョブの登録に失敗しました",
      },
      {
        status: error?.status || 500,
      },
    );
  }
}
