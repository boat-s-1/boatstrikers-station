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

function formatDate(value) {
  if (!value) return "—";
  return String(value).replaceAll("-", "/");
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

function raceKey(row) {
  return `${row.race_date}-${Number(row.course_code)}-${Number(row.race_no)}`;
}

async function getAlertPerformance(supabase) {
  if (!supabase) {
    return { matched: 0, finished: 0, hits: 0, hitRate: null };
  }

  const { data: history, error: historyError } = await supabase
    .from("bs_ichika_hidden_escape_alerts")
    .select("race_date,course_code,race_no")
    .order("race_date", { ascending: false })
    .limit(5000);

  if (historyError || !history?.length) {
    return { matched: history?.length || 0, finished: 0, hits: 0, hitRate: null };
  }

  const dates = history.map((row) => row.race_date).filter(Boolean).sort();
  const minDate = dates[0];
  const maxDate = dates[dates.length - 1];

  const { data: entries, error: entryError } = await supabase
    .from("bs_race_entries")
    .select("race_date,course_code,race_no,boat_no,arrival_order")
    .eq("boat_no", 1)
    .gte("race_date", minDate)
    .lte("race_date", maxDate);

  if (entryError) {
    return { matched: history.length, finished: 0, hits: 0, hitRate: null };
  }

  const resultMap = new Map((entries || []).map((row) => [raceKey(row), Number(row.arrival_order)]));
  const results = history
    .map((row) => resultMap.get(raceKey(row)))
    .filter((rank) => Number.isFinite(rank) && rank > 0);
  const hits = results.filter((rank) => rank === 1).length;

  return {
    matched: history.length,
    finished: results.length,
    hits,
    hitRate: results.length ? (hits / results.length) * 100 : null,
  };
}

export default async function IchikaAlertPanel() {
  const supabase = getSupabase();
  const today = jstToday();
  let alerts = [];

  if (supabase) {
    const { data, error } = await supabase
      .from("bs_ichika_hidden_escape_alerts")
      .select("id,race_date,course_code,course_name,race_no,closing_time,racer_class,exhibition_rank,exhibition_gap,lap_rank,detected_at,notified")
      .eq("race_date", today)
      .order("closing_time", { ascending: true })
      .limit(12);

    if (!error) alerts = data || [];
  }

  const performance = await getAlertPerformance(supabase);

  return (
    <section style={{ margin: "18px 14px", borderRadius: 24, overflow: "hidden", background: "#fff", boxShadow: "0 8px 24px rgba(0,0,0,.10)", border: "2px solid #ff7eaa" }}>
      <div style={{ position: "relative", overflow: "hidden", background: "#f7fbff" }}>
        <img
          src="/E8FA3EF7-0B20-4135-AD2D-6C592E64FCDA.png?v=20260827-0503"
          alt="一果アラート 隠れイン理論"
          style={{ display: "block", width: "100%", height: "auto" }}
        />
        <span style={{ position: "absolute", top: 10, right: 10, padding: "7px 11px", borderRadius: 999, background: "rgba(255,255,255,.94)", color: "#526079", fontSize: 12, fontWeight: 900, boxShadow: "0 2px 8px rgba(0,0,0,.10)" }}>
          {formatDate(today)}
        </span>
      </div>

      <div style={{ padding: "14px 14px 4px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div style={{ padding: "14px 12px", borderRadius: 16, background: "linear-gradient(180deg,#fff1f7,#fff)", border: "1px solid #ffd3e3", textAlign: "center" }}>
            <span style={{ display: "block", fontSize: 12, fontWeight: 900, color: "#e83e7e" }}>隠れイン的中率</span>
            <strong style={{ display: "block", marginTop: 4, fontSize: 30, lineHeight: 1.1, color: "#e83e7e" }}>
              {performance.hitRate == null ? "—%" : `${performance.hitRate.toFixed(1)}%`}
            </strong>
            <small style={{ display: "block", marginTop: 5, color: "#718096", fontWeight: 800 }}>
              {performance.finished > 0 ? `${performance.hits} / ${performance.finished}R 的中` : "結果データ蓄積中"}
            </small>
          </div>

          <div style={{ padding: "14px 12px", borderRadius: 16, background: "linear-gradient(180deg,#eef8ff,#fff)", border: "1px solid #cfe9fb", textAlign: "center" }}>
            <span style={{ display: "block", fontSize: 12, fontWeight: 900, color: "#1266b3" }}>本日の成立</span>
            <strong style={{ display: "block", marginTop: 4, fontSize: 30, lineHeight: 1.1, color: "#1266b3" }}>
              {alerts.length}件
            </strong>
            <small style={{ display: "block", marginTop: 5, color: "#718096", fontWeight: 800 }}>
              B1 × 展示色なし × 1周1位
            </small>
          </div>
        </div>
        <p style={{ margin: "10px 2px 4px", fontSize: 12, color: "#7b8798", lineHeight: 1.6 }}>
          ※的中率は隠れイン理論が成立し、結果が確定したレースで①が1着だった割合です。
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
        <div style={{ padding: "20px 18px 22px", textAlign: "center" }}>
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
