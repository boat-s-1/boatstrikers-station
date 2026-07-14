import crypto from "crypto";
import { NextResponse } from "next/server";
import {
  assertAiAdminRequest,
  getAiAdminSupabase,
} from "../../../../../lib/aiAdminSupabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TYPE_CONFIG = {
  training_csv: {
    jobType: "import_training_csv",
    folder: "training",
  },
  previous_day_csv: {
    jobType: "run_previous_day",
    folder: "previous-day",
  },
  after_exhibition_csv: {
    jobType: "run_after_exhibition",
    folder: "after-exhibition",
  },
};

function sanitizeFilename(name) {
  return name
    .normalize("NFKC")
    .replace(/[^\w.\-]+/g, "_")
    .replace(/_+/g, "_");
}

function errorResponse(error) {
  return NextResponse.json(
    {
      error: error?.message || "アップロードに失敗しました",
    },
    {
      status: error?.status || 500,
    }
  );
}

export async function POST(request) {
  try {
    assertAiAdminRequest(request);

    const formData = await request.formData();
    const file = formData.get("file");
    const fileType = String(formData.get("file_type") || "");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "CSVファイルを選択してください" },
        { status: 400 }
      );
    }

    const config = TYPE_CONFIG[fileType];

    if (!config) {
      return NextResponse.json(
        { error: "CSV種別が不正です" },
        { status: 400 }
      );
    }

    if (!file.name.toLowerCase().endsWith(".csv")) {
      return NextResponse.json(
        { error: "CSVファイルのみアップロードできます" },
        { status: 400 }
      );
    }

    const maxSize = 50 * 1024 * 1024;

    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "CSVサイズは50MB以下にしてください" },
        { status: 400 }
      );
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const hash = crypto.createHash("sha256").update(bytes).digest("hex");
    const filename = sanitizeFilename(file.name);
    const storagePath =
      `${config.folder}/` +
      `${new Date().toISOString().slice(0, 10)}/` +
      `${Date.now()}-${hash.slice(0, 12)}-${filename}`;

    const supabase = getAiAdminSupabase();

    const { error: storageError } = await supabase.storage
      .from("bsc-ai-csv")
      .upload(storagePath, bytes, {
        contentType: file.type || "text/csv",
        upsert: false,
      });

    if (storageError) throw storageError;

    const { data: fileRow, error: fileError } = await supabase
      .from("ai_uploaded_files")
      .insert({
        original_name: file.name,
        storage_bucket: "bsc-ai-csv",
        storage_path: storagePath,
        file_type: fileType,
        file_size: file.size,
        sha256: hash,
        status: "uploaded",
      })
      .select()
      .single();

    if (fileError) throw fileError;

    const { data: jobRow, error: jobError } = await supabase
      .from("ai_jobs")
      .insert({
        job_type: config.jobType,
        file_id: fileRow.id,
        status: "pending",
        progress: 0,
        requested_by: "bsc-ai-admin",
        message: "CSVアップロード完了・実行待ち",
        parameters: {
          original_name: file.name,
        },
      })
      .select()
      .single();

    if (jobError) throw jobError;

    return NextResponse.json({
      file: fileRow,
      job: jobRow,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
