import "server-only";
import { createClient } from "@supabase/supabase-js";

const ALERT_THEORIES = [
  { key: "kiina", table: "bs_exhibition_alerts", icon: "🚨", name: "キイナ・4→5展開理論", short: "4→5展開", href: "/admin/exhibition-alerts" },
  { key: "ichika", table: "bs_ichika_hidden_escape_alerts", icon: "🏁", name: "一果・隠れイン理論", short: "隠れイン", href: "/admin/ichika-hidden-escape" },
  { key: "hatsune", table: "bs_hatsune_womens_inner_break_alerts", icon: "🌸", name: "初音・女子イン崩れ理論", short: "女子イン崩れ", href: "/admin/hatsune-womens-inner-break" },
];

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function jstDate(value = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(value);
}

function jstToday() { return jstDate(new Date()); }

function daysAgoDate(days) {
  return jstDate(new Date(Date.now() - days * 86400000));
}

function formatJst(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

async function safeCount(client, table, date, extra = null) {
  if (!client) return null;
  try {
    let query = client.from(table).select("*", { count: "exact", head: true });
    if (date) query = query.eq("race_date", date);
    if (extra) query = extra(query);
    const { count, error } = await query;
    if (error) return null;
    return Number(count || 0);
  } catch { return null; }
}

async function safeRuntime(client) {
  if (!client) return null;
  try {
    const { data, error } = await client.from("bs_sync_runtime")
      .select("state,last_success_at,heartbeat_at,last_status,last_error,current_mode,current_target_date")
      .eq("id", 1).maybeSingle();
    if (error) return null;
    return data || null;
  } catch { return null; }
}

async function safeTheorySummary(client, theory, today, sinceDate) {
  if (!client) return { ...theory, today: null, notified: null, last30: null, recent: [] };
  try {
    const [todayCount, notifiedCount, last30Count, recentResult] = await Promise.all([
      safeCount(client, theory.table, today),
      safeCount(client, theory.table, today, (q) => q.eq("notified", true)),
      safeCount(client, theory.table, null, (q) => q.gte("race_date", sinceDate)),
      client.from(theory.table)
        .select("race_date,course_code,course_name,race_no,detected_at,notified,notified_at")
        .order("detected_at", { ascending: false })
        .limit(5),
    ]);
    return {
      ...theory,
      today: todayCount,
      notified: notifiedCount,
      last30: last30Count,
      recent: recentResult.error ? [] : (recentResult.data || []).map((row) => ({ ...row, theoryKey: theory.key, theoryName: theory.short, icon: theory.icon, href: theory.href })),
    };
  } catch {
    return { ...theory, today: null, notified: null, last30: null, recent: [] };
  }
}

async function loadStatus() {
  const client = getClient();
  const today = jstToday();
  const since30 = daysAgoDate(29);
  if (!client) return { today, events: null, predictions: null, results: null, hits: null, runtime: null, theories: [], recentAlerts: [] };
  const [events, predictions, results, hits, runtime, ...theories] = await Promise.all([
    safeCount(client, "bs_race_events", today),
    safeCount(client, "bs_ai_predictions", today),
    safeCount(client, "bs_race_results", today),
    safeCount(client, "bs_ai_bet_results", today, (query) => query.eq("is_hit", true)),
    safeRuntime(client),
    ...ALERT_THEORIES.map((theory) => safeTheorySummary(client, theory, today, since30)),
  ]);
  const recentAlerts = theories.flatMap((x) => x.recent || [])
    .sort((a, b) => new Date(b.detected_at || 0).getTime() - new Date(a.detected_at || 0).getTime())
    .slice(0, 5);
  return { today, events, predictions, results, hits, runtime, theories, recentAlerts };
}

function statusText(runtime) {
  const state = String(runtime?.state || "").toLowerCase();
  if (state === "running") return "実行中";
  if (state === "error" || runtime?.last_error) return "要確認";
  if (state === "idle") return "正常";
  return runtime ? "待機中" : "未取得";
}

function statusTone(runtime) {
  const state = String(runtime?.state || "").toLowerCase();
  if (state === "error" || runtime?.last_error) return "danger";
  if (state === "running") return "running";
  if (state === "idle") return "good";
  return "neutral";
}

function buildAlerts(status) {
  const alerts = [];
  if (status.runtime?.last_error) alerts.push({ tone: "danger", icon: "⚠️", title: "AutoSyncでエラーを検出", text: String(status.runtime.last_error).slice(0, 100), href: "/admin/sync" });
  if (Number.isFinite(status.events) && status.events > 0 && Number.isFinite(status.predictions) && status.predictions === 0) alerts.push({ tone: "warning", icon: "⚠️", title: "本日のAI予想がまだありません", text: `${status.events}Rの開催データに対してAI予想0件です。`, href: "/admin/sync" });
  if (Number.isFinite(status.events) && Number.isFinite(status.results) && status.events > 0 && status.results > status.events) alerts.push({ tone: "warning", icon: "⚠️", title: "結果件数を確認してください", text: `開催${status.events}Rに対して結果${status.results}Rです。`, href: "/admin/sync" });
  if (alerts.length === 0) alerts.push({ tone: "good", icon: "✅", title: "大きな要対応はありません", text: "システムは大きな問題なく動いています。", href: null });
  return alerts;
}

function countText(value, suffix = "件") {
  return value === null || value === undefined ? "—" : `${value}${suffix}`;
}


export { loadStatus, buildAlerts, statusTone, statusText, formatJst, countText };

