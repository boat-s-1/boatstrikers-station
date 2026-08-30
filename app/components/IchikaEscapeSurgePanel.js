import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function jstDateOffset(offsetDays = 0) {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  jst.setUTCDate(jst.getUTCDate() + offsetDays);
  return jst.toISOString().slice(0, 10);
}

function formatDate(value) {
  return value ? String(value).replaceAll("-", "/") : "—";
}

function formatTime(value) {
  return value ? String(value).slice(0, 5) : "—";
}

function raceKey(row) {
  return `${row.race_date}-${Number(row.course_code)}-${Number(row.race_no)}`;
}

async function getCount(supabase, raceDate = null) {
  if (!supabase) return 0;
  let q = supabase.from("bs_ichika_escape_surge_alerts").select("id", { count: "exact", head: true });
  if (raceDate) q = q.eq("race_date", raceDate);
  const { count } = await q;
  return Number(count || 0);
}

async function getPerformance(supabase, raceDate = null) {
  if (!supabase) return { matched: 0, finished: 0, hits: 0, hitRate: null };
  let q = supabase
    .from("bs_ichika_escape_surge_alerts")
    .select("race_date,course_code,race_no")
    .order("race_date", { ascending: false })
    .limit(5000);
  if (raceDate) q = q.eq("race_date", raceDate);
  const { data: alerts, error } = await q;
  if (error || !alerts?.length) return { matched: alerts?.length || 0, finished: 0, hits: 0, hitRate: null };

  const dates = alerts.map((x) => x.race_date).filter(Boolean).sort();
  const { data: entries } = await supabase
    .from("bs_race_entries")
    .select("race_date,course_code,race_no,boat_no,arrival_order")
    .eq("boat_no", 1)
    .gte("race_date", dates[0])
    .lte("race_date", dates[dates.length - 1]);
  const resultMap = new Map((entries || []).map((x) => [raceKey(x), Number(x.arrival_order)]));
  const results = alerts.map((x) => resultMap.get(raceKey(x))).filter((x) => Number.isFinite(x) && x > 0);
  const hits = results.filter((x) => x === 1).length;
  return { matched: alerts.length, finished: results.length, hits, hitRate: results.length ? (hits / results.length) * 100 : null };
}

function CountCard({ label, count, tone }) {
  const p = tone === "blue"
    ? { bg: "linear-gradient(180deg,#eef8ff,#fff)", border: "#cfe9fb", text: "#1266b3" }
    : { bg: "linear-gradient(180deg,#fff5f8,#fff)", border: "#ffd5e3", text: "#e83e7e" };
  return (
    <div style={{ padding: "13px 8px 12px", borderRadius: 16, background: p.bg, border: `1px solid ${p.border}`, textAlign: "center" }}>
      <span style={{ display: "block", fontSize: 12, fontWeight: 900, color: p.text }}>{label}</span>
      <strong style={{ display: "block", marginTop: 5, fontSize: 28, lineHeight: 1, color: "#17345c" }}>
        {count}<small style={{ fontSize: 14, marginLeft: 2 }}>件</small>
      </strong>
    </div>
  );
}

