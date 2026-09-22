import "server-only";
import { createClient } from "@supabase/supabase-js";

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase service role environment variables are missing.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function jstDateString(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(date);
}

export function jstYesterdayString(now = new Date()) {
  const today = jstDateString(now);
  const base = new Date(`${today}T12:00:00+09:00`);
  base.setUTCDate(base.getUTCDate() - 1);
  return jstDateString(base);
}

export async function refreshHatsuneKiinaAiAnalysis({ date = jstYesterdayString(), windowDays = 30 } = {}) {
  const targetDate = String(date || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) throw new Error("date must be YYYY-MM-DD.");
  const days = Number(windowDays);
  if (!Number.isInteger(days) || days < 1 || days > 365) throw new Error("windowDays must be between 1 and 365.");

  const supabase = getClient();
  const { data, error } = await supabase.rpc("refresh_hatsune_kiina_ai_analysis", {
    p_target_date: targetDate,
    p_window_days: days,
  });
  if (error) throw new Error(`初音・キイナAI分析の更新に失敗しました: ${error.message}`);
  return { ok: true, refresh: data };
}

export async function loadCharacterAiAnalysis(characterCode, windowDays = 30) {
  if (!["hatsune", "kiina"].includes(characterCode)) throw new Error("unsupported character");
  const supabase = getClient();

  const { data: latest, error: latestError } = await supabase
    .from("bs_character_ai_analysis_metrics")
    .select("analysis_date")
    .eq("character_code", characterCode)
    .order("analysis_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestError || !latest?.analysis_date) {
    return { rows: [], latestDate: null, error: latestError?.message || "分析データがまだありません。" };
  }

  const { data, error } = await supabase
    .from("bs_character_ai_analysis_metrics")
    .select("analysis_date,window_days,period_start,period_end,character_code,timing,metric,bucket,races,tickets,hits,hit_rate,recovery_rate,avg_tickets,sample_sufficient,generated_at")
    .eq("analysis_date", latest.analysis_date)
    .eq("window_days", windowDays)
    .eq("character_code", characterCode)
    .order("metric", { ascending: true })
    .order("bucket", { ascending: true });

  return { rows: data || [], latestDate: latest.analysis_date, error: error?.message || null };
}
