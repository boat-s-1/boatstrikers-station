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
  const { data, error } = await supabase
    .from(table)
    .select("*")
    .order("race_date", { ascending: false })
    .limit(5000);
  return { rows: data || [], error: error?.message || "" };
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function firstNumber(row, keys) {
  for (const key of keys) {
    const value = num(row?.[key]);
    if (value != null) return value;
  }
  return null;
}

function rowResultRank(row) {
  return firstNumber(row, ["result_rank", "boat1_result_rank", "arrival_order", "result"]);
}

function rowPayout(row) {
  return firstNumber(row, ["trifecta_payout", "payout", "payout_yen", "return_yen"]);
}

function rowInvest(row) {
  return firstNumber(row, ["invest", "investment", "bet_amount", "stake_yen"]);
}

function bucketGap(value) {
  const n = num(value);
  if (n == null) return "差不明";
  if (n <= 0.02) return "トップ差0.02秒以内";
  if (n <= 0.04) return "トップ差0.03〜0.04秒";
  return "トップ差0.05秒以上";
}

const THEORY = {
  ichika: {
    name: "一果",
    subtitle: "イン逃げ条件研究",
    table: "bs_ichika_hidden_escape_alerts",
    accent: "#e83e7e",
    soft: "#fff1f6",
    groupKey: (row) => [
      row.racer_class || "級別不明",
      `展示${row.exhibition_rank ?? "?"}位`,
      `1周${row.lap_rank ?? "?"}位`,
      bucketGap(row.exhibition_gap),
    ].join(" × "),
    hit: (row) => rowResultRank(row) === 1,
  },
  hatsune: {
    name: "初音",
    subtitle: "女子戦・箱推し条件研究",
    table: "bs_hatsune_box_alerts",
    accent: "#8b5cf6",
    soft: "#f6f1ff",
    groupKey: (row) => [
      `234:${row.box_234_rating || "△"}`,
      `235:${row.box_235_rating || "△"}`,
      `345:${row.box_345_rating || "△"}`,
      `①展示${row.boat1_exhibition_rank ?? "?"}位`,
    ].join(" / "),
    hit: (row) => {
      const value = row.box_hit ?? row.hit ?? row.is_hit;
      return value === true || value === 1 || value === "1";
    },
  },
  kiina: {
    name: "キイナ",
    subtitle: "カド攻め条件研究",
    table: "bs_exhibition_alerts",
    accent: "#d38a00",
    soft: "#fff8e8",
    groupKey: (row) => `展示${row.exhibition_rank ?? "?"}位 × 直線${row.straight_rank ?? "?"}位`,
    hit: (row) => rowResultRank(row) === 1,
  },
};

function summarize(rows, config) {
  const groups = new Map();
  for (const row of rows) {
    const key = config.groupKey(row);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }

  return Array.from(groups.entries()).map(([condition, items]) => {
    const resultRows = items.filter((row) => rowResultRank(row) != null || row.hit != null || row.box_hit != null || row.is_hit != null);
    const hits = resultRows.filter(config.hit).length;
    const payoutRows = items.filter((row) => rowPayout(row) != null && rowInvest(row) != null && rowInvest(row) > 0);
    const invest = payoutRows.reduce((sum, row) => sum + (rowInvest(row) || 0), 0);
    const payout = payoutRows.reduce((sum, row) => sum + (rowPayout(row) || 0), 0);
    const roi = invest > 0 ? (payout / invest) * 100 : null;
    return {
      condition,
      sample: items.length,
      finished: resultRows.length,
      hits,
      hitRate: resultRows.length ? (hits / resultRows.length) * 100 : null,
      payoutRows: payoutRows.length,
      roi,
    };
  }).sort((a, b) => {
    const aScore = a.roi ?? a.hitRate ?? -1;
    const bScore = b.roi ?? b.hitRate ?? -1;
    return bScore - aScore || b.sample - a.sample;
  });
}

function pct(value) {
  return value == null ? "—" : `${value.toFixed(1)}%`;
}

