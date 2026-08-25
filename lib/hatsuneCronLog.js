import { createClient } from "@supabase/supabase-js";

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase管理用環境変数が未設定です。");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function startHatsuneCronRun(jobName) {
  const supabase = getAdminSupabase();
  const { data, error } = await supabase
    .from("hatsune_news_cron_runs")
    .insert({ job_name: jobName, status: "running", started_at: new Date().toISOString() })
    .select("id,started_at")
    .single();
  if (error) throw error;
  return { supabase, run: data };
}

export async function finishHatsuneCronRun({ supabase, run, status, metrics = {}, errorMessage = null, details = {} }) {
  if (!supabase || !run?.id) return;
  const finishedAt = new Date();
  const startedAt = new Date(run.started_at || finishedAt);
  const payload = {
    status,
    finished_at: finishedAt.toISOString(),
    duration_ms: Math.max(0, finishedAt.getTime() - startedAt.getTime()),
    collected_count: Number(metrics.collected || 0),
    inserted_count: Number(metrics.inserted || 0),
    skipped_count: Number(metrics.skipped || 0),
    ai_processed_count: Number(metrics.aiProcessed || 0),
    ai_generated_count: Number(metrics.aiGenerated || 0),
    error_count: Number(metrics.errorCount || 0),
    error_message: errorMessage ? String(errorMessage).slice(0, 2000) : null,
    details,
  };
  await supabase.from("hatsune_news_cron_runs").update(payload).eq("id", run.id);
}
