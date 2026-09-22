import "server-only";
import { createClient } from "@supabase/supabase-js";

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Supabase service role environment variables are missing.");
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function jstDateString(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function jstYesterdayString(now = new Date()) {
  const today = jstDateString(now);
  const base = new Date(`${today}T12:00:00+09:00`);
  base.setUTCDate(base.getUTCDate() - 1);
  return jstDateString(base);
}

function normalizeDate(value) {
  const text = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw new Error("date must be YYYY-MM-DD.");
  }
  return text;
}

function normalizeWindowDays(value) {
  const n = Number(value ?? 30);
  if (!Number.isInteger(n) || n < 1 || n > 365) {
    throw new Error("windowDays must be an integer between 1 and 365.");
  }
  return n;
}

export async function refreshIchikaAiAnalysis({
  date = jstYesterdayString(),
  windowDays = 30,
} = {}) {
  const targetDate = normalizeDate(date);
  const days = normalizeWindowDays(windowDays);
  const supabase = getClient();

  const { data: refreshResult, error: refreshError } = await supabase.rpc(
    "refresh_ichika_ai_analysis",
    {
      p_target_date: targetDate,
      p_window_days: days,
    },
  );

  if (refreshError) {
    throw new Error(`一果AI分析の更新に失敗しました: ${refreshError.message}`);
  }

  const { data: metrics, error: metricsError } = await supabase
    .from("bs_ichika_ai_analysis_metrics")
    .select(
      "analysis_date,window_days,period_start,period_end,timing,metric,bucket,races,tickets,hits,hit_rate,recovery_rate,avg_tickets,sample_sufficient,generated_at",
    )
    .eq("analysis_date", targetDate)
    .eq("window_days", days)
    .order("metric", { ascending: true })
    .order("timing", { ascending: true })
    .order("bucket", { ascending: true });

  if (metricsError) {
    throw new Error(`一果AI分析結果の取得に失敗しました: ${metricsError.message}`);
  }

  return {
    ok: true,
    refresh: refreshResult,
    metrics: metrics || [],
  };
}