function TheorySection({ config, rows, error }) {
  const summary = summarize(rows, config).slice(0, 12);
  const roiReady = summary.filter((item) => item.roi != null).length;
  const winners = summary.filter((item) => item.roi != null && item.roi >= 100).length;

  return (
    <section style={{ background: "#fff", borderRadius: 22, padding: 18, boxShadow: "0 8px 24px rgba(22,52,92,.07)", border: `1px solid ${config.soft}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", marginBottom: 14 }}>
        <div>
          <span style={{ color: config.accent, fontSize: 12, fontWeight: 900, letterSpacing: ".08em" }}>{config.name.toUpperCase()} RESEARCH</span>
          <h2 style={{ margin: "4px 0 3px", color: "#17345c", fontSize: 22 }}>{config.name}｜{config.subtitle}</h2>
          <p style={{ margin: 0, color: "#718096", fontSize: 13 }}>保存済み理論成立データを条件ごとに自動集計します。</p>
        </div>
        <div style={{ minWidth: 94, textAlign: "center", borderRadius: 14, padding: "9px 10px", background: config.soft }}>
          <small style={{ display: "block", color: "#718096", fontWeight: 800 }}>全データ</small>
          <strong style={{ color: config.accent, fontSize: 24 }}>{rows.length}</strong>
        </div>
      </div>

      {error ? <div style={{ padding: 12, borderRadius: 12, background: "#fff1f2", color: "#b42318", marginBottom: 12 }}>取得エラー：{error}</div> : null}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 8, marginBottom: 14 }}>
        <div style={{ padding: 11, borderRadius: 13, background: "#f7f9fc" }}><small style={{ color: "#718096" }}>条件パターン</small><strong style={{ display: "block", color: "#17345c", fontSize: 21 }}>{summary.length}</strong></div>
        <div style={{ padding: 11, borderRadius: 13, background: "#f7f9fc" }}><small style={{ color: "#718096" }}>回収率算出可</small><strong style={{ display: "block", color: "#17345c", fontSize: 21 }}>{roiReady}</strong></div>
        <div style={{ padding: 11, borderRadius: 13, background: winners ? "#ecfdf3" : "#f7f9fc" }}><small style={{ color: "#718096" }}>回収率100%+</small><strong style={{ display: "block", color: winners ? "#067647" : "#17345c", fontSize: 21 }}>{winners}</strong></div>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 680, fontSize: 13 }}>
          <thead>
            <tr style={{ color: "#718096", textAlign: "left", borderBottom: "1px solid #e7ebf0" }}>
              <th style={{ padding: "9px 8px" }}>条件</th>
              <th style={{ padding: "9px 8px" }}>母数</th>
              <th style={{ padding: "9px 8px" }}>結果確定</th>
              <th style={{ padding: "9px 8px" }}>的中/1着率</th>
              <th style={{ padding: "9px 8px" }}>回収率</th>
              <th style={{ padding: "9px 8px" }}>判定</th>
            </tr>
          </thead>
          <tbody>
            {summary.map((item) => {
              const good = item.roi != null && item.roi >= 100;
              return (
                <tr key={item.condition} style={{ borderBottom: "1px solid #edf0f4" }}>
                  <td style={{ padding: "11px 8px", fontWeight: 800, color: "#17345c" }}>{item.condition}</td>
                  <td style={{ padding: "11px 8px" }}>{item.sample}</td>
                  <td style={{ padding: "11px 8px" }}>{item.finished}</td>
                  <td style={{ padding: "11px 8px", fontWeight: 800 }}>{pct(item.hitRate)}</td>
                  <td style={{ padding: "11px 8px", fontWeight: 900, color: good ? "#067647" : "#526079" }}>{pct(item.roi)}</td>
                  <td style={{ padding: "11px 8px" }}>
                    {good ? <span style={{ background: "#dcfae6", color: "#067647", borderRadius: 999, padding: "5px 8px", fontWeight: 900 }}>候補</span> : item.roi == null ? <span style={{ color: "#98a2b3" }}>払戻連携待ち</span> : <span style={{ color: "#667085" }}>継続検証</span>}
                  </td>
                </tr>
              );
            })}
            {!summary.length ? <tr><td colSpan="6" style={{ padding: 18, textAlign: "center", color: "#98a2b3" }}>まだ研究対象データがありません。</td></tr> : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default async function ConditionResearchPage() {
  const supabase = getSupabase();
  const [ichika, hatsune, kiina] = await Promise.all([
    loadRows(supabase, THEORY.ichika.table),
    loadRows(supabase, THEORY.hatsune.table),
    loadRows(supabase, THEORY.kiina.table),
  ]);

  return (
    <main style={{ minHeight: "100vh", background: "#f4f7fb", padding: "24px 14px 90px" }}>
      <div style={{ maxWidth: 1120, margin: "0 auto" }}>
        <header style={{ background: "linear-gradient(135deg,#102a52,#1d4f82)", color: "#fff", borderRadius: 24, padding: 22, marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <span style={{ fontSize: 12, fontWeight: 900, letterSpacing: ".1em", opacity: .78 }}>BOATSTRIKERS RESEARCH</span>
              <h1 style={{ margin: "6px 0 8px", fontSize: 28 }}>回収率100%条件リサーチ</h1>
              <p style={{ margin: 0, lineHeight: 1.7, opacity: .9 }}>一果・初音・キイナの理論成立履歴を条件別に分解し、勝率と回収率の高い条件を探す管理画面です。</p>
            </div>
            <Link href="/admin" style={{ alignSelf: "flex-start", color: "#17345c", background: "#fff", textDecoration: "none", borderRadius: 12, padding: "10px 13px", fontWeight: 900 }}>管理TOPへ</Link>
          </div>
        </header>

        <div style={{ background: "#fff8e8", border: "1px solid #f0d38a", borderRadius: 16, padding: 14, marginBottom: 16, color: "#6b5318", fontSize: 13, lineHeight: 1.65 }}>
          <strong>研究画面 v1：</strong> 回収率は各履歴に「投資額」と「払戻」が保存されている場合だけ実数で計算します。未連携の理論は、まず母数・結果確定数・的中/1着率を比較し、払戻データ連携後に自動で回収率ランキングへ移行します。数字を推測で補完しない設計です。
        </div>

        <div style={{ display: "grid", gap: 16 }}>
          <TheorySection config={THEORY.ichika} rows={ichika.rows} error={ichika.error} />
          <TheorySection config={THEORY.hatsune} rows={hatsune.rows} error={hatsune.error} />
          <TheorySection config={THEORY.kiina} rows={kiina.rows} error={kiina.error} />
        </div>
      </div>
    </main>
  );
}
