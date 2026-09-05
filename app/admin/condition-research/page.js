import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const UNIT_BET = 100;

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

async function loadRaceResults(supabase) {
  if (!supabase) return { rows: [], error: "Supabase未接続" };
  const { data, error } = await supabase
    .from("bs_race_events")
    .select("race_date,course_code,race_no,result_available,trifecta,trifecta_payout")
    .not("trifecta", "is", null)
    .order("race_date", { ascending: false })
    .limit(5000);
  return { rows: data || [], error: error?.message || "" };
}

async function loadBoat1Results(supabase) {
  if (!supabase) return { rows: [], error: "Supabase未接続" };
  const { data, error } = await supabase
    .from("bs_race_entries")
    .select("race_date,course_code,race_no,boat_no,arrival_order")
    .eq("boat_no", 1)
    .not("arrival_order", "is", null)
    .order("race_date", { ascending: false })
    .limit(5000);
  return { rows: data || [], error: error?.message || "" };
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function raceKey(row) {
  return `${String(row?.race_date || "")}:${Number(row?.course_code)}:${Number(row?.race_no)}`;
}

function normalizeTicket(value) {
  return String(value || "")
    .trim()
    .replace(/[－ー−]/g, "-")
    .replace(/\s+/g, "");
}

function ticketParts(value) {
  const normalized = normalizeTicket(value);
  const parts = normalized.split("-").map((part) => Number(part));
  return parts.length === 3 && parts.every((part) => Number.isInteger(part) && part >= 1 && part <= 6)
    ? parts
    : [];
}

function permutations3(a, b, c) {
  return [
    `${a}-${b}-${c}`,
    `${a}-${c}-${b}`,
    `${b}-${a}-${c}`,
    `${b}-${c}-${a}`,
    `${c}-${a}-${b}`,
    `${c}-${b}-${a}`,
  ];
}

function makeIchikaBet(result) {
  if (!result?.trifecta) return null;
  const winner = ticketParts(result.trifecta);
  const hit = winner[0] === 1;
  return {
    invest: 20 * UNIT_BET,
    payout: hit ? Number(result.trifecta_payout || 0) : 0,
    hit,
    label: "1-全-全（20点）",
  };
}

function activeHatsuneBoxes(row) {
  const boxes = [];
  const add = (rating, boats) => {
    if (["◎", "○"].includes(String(rating || "").trim())) boxes.push(boats);
  };
  add(row.box_234_rating, [2, 3, 4]);
  add(row.box_235_rating, [2, 3, 5]);
  add(row.box_345_rating, [3, 4, 5]);
  return boxes;
}

function makeHatsuneBet(row, result) {
  if (!result?.trifecta) return null;
  const tickets = new Set();
  for (const box of activeHatsuneBoxes(row)) {
    for (const ticket of permutations3(...box)) tickets.add(ticket);
  }
  if (!tickets.size) return null;
  const winner = normalizeTicket(result.trifecta);
  const hit = tickets.has(winner);
  return {
    invest: tickets.size * UNIT_BET,
    payout: hit ? Number(result.trifecta_payout || 0) : 0,
    hit,
    label: `評価◎○BOX（${tickets.size}点）`,
  };
}

function makeKiinaBet(row, result) {
  if (!result?.trifecta) return null;
  const head = Number(row.boat_no || 4);
  const winner = ticketParts(result.trifecta);
  const hit = winner[0] === head;
  return {
    invest: 20 * UNIT_BET,
    payout: hit ? Number(result.trifecta_payout || 0) : 0,
    hit,
    label: `${head}-全-全（20点）`,
  };
}

function enrichRows(rows, resultMap, boat1Map, theoryKey) {
  return rows.map((row) => {
    const key = raceKey(row);
    const result = resultMap.get(key) || null;
    const boat1Rank = boat1Map.get(key) ?? null;
    let bet = null;
    if (theoryKey === "ichika") bet = makeIchikaBet(result);
    if (theoryKey === "hatsune") bet = makeHatsuneBet(row, result);
    if (theoryKey === "kiina") bet = makeKiinaBet(row, result);
    return {
      ...row,
      linked_result_rank: theoryKey === "ichika" ? boat1Rank : row.result_rank,
      linked_trifecta: result?.trifecta ?? row.trifecta,
      linked_trifecta_payout: result?.trifecta_payout ?? row.trifecta_payout,
      linked_invest: bet?.invest ?? null,
      linked_payout: bet?.payout ?? null,
      linked_hit: bet?.hit ?? null,
      linked_bet_label: bet?.label ?? null,
    };
  });
}

function firstNumber(row, keys) {
  for (const key of keys) {
    const value = num(row?.[key]);
    if (value != null) return value;
  }
  return null;
}

function rowResultRank(row) {
  return firstNumber(row, ["linked_result_rank", "result_rank", "boat1_result_rank", "arrival_order", "result"]);
}

function rowPayout(row) {
  return firstNumber(row, ["linked_payout", "trifecta_payout", "payout", "payout_yen", "return_yen"]);
}

function rowInvest(row) {
  return firstNumber(row, ["linked_invest", "invest", "investment", "bet_amount", "stake_yen"]);
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
    betRule: "1号艇1着固定「1-全-全」20点・各100円で回収率を計算",
    groupKey: (row) => [
      row.racer_class || "級別不明",
      `展示${row.exhibition_rank ?? "?"}位`,
      `1周${row.lap_rank ?? "?"}位`,
      bucketGap(row.exhibition_gap),
    ].join(" × "),
    hit: (row) => row.linked_hit === true || rowResultRank(row) === 1,
  },
  hatsune: {
    name: "初音",
    subtitle: "女子戦・箱推し条件研究",
    table: "bs_hatsune_box_alerts",
    accent: "#8b5cf6",
    soft: "#f6f1ff",
    betRule: "評価◎・○の234/235/345 BOXを各100円購入（重複買い目は1点に統合）",
    groupKey: (row) => [
      `234:${row.box_234_rating || "△"}`,
      `235:${row.box_235_rating || "△"}`,
      `345:${row.box_345_rating || "△"}`,
      `①展示${row.boat1_exhibition_rank ?? "?"}位`,
    ].join(" / "),
    hit: (row) => row.linked_hit === true || row.box_hit === true || row.hit === true || row.is_hit === true,
  },
  kiina: {
    name: "キイナ",
    subtitle: "カド攻め条件研究",
    table: "bs_exhibition_alerts",
    accent: "#d38a00",
    soft: "#fff8e8",
    betRule: "4号艇1着固定「4-全-全」20点・各100円で参考回収率を計算",
    groupKey: (row) => `展示${row.exhibition_rank ?? "?"}位 × 直線${row.straight_rank ?? "?"}位`,
    hit: (row) => row.linked_hit === true || rowResultRank(row) === 1,
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
    const resultRows = items.filter((row) => row.linked_hit != null || rowResultRank(row) != null || row.hit != null || row.box_hit != null || row.is_hit != null);
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
      invest,
      payout,
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

function yen(value) {
  return Number(value || 0).toLocaleString("ja-JP") + "円";
}

function TheorySection({ config, rows, error }) {
  const summary = summarize(rows, config).slice(0, 12);
  const roiReady = summary.filter((item) => item.roi != null).length;
  const winners = summary.filter((item) => item.roi != null && item.roi >= 100).length;
  const linkedRaces = rows.filter((row) => row.linked_invest != null).length;

  return (
    <section style={{ background: "#fff", borderRadius: 22, padding: 18, boxShadow: "0 8px 24px rgba(22,52,92,.07)", border: `1px solid ${config.soft}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", marginBottom: 14 }}>
        <div>
          <span style={{ color: config.accent, fontSize: 12, fontWeight: 900, letterSpacing: ".08em" }}>{config.name.toUpperCase()} RESEARCH</span>
          <h2 style={{ margin: "4px 0 3px", color: "#17345c", fontSize: 22 }}>{config.name}｜{config.subtitle}</h2>
          <p style={{ margin: 0, color: "#718096", fontSize: 13 }}>保存済み理論成立データを条件ごとに自動集計します。</p>
          <p style={{ margin: "7px 0 0", color: config.accent, fontSize: 12, fontWeight: 800 }}>回収率ルール：{config.betRule}</p>
        </div>
        <div style={{ minWidth: 94, textAlign: "center", borderRadius: 14, padding: "9px 10px", background: config.soft }}>
          <small style={{ display: "block", color: "#718096", fontWeight: 800 }}>全データ</small>
          <strong style={{ color: config.accent, fontSize: 24 }}>{rows.length}</strong>
        </div>
      </div>

      {error ? <div style={{ padding: 12, borderRadius: 12, background: "#fff1f2", color: "#b42318", marginBottom: 12 }}>取得エラー：{error}</div> : null}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 8, marginBottom: 14 }}>
        <div style={{ padding: 11, borderRadius: 13, background: "#f7f9fc" }}><small style={{ color: "#718096" }}>条件パターン</small><strong style={{ display: "block", color: "#17345c", fontSize: 21 }}>{summary.length}</strong></div>
        <div style={{ padding: 11, borderRadius: 13, background: "#f7f9fc" }}><small style={{ color: "#718096" }}>払戻連携R</small><strong style={{ display: "block", color: "#17345c", fontSize: 21 }}>{linkedRaces}</strong></div>
        <div style={{ padding: 11, borderRadius: 13, background: "#f7f9fc" }}><small style={{ color: "#718096" }}>回収率算出可</small><strong style={{ display: "block", color: "#17345c", fontSize: 21 }}>{roiReady}</strong></div>
        <div style={{ padding: 11, borderRadius: 13, background: winners ? "#ecfdf3" : "#f7f9fc" }}><small style={{ color: "#718096" }}>回収率100%+</small><strong style={{ display: "block", color: winners ? "#067647" : "#17345c", fontSize: 21 }}>{winners}</strong></div>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 800, fontSize: 13 }}>
          <thead>
            <tr style={{ color: "#718096", textAlign: "left", borderBottom: "1px solid #e7ebf0" }}>
              <th style={{ padding: "9px 8px" }}>条件</th>
              <th style={{ padding: "9px 8px" }}>母数</th>
              <th style={{ padding: "9px 8px" }}>結果確定</th>
              <th style={{ padding: "9px 8px" }}>的中/1着率</th>
              <th style={{ padding: "9px 8px" }}>投資</th>
              <th style={{ padding: "9px 8px" }}>払戻</th>
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
                  <td style={{ padding: "11px 8px", whiteSpace: "nowrap" }}>{item.invest ? yen(item.invest) : "—"}</td>
                  <td style={{ padding: "11px 8px", whiteSpace: "nowrap" }}>{item.invest ? yen(item.payout) : "—"}</td>
                  <td style={{ padding: "11px 8px", fontWeight: 900, color: good ? "#067647" : "#526079" }}>{pct(item.roi)}</td>
                  <td style={{ padding: "11px 8px" }}>
                    {good ? <span style={{ background: "#dcfae6", color: "#067647", borderRadius: 999, padding: "5px 8px", fontWeight: 900 }}>候補</span> : item.roi == null ? <span style={{ color: "#98a2b3" }}>結果連携待ち</span> : <span style={{ color: "#667085" }}>継続検証</span>}
                  </td>
                </tr>
              );
            })}
            {!summary.length ? <tr><td colSpan="8" style={{ padding: 18, textAlign: "center", color: "#98a2b3" }}>まだ研究対象データがありません。</td></tr> : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default async function ConditionResearchPage() {
  const supabase = getSupabase();
  const [ichika, hatsune, kiina, raceResults, boat1Results] = await Promise.all([
    loadRows(supabase, THEORY.ichika.table),
    loadRows(supabase, THEORY.hatsune.table),
    loadRows(supabase, THEORY.kiina.table),
    loadRaceResults(supabase),
    loadBoat1Results(supabase),
  ]);

  const resultMap = new Map(raceResults.rows.map((row) => [raceKey(row), row]));
  const boat1Map = new Map(boat1Results.rows.map((row) => [raceKey(row), Number(row.arrival_order)]));

  const ichikaRows = enrichRows(ichika.rows, resultMap, boat1Map, "ichika");
  const hatsuneRows = enrichRows(hatsune.rows, resultMap, boat1Map, "hatsune");
  const kiinaRows = enrichRows(kiina.rows, resultMap, boat1Map, "kiina");

  const sharedError = [raceResults.error, boat1Results.error].filter(Boolean).join(" / ");

  return (
    <main style={{ minHeight: "100vh", background: "#f4f7fb", padding: "24px 14px 90px" }}>
      <div style={{ maxWidth: 1120, margin: "0 auto" }}>
        <header style={{ background: "linear-gradient(135deg,#102a52,#1d4f82)", color: "#fff", borderRadius: 24, padding: 22, marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <span style={{ fontSize: 12, fontWeight: 900, letterSpacing: ".1em", opacity: .78 }}>BOATSTRIKERS RESEARCH</span>
              <h1 style={{ margin: "6px 0 8px", fontSize: 28 }}>回収率100%条件リサーチ</h1>
              <p style={{ margin: 0, lineHeight: 1.7, opacity: .9 }}>一果・初音・キイナの理論成立履歴を公式結果と自動照合し、条件別の勝率・投資・払戻・回収率を比較します。</p>
            </div>
            <Link href="/admin" style={{ alignSelf: "flex-start", color: "#17345c", background: "#fff", textDecoration: "none", borderRadius: 12, padding: "10px 13px", fontWeight: 900 }}>管理TOPへ</Link>
          </div>
        </header>

        <div style={{ background: "#ecfdf3", border: "1px solid #abefc6", borderRadius: 16, padding: 14, marginBottom: 16, color: "#067647", fontSize: 13, lineHeight: 1.65 }}>
          <strong>結果・払戻 自動連携：</strong> bs_race_events の3連単結果・払戻と、bs_race_entries の着順を「日付＋場＋R」で理論成立履歴に自動紐付けします。回収率は下記に明記した固定買い方・1点100円で計算し、結果が未取得のレースは集計対象から除外します。
        </div>
        {sharedError ? <div style={{ background: "#fff1f2", border: "1px solid #fecdd3", color: "#b42318", borderRadius: 14, padding: 12, marginBottom: 16 }}>結果連携エラー：{sharedError}</div> : null}

        <div style={{ display: "grid", gap: 16 }}>
          <TheorySection config={THEORY.ichika} rows={ichikaRows} error={ichika.error} />
          <TheorySection config={THEORY.hatsune} rows={hatsuneRows} error={hatsune.error} />
          <TheorySection config={THEORY.kiina} rows={kiinaRows} error={kiina.error} />
        </div>
      </div>
    </main>
  );
}
