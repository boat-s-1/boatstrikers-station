import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function jstToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function formatTime(value) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("ja-JP", {
      timeZone: "Asia/Tokyo",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(value));
  } catch {
    return String(value).slice(0, 5);
  }
}

export default async function IchikaAlertPanel() {
  const supabase = getSupabase();
  let alerts = [];

  if (supabase) {
    const { data, error } = await supabase
      .from("bs_ichika_hidden_escape_alerts")
      .select("id,race_date,course_code,course_name,race_no,closing_time,racer_class,exhibition_rank,exhibition_gap,lap_rank,detected_at,notified")
      .eq("race_date", jstToday())
      .order("closing_time", { ascending: true })
      .limit(12);

    if (!error) alerts = data || [];
  }

  return (
    <section style={{ margin: "18px 14px", borderRadius: 24, overflow: "hidden", background: "#fff", boxShadow: "0 8px 24px rgba(0,0,0,.10)", border: "2px solid #ff7eaa" }}>
      <div style={{ padding: "16px 18px", background: "linear-gradient(135deg,#fff0f6,#eef8ff)", borderBottom: "1px solid #f4d5e2" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: ".08em", color: "#ff4f93" }}>ICHIKA ALERT</div>
            <h2 style={{ margin: "4px 0 0", fontSize: 23, color: "#17345c" }}>🏁 一果アラート｜隠れイン理論</h2>
          </div>
          <span style={{ flex: "0 0 auto", fontSize: 12, fontWeight: 900, padding: "7px 10px", borderRadius: 999, background: alerts.length ? "#e7fff0" : "#eef2f6", color: alerts.length ? "#0b8f49" : "#64748b" }}>
            本日 {alerts.length}件
          </span>
        </div>
        <p style={{ margin: "8px 0 0", fontSize: 13, fontWeight: 700, color: "#637086", lineHeight: 1.6 }}>
          B1 × 展示色なし × 1周1位。展示後に一果の狙い目条件が成立したレースを表示します。
        </p>
      </div>

      {alerts.length ? (
        <div style={{ padding: 14, display: "grid", gap: 10 }}>
          {alerts.map((alert) => (
            <article key={alert.id} style={{ border: "1px solid #f0d9e3", borderRadius: 17, padding: 14, background: "#fffafd" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                <div style={{ fontSize: 20, fontWeight: 900, color: "#17345c" }}>
                  {alert.course_name || `${alert.course_code}場`} {alert.race_no}R
                </div>
                <span style={{ fontSize: 12, fontWeight: 900, background: "#ffedf4", color: "#e83e7e", padding: "6px 9px", borderRadius: 999 }}>
                  条件成立
                </span>
              </div>
              <div style={{ marginTop: 9, display: "flex", flexWrap: "wrap", gap: 7, fontSize: 12, fontWeight: 800, color: "#526079" }}>
                <span style={{ padding: "6px 9px", borderRadius: 10, background: "#f3f6fa" }}>{alert.racer_class || "B1"}</span>
                <span style={{ padding: "6px 9px", borderRadius: 10, background: "#f3f6fa" }}>展示 {alert.exhibition_rank || "3〜4"}位</span>
                <span style={{ padding: "6px 9px", borderRadius: 10, background: "#f3f6fa" }}>トップ差 {alert.exhibition_gap != null ? Number(alert.exhibition_gap).toFixed(2) : "0.03以内"}秒</span>
                <span style={{ padding: "6px 9px", borderRadius: 10, background: "#f3f6fa" }}>1周 {alert.lap_rank || 1}位</span>
              </div>
              <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                <strong style={{ fontSize: 14, color: "#17345c" }}>締切 {formatTime(alert.closing_time)}</strong>
                <Link href="/races" style={{ fontSize: 13, fontWeight: 900, color: "#1266b3", textDecoration: "none" }}>
                  出走表を見る →
                </Link>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div style={{ padding: "24px 18px", textAlign: "center" }}>
          <div style={{ fontSize: 30 }}>🏁</div>
          <strong style={{ display: "block", marginTop: 6, color: "#17345c" }}>現在、条件成立レースはありません</strong>
          <p style={{ margin: "7px 0 0", fontSize: 13, color: "#718096", lineHeight: 1.6 }}>
            展示情報が出た後、隠れイン条件が成立するとここに表示されます。
          </p>
        </div>
      )}

      <div style={{ padding: "0 14px 16px" }}>
        <Link href="/members" style={{ display: "block", textAlign: "center", textDecoration: "none", padding: "12px 14px", borderRadius: 14, background: "#06c755", color: "#fff", fontWeight: 900, fontSize: 14 }}>
          LINEで成立時に通知を受け取る →
        </Link>
      </div>
    </section>
  );
}
