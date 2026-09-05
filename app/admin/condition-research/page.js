import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function loadRows(supabase, table) {
  if (!supabase) return { rows: [], error: "Supabase未接続" };
  const { data, error } = await supabase.from(table).select("*").order("race_date", { ascending: false }).limit(5000);
  return { rows: data || [], error: error?.message || "" };
}

async function loadRecommendations(supabase) {
  if (!supabase) return { rows: [], error: "Supabase未接続" };
  const { data, error } = await supabase
    .from("bs_theory_recommendations")
    .select("*")
    .order("recommended_at", { ascending: false })
    .limit(10000);
  return { rows: data || [], error: error?.message || "" };
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function pct(value) {
  return value == null ? "—" : `${Number(value).toFixed(1)}%`;
}

function yen(value) {
  return value == null ? "—" : `${Number(value).toLocaleString("ja-JP")}円`;
}

function sourceKey(table, id) {
  return `${table}:${id}`;
}

function signalBucket(value) {
  const n = num(value);
  if (n == null) return "条件時率不明";
  if (n >= 70) return "条件時70%+";
  if (n >= 65) return "条件時65〜69%";
  return "条件時65%未満";
}

function upliftBucket(value) {
  const n = num(value);
  if (n == null) return "上昇幅不明";
  if (n >= 15) return "上昇15pt+";
  if (n >= 10) return "上昇10〜14pt";
  return "上昇10pt未満";
}

const THEORY = {
  ichika: {
    name: "一果",
    subtitle: "イン逃げアラート条件研究",
    table: "bs_ichika_escape_surge_alerts",
    theoryKey: "ichika_escape_surge",
    accent: "#e83e7e",
    soft: "#fff1f6",
    note: "通知時に表示した『2着候補』を 1-候補-全 の4点へ展開して保存。保存された買い目だけで回収率を計算します。",
    groupKey: (row) => [
      signalBucket(row.signal_win_rate),
      upliftBucket(row.uplift_points),
      `2着候補${row.recommended_second_boat ?? "?"}号艇`,
    ].join(" × "),
  },
  hatsune: {
    name: "初音",
    subtitle: "箱推し理論条件研究",
    table: "bs_hatsune_box_alerts",
    theoryKey: "hatsune_box",
    accent: "#8b5cf6",
    soft: "#f6f1ff",
    note: "成立時に◎・○だった推奨BOXを、その時点の買い目として保存。重複買い目は1点に統合しています。",
    groupKey: (row) => [
      `234:${row.box_234_rating || "△"}`,
      `235:${row.box_235_rating || "△"}`,
      `345:${row.box_345_rating || "△"}`,
      `①展示${row.boat1_exhibition_rank ?? "?"}位`,
    ].join(" / "),
  },
  kiina: {
    name: "キイナ",
    subtitle: "カド攻め理論条件研究",
    table: "bs_exhibition_alerts",
    theoryKey: "kiina_kado",
    accent: "#d38a00",
    soft: "#fff8e8",
    note: "現在のカド攻め理論は『成立条件』のみ通知し、買い目は推奨していません。実買い目が定義されるまで回収率は出しません。",
    groupKey: (row) => `展示${row.exhibition_rank ?? "?"}位 × 直線${row.straight_rank ?? "?"}位`,
  },
};

function attachRecommendations(rows, config, recommendationMap) {
  return rows.map((row) => ({
    ...row,
    recommendation: recommendationMap.get(sourceKey(config.table, row.id)) || null,
  }));
}

function summarize(rows, config) {
  const groups = new Map();
  for (const row of rows) {
    const key = config.groupKey(row);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }

  return Array.from(groups.entries()).map(([condition, items]) => {
    const recs = items.map((row) => row.recommendation).filter(Boolean);
    const ticketRecs = recs.filter((rec) => rec.recommendation_type === "tickets" && Number(rec.investment || 0) > 0);
    const settled = ticketRecs.filter((rec) => rec.status === "settled");
    const hits = settled.filter((rec) => rec.is_hit === true).length;
    const invest = settled.reduce((sum, rec) => sum + Number(rec.investment || 0), 0);
    const payout = settled.reduce((sum, rec) => sum + Number(rec.payout || 0), 0);
    const roi = invest > 0 ? (payout / invest) * 100 : null;
    return {
      condition,
      sample: items.length,
      recommended: ticketRecs.length,
      settled: settled.length,
      hits,
      hitRate: settled.length ? (hits / settled.length) * 100 : null,
      invest,
      payout,
      roi,
    };
  }).sort((a, b) => (b.roi ?? -1) - (a.roi ?? -1) || b.settled - a.settled || b.sample - a.sample);
}

function TheorySection({ config, rows, error }) {
  const summary = summarize(rows, config).slice(0, 15);
  const ticketRows = rows.filter((row) => row.recommendation?.recommendation_type === "tickets");
  const settledRows = ticketRows.filter((row) => row.recommendation?.status === "settled");
  const totalInvest = settledRows.reduce((sum, row) => sum + Number(row.recommendation?.investment || 0), 0);
  const totalPayout = settledRows.reduce((sum, row) => sum + Number(row.recommendation?.payout || 0), 0);
  const overallRoi = totalInvest > 0 ? (totalPayout / totalInvest) * 100 : null;
  const winners = summary.filter((item) => item.roi != null && item.roi >= 100).length;

  return (
    <section style={{ background: "#fff", borderRadius: 22, padding: 18, boxShadow: "0 8px 24px rgba(22,52,92,.07)", border: `1px solid ${config.soft}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap", marginBottom: 12 }}>
        <div style={{ flex: "1 1 560px" }}>
          <span style={{ color: config.accent, fontSize: 12, fontWeight: 900, letterSpacing: ".08em" }}>{config.name.toUpperCase()} ACTUAL BET RESEARCH</span>
          <h2 style={{ margin: "4px 0", color: "#17345c", fontSize: 22 }}>{config.name}｜{config.subtitle}</h2>
          <p style={{ margin: 0, color: "#718096", fontSize: 13, lineHeight: 1.65 }}>{config.note}</p>
        </div>
        <div style={{ minWidth: 110, textAlign: "center", borderRadius: 14, padding: "9px 10px", background: config.soft }}>
          <small style={{ display: "block", color: "#718096", fontWeight: 800 }}>実買い目ROI</small>
          <strong style={{ color: overallRoi != null && overallRoi >= 100 ? "#067647" : config.accent, fontSize: 25 }}>{pct(overallRoi)}</strong>
        </div>
      </div>

      {error ? <div style={{ padding: 12, borderRadius: 12, background: "#fff1f2", color: "#b42318", marginBottom: 12 }}>取得エラー：{error}</div> : null}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 8, marginBottom: 14 }}>
        <div style={{ padding: 11, borderRadius: 13, background: "#f7f9fc" }}><small style={{ color: "#718096" }}>理論成立</small><strong style={{ display: "block", color: "#17345c", fontSize: 21 }}>{rows.length}</strong></div>
        <div style={{ padding: 11, borderRadius: 13, background: "#f7f9fc" }}><small style={{ color: "#718096" }}>買い目保存</small><strong style={{ display: "block", color: "#17345c", fontSize: 21 }}>{ticketRows.length}</strong></div>
        <div style={{ padding: 11, borderRadius: 13, background: "#f7f9fc" }}><small style={{ color: "#718096" }}>結果確定</small><strong style={{ display: "block", color: "#17345c", fontSize: 21 }}>{settledRows.length}</strong></div>
        <div style={{ padding: 11, borderRadius: 13, background: winners ? "#ecfdf3" : "#f7f9fc" }}><small style={{ color: "#718096" }}>回収率100%+条件</small><strong style={{ display: "block", color: winners ? "#067647" : "#17345c", fontSize: 21 }}>{winners}</strong></div>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 820, fontSize: 13 }}>
          <thead><tr style={{ color: "#718096", textAlign: "left", borderBottom: "1px solid #e7ebf0" }}>
            <th style={{ padding: 9 }}>条件</th><th style={{ padding: 9 }}>母数</th><th style={{ padding: 9 }}>買い目保存</th><th style={{ padding: 9 }}>結果確定</th><th style={{ padding: 9 }}>的中率</th><th style={{ padding: 9 }}>投資</th><th style={{ padding: 9 }}>払戻</th><th style={{ padding: 9 }}>回収率</th><th style={{ padding: 9 }}>判定</th>
          </tr></thead>
          <tbody>
            {summary.map((item) => {
              const good = item.roi != null && item.roi >= 100;
              return <tr key={item.condition} style={{ borderBottom: "1px solid #edf0f4" }}>
                <td style={{ padding: 10, fontWeight: 800, color: "#17345c" }}>{item.condition}</td>
                <td style={{ padding: 10 }}>{item.sample}</td><td style={{ padding: 10 }}>{item.recommended}</td><td style={{ padding: 10 }}>{item.settled}</td>
                <td style={{ padding: 10, fontWeight: 800 }}>{pct(item.hitRate)}</td><td style={{ padding: 10 }}>{yen(item.invest)}</td><td style={{ padding: 10 }}>{yen(item.payout)}</td>
                <td style={{ padding: 10, fontWeight: 900, color: good ? "#067647" : "#526079" }}>{pct(item.roi)}</td>
                <td style={{ padding: 10 }}>{good ? <span style={{ background: "#dcfae6", color: "#067647", borderRadius: 999, padding: "5px 8px", fontWeight: 900 }}>候補</span> : item.roi == null ? <span style={{ color: "#98a2b3" }}>実買い目なし</span> : <span style={{ color: "#667085" }}>継続検証</span>}</td>
              </tr>;
            })}
            {!summary.length ? <tr><td colSpan="9" style={{ padding: 18, textAlign: "center", color: "#98a2b3" }}>まだ研究対象データがありません。</td></tr> : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function RecentRecommendations({ rows }) {
  const recent = rows.slice(0, 20);
  return <section style={{ background: "#fff", borderRadius: 22, padding: 18, boxShadow: "0 8px 24px rgba(22,52,92,.07)" }}>
    <h2 style={{ margin: "0 0 5px", color: "#17345c" }}>最近の保存済み推奨</h2>
    <p style={{ margin: "0 0 12px", color: "#718096", fontSize: 13 }}>理論成立時点の買い目を後から書き換えず保存しています。</p>
    <div style={{ display: "grid", gap: 8 }}>
      {recent.map((rec) => <div key={rec.id} style={{ padding: 12, border: "1px solid #e8edf3", borderRadius: 14, display: "grid", gridTemplateColumns: "minmax(160px,1fr) 2fr auto", gap: 10, alignItems: "center" }}>
        <div><strong style={{ color: "#17345c" }}>{rec.course_name || `${rec.course_code}場`} {rec.race_no}R</strong><small style={{ display: "block", color: "#98a2b3", marginTop: 3 }}>{rec.race_date} / {rec.character_code}</small></div>
        <div><b style={{ color: "#526079" }}>{rec.recommendation_label || "条件成立"}</b><small style={{ display: "block", color: "#98a2b3", marginTop: 3 }}>{rec.recommendation_type === "tickets" ? `${rec.ticket_count}点・${yen(rec.investment)}` : "買い目未設定"}</small></div>
        <div style={{ textAlign: "right" }}><strong style={{ color: rec.is_hit ? "#067647" : "#526079" }}>{rec.status === "settled" ? (rec.is_hit ? "的中" : "不的中") : rec.status === "no_ticket" ? "条件のみ" : "結果待ち"}</strong><small style={{ display: "block", marginTop: 3, color: "#718096" }}>{rec.status === "settled" ? `回収 ${pct(rec.recovery_rate)}` : ""}</small></div>
      </div>)}
      {!recent.length ? <div style={{ color: "#98a2b3", padding: 12 }}>保存済み推奨はまだありません。</div> : null}
    </div>
  </section>;
}

export default async function ConditionResearchPage() {
  const supabase = getSupabase();
  const [ichika, hatsune, kiina, recommendationResult] = await Promise.all([
    loadRows(supabase, THEORY.ichika.table),
    loadRows(supabase, THEORY.hatsune.table),
    loadRows(supabase, THEORY.kiina.table),
    loadRecommendations(supabase),
  ]);

  const recommendationMap = new Map(recommendationResult.rows.map((rec) => [sourceKey(rec.source_table, rec.source_alert_id), rec]));
  const ichikaRows = attachRecommendations(ichika.rows, THEORY.ichika, recommendationMap);
  const hatsuneRows = attachRecommendations(hatsune.rows, THEORY.hatsune, recommendationMap);
  const kiinaRows = attachRecommendations(kiina.rows, THEORY.kiina, recommendationMap);

  return <main style={{ minHeight: "100vh", background: "#f4f7fb", padding: "24px 14px 90px" }}>
    <div style={{ maxWidth: 1160, margin: "0 auto" }}>
      <header style={{ background: "linear-gradient(135deg,#102a52,#1d4f82)", color: "#fff", borderRadius: 24, padding: 22, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}><div><span style={{ fontSize: 12, fontWeight: 900, letterSpacing: ".1em", opacity: .78 }}>BOATSTRIKERS RESEARCH ENGINE</span><h1 style={{ margin: "6px 0 8px", fontSize: 28 }}>実推奨買い目・回収率研究</h1><p style={{ margin: 0, lineHeight: 1.7, opacity: .9 }}>理論成立時に実際に出した推奨を保存し、結果確定後にその買い目だけで的中率・回収率を自動計算します。</p></div><Link href="/admin" style={{ alignSelf: "flex-start", color: "#17345c", background: "#fff", textDecoration: "none", borderRadius: 12, padding: "10px 13px", fontWeight: 900 }}>管理TOPへ</Link></div>
      </header>

      <div style={{ background: "#ecfdf3", border: "1px solid #abefc6", borderRadius: 16, padding: 14, marginBottom: 16, color: "#067647", fontSize: 13, lineHeight: 1.7 }}><strong>実買い目スナップショット方式：</strong> 理論成立時の推奨を <code>bs_theory_recommendations</code> に固定保存します。結果が後から入ると自動照合し、投資・払戻・利益・回収率を確定します。後知恵で買い目を作り直さないため、研究値の信頼性を高められます。</div>
      {recommendationResult.error ? <div style={{ padding: 12, background: "#fff1f2", color: "#b42318", borderRadius: 14, marginBottom: 16 }}>推奨履歴取得エラー：{recommendationResult.error}</div> : null}

      <div style={{ display: "grid", gap: 16 }}>
        <TheorySection config={THEORY.ichika} rows={ichikaRows} error={ichika.error} />
        <TheorySection config={THEORY.hatsune} rows={hatsuneRows} error={hatsune.error} />
        <TheorySection config={THEORY.kiina} rows={kiinaRows} error={kiina.error} />
        <RecentRecommendations rows={recommendationResult.rows} />
      </div>
    </div>
  </main>;
}