export default async function IchikaEscapeSurgePanel() {
  const supabase = getSupabase();
  const today = jstDateOffset(0);
  const yesterday = jstDateOffset(-1);
  let alerts = [];

  if (supabase) {
    const { data, error } = await supabase
      .from("bs_ichika_escape_surge_alerts")
      .select("id,race_date,course_code,course_name,race_no,closing_time,exhibition_time,lap_time,recommended_second_boat,recommended_second_national_win_rate,baseline_win_rate,signal_win_rate,uplift_points")
      .eq("race_date", today)
      .order("closing_time", { ascending: true })
      .limit(12);
    if (!error) alerts = data || [];
  }

  const [yCount, allCount, yPerf, allPerf] = await Promise.all([
    getCount(supabase, yesterday),
    getCount(supabase),
    getPerformance(supabase, yesterday),
    getPerformance(supabase),
  ]);

  return (
    <section style={{ margin: "18px 14px", borderRadius: "24px 24px 0 0", overflow: "hidden", background: "#fff", boxShadow: "0 8px 24px rgba(0,0,0,.10)", border: "2px solid #ff9a3d" }}>
      <div style={{ position: "relative", padding: "18px 18px 16px", background: "linear-gradient(135deg,#ff9b33 0%,#ffcf4a 42%,#fff4c9 100%)", borderBottom: "1px solid rgba(255,154,61,.35)" }}>
        <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: ".08em", color: "#a34a00" }}>🔥 今日の一果アラート</div>
        <h2 style={{ margin: "4px 0 2px", fontSize: 25, color: "#17345c", lineHeight: 1.15 }}>イン逃げ急上昇アラート</h2>
        <div style={{ fontSize: 12, fontWeight: 800, color: "#7a5524" }}>展示1位＋一周1位でイン逃げ期待が急上昇</div>
        <span style={{ position: "absolute", top: 13, right: 12, padding: "7px 10px", borderRadius: 999, background: "rgba(255,255,255,.92)", color: "#526079", fontSize: 12, fontWeight: 900 }}>
          {formatDate(today)}
        </span>
      </div>

      <div style={{ padding: "15px 14px 8px" }}>
        <div style={{ padding: "13px 14px", borderRadius: 17, background: "linear-gradient(180deg,#fff9e9,#fff)", border: "1px solid #ffe2a7", marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: "#a45a00" }}>過去データ研究値</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
            <strong style={{ fontSize: 30, color: "#ef6c00" }}>約+15pt</strong>
            <span style={{ fontSize: 13, fontWeight: 800, color: "#526079" }}>51.70% → 66.36%</span>
          </div>
          <div style={{ marginTop: 3, fontSize: 11, color: "#718096" }}>※過去集計の比較値。各レースの的中を保証するものではありません。</div>
        </div>

        <div style={{ marginBottom: 8, fontSize: 13, fontWeight: 900, color: "#17345c" }}>アラート本数</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 8 }}>
          <CountCard label="本日" count={alerts.length} />
          <CountCard label="昨日" count={yCount} />
          <CountCard label="全期間" count={allCount} tone="blue" />
        </div>

        <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {[['昨日', yPerf], ['全期間', allPerf]].map(([label, perf]) => (
            <div key={label} style={{ padding: "13px 10px", borderRadius: 17, background: "#f7fbff", border: "1px solid #d8e9f6", textAlign: "center" }}>
              <span style={{ fontSize: 12, fontWeight: 900, color: "#1266b3" }}>{label} 1着率</span>
              <strong style={{ display: "block", marginTop: 3, fontSize: 28, color: "#1266b3" }}>{perf.hitRate == null ? "—%" : `${perf.hitRate.toFixed(1)}%`}</strong>
              <small style={{ color: "#718096", fontWeight: 800 }}>{perf.finished ? `${perf.hits}/${perf.finished}R` : "結果待ち"}</small>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: "8px 14px 2px", fontSize: 13, fontWeight: 900, color: "#17345c" }}>今日のアラート一覧</div>
      {alerts.length ? (
        <div style={{ padding: 14, display: "grid", gap: 10 }}>
          {alerts.map((a) => (
            <article key={a.id} style={{ border: "1px solid #ffe0b5", borderRadius: 17, padding: 14, background: "#fffdf8" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                <strong style={{ fontSize: 20, color: "#17345c" }}>{a.course_name || `${a.course_code}場`} {a.race_no}R</strong>
                <span style={{ padding: "6px 9px", borderRadius: 999, background: "#fff0db", color: "#e56a00", fontSize: 12, fontWeight: 900 }}>約+15pt</span>
              </div>
              <div style={{ marginTop: 9, display: "flex", flexWrap: "wrap", gap: 7, fontSize: 12, fontWeight: 800, color: "#526079" }}>
                <span style={{ padding: "6px 9px", borderRadius: 10, background: "#f3f6fa" }}>① 展示1位 {a.exhibition_time ?? "—"}</span>
                <span style={{ padding: "6px 9px", borderRadius: 10, background: "#f3f6fa" }}>① 一周1位 {a.lap_time ?? "—"}</span>
                {a.recommended_second_boat ? <span style={{ padding: "6px 9px", borderRadius: 10, background: "#fff1d9", color: "#a45a00" }}>2着おすすめ ②〜⑥ → {a.recommended_second_boat}号艇</span> : null}
              </div>
              <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                <strong style={{ fontSize: 14, color: "#17345c" }}>締切 {formatTime(a.closing_time)}</strong>
                <Link href="/races" style={{ fontSize: 13, fontWeight: 900, color: "#1266b3", textDecoration: "none" }}>出走表を見る</Link>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div style={{ padding: "20px 18px 22px", textAlign: "center" }}>
          <div style={{ fontSize: 30 }}>🚤</div>
          <strong style={{ display: "block", marginTop: 6, color: "#17345c" }}>現在、条件成立レースはありません</strong>
          <p style={{ margin: "7px 0 0", fontSize: 13, color: "#718096", lineHeight: 1.6 }}>展示情報が出た後、①が展示1位＋一周1位になると表示されます。</p>
        </div>
      )}
    </section>
  );
}
