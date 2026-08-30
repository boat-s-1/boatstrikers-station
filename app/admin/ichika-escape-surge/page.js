import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function todayJst() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function raceKey(row) {
  return `${row.race_date}-${Number(row.course_code)}-${Number(row.race_no)}`;
}

async function loadData() {
  const supabase = getSupabase();
  if (!supabase) return { alerts: [], stats: { matched: 0, finished: 0, first: 0, rate: null }, recipients: 0, error: "Supabase未接続" };

  const [alertsResult, prefsResult] = await Promise.all([
    supabase
      .from("bs_ichika_escape_surge_alerts")
      .select("id,race_date,course_code,course_name,race_no,closing_time,exhibition_time,lap_time,recommended_second_boat,recommended_second_national_win_rate,baseline_win_rate,signal_win_rate,uplift_points,detected_at,notified,notified_at")
      .order("race_date", { ascending: false })
      .order("closing_time", { ascending: false })
      .limit(5000),
    supabase
      .from("bs_member_notification_preferences")
      .select("user_id", { count: "exact", head: true })
      .eq("ichika_escape_surge", true),
  ]);

  if (alertsResult.error) return { alerts: [], stats: { matched: 0, finished: 0, first: 0, rate: null }, recipients: 0, error: alertsResult.error.message };
  const rows = alertsResult.data || [];
  const recipients = Number(prefsResult.count || 0);
  if (!rows.length) return { alerts: [], stats: { matched: 0, finished: 0, first: 0, rate: null }, recipients, error: "" };

  const dates = rows.map((x) => x.race_date).sort();
  const { data: results } = await supabase
    .from("bs_race_entries")
    .select("race_date,course_code,race_no,boat_no,arrival_order")
    .eq("boat_no", 1)
    .gte("race_date", dates[0])
    .lte("race_date", dates[dates.length - 1]);
  const map = new Map((results || []).map((x) => [raceKey(x), Number(x.arrival_order)]));
  const finished = rows.map((x) => map.get(raceKey(x))).filter((x) => Number.isFinite(x) && x > 0);
  const first = finished.filter((x) => x === 1).length;
  return { alerts: rows, stats: { matched: rows.length, finished: finished.length, first, rate: finished.length ? first / finished.length : null }, recipients, error: "" };
}

const card = { border: "1px solid #f0d9b5", borderRadius: 18, background: "#fff", padding: 18 };
const td = { padding: "11px 8px", borderBottom: "1px solid #eef2f6", fontSize: 14, whiteSpace: "nowrap" };

export default async function IchikaEscapeSurgeAdminPage() {
  const { alerts, stats, recipients, error } = await loadData();
  const today = todayJst();
  const todayAlerts = alerts.filter((x) => x.race_date === today);
  const todaySent = todayAlerts.filter((x) => x.notified).length;
  const todayPending = todayAlerts.filter((x) => !x.notified).length;

  return (
    <main style={{ minHeight: "100vh", background: "#fff9ef", padding: "28px 16px 56px", color: "#102033" }}>
      <div style={{ maxWidth: 1120, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "flex-start", flexWrap: "wrap", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 900, letterSpacing: ".12em", color: "#e56a00" }}>BOATSTRIKERS / ICHIKA ALERT</div>
            <h1 style={{ margin: "6px 0 8px", fontSize: 30 }}>🔥 一果・イン逃げ急上昇アラート</h1>
            <p style={{ margin: 0, color: "#617184" }}>①号艇が展示1位＋一周1位になったレースを自動検出。おすすめ2着は2〜6号艇の全国勝率トップです。</p>
          </div>
          <Link href="/admin/alerts" style={{ textDecoration: "none", padding: "11px 14px", borderRadius: 12, border: "1px solid #efc889", background: "#fff", color: "#8a5200", fontWeight: 900 }}>← アラート管理</Link>
        </div>

        <section style={{ ...card, marginBottom: 20, background: "linear-gradient(135deg,#fff4dc,#fff)" }}>
          <div style={{ fontWeight: 900, marginBottom: 8 }}>成立条件・表示ルール</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {["① 展示タイム1位", "① 一周タイム1位", "研究値 51.70% → 66.36%", "通常比 約+14.66pt", "2着おすすめ＝②〜⑥の全国勝率トップ", "LINE通知は2分ごとに送信確認"].map((x) => (
              <span key={x} style={{ padding: "7px 10px", borderRadius: 999, background: "#fff0d2", color: "#955500", fontSize: 13, fontWeight: 900 }}>{x}</span>
            ))}
          </div>
        </section>

        {error ? <div style={{ ...card, borderColor: "#f0b7b7", color: "#a12", marginBottom: 16 }}>{error}</div> : null}

        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginBottom: 20 }}>
          <div style={card}><div style={{ color: "#718096", fontSize: 13 }}>本日成立</div><strong style={{ fontSize: 30 }}>{todayAlerts.length}R</strong></div>
          <div style={card}><div style={{ color: "#718096", fontSize: 13 }}>本日通知済み</div><strong style={{ fontSize: 30, color: "#16833d" }}>{todaySent}R</strong></div>
          <div style={card}><div style={{ color: "#718096", fontSize: 13 }}>通知待ち</div><strong style={{ fontSize: 30, color: todayPending ? "#d97706" : "#17345c" }}>{todayPending}R</strong></div>
          <div style={card}><div style={{ color: "#718096", fontSize: 13 }}>通知ON会員</div><strong style={{ fontSize: 30 }}>{recipients}</strong></div>
          <div style={card}><div style={{ color: "#718096", fontSize: 13 }}>全期間成立</div><strong style={{ fontSize: 30 }}>{stats.matched}R</strong></div>
          <div style={card}><div style={{ color: "#718096", fontSize: 13 }}>実績1着率</div><strong style={{ fontSize: 30, color: "#e56a00" }}>{stats.rate == null ? "—" : `${(stats.rate * 100).toFixed(1)}%`}</strong></div>
        </section>

        <section style={{ ...card, marginBottom: 20 }}>
          <h2 style={{ margin: "0 0 14px", fontSize: 20 }}>本日の成立レース</h2>
          {!todayAlerts.length ? <div style={{ padding: "22px 0", color: "#718096" }}>本日はまだ成立レースがありません。</div> : <AlertTable alerts={todayAlerts} />}
        </section>

        <section style={card}>
          <h2 style={{ margin: "0 0 14px", fontSize: 20 }}>全期間の成立履歴</h2>
          {!alerts.length ? <div style={{ padding: "22px 0", color: "#718096" }}>履歴がありません。</div> : <AlertTable alerts={alerts.slice(0, 500)} showDate />}
        </section>
      </div>
    </main>
  );
}

function AlertTable({ alerts, showDate = false }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 920 }}>
        <thead><tr>{[showDate ? "日付" : null, "レース", "締切", "①展示", "①一周", "上昇幅", "2着おすすめ", "全国勝率", "LINE"].filter(Boolean).map((h) => <th key={h} style={{ textAlign: "left", padding: "10px 8px", borderBottom: "1px solid #dbe4ee", fontSize: 12, color: "#718096" }}>{h}</th>)}</tr></thead>
        <tbody>
          {alerts.map((a) => (
            <tr key={a.id}>
              {showDate ? <td style={td}>{a.race_date}</td> : null}
              <td style={td}><strong>{a.course_name || `場${a.course_code}`} {a.race_no}R</strong></td>
              <td style={td}>{a.closing_time ? String(a.closing_time).slice(0, 5) : "—"}</td>
              <td style={td}>{a.exhibition_time ?? "—"}</td>
              <td style={td}>{a.lap_time ?? "—"}</td>
              <td style={{ ...td, color: "#e56a00", fontWeight: 900 }}>+{Number(a.uplift_points || 14.66).toFixed(2)}pt</td>
              <td style={td}><strong>{a.recommended_second_boat ? `${a.recommended_second_boat}号艇` : "—"}</strong></td>
              <td style={td}>{a.recommended_second_national_win_rate ?? "—"}</td>
              <td style={{ ...td, fontWeight: 900, color: a.notified ? "#16833d" : "#d97706" }}>{a.notified ? "通知済み" : "待機中"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
