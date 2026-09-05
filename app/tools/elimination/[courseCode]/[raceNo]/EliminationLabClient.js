"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { buildTrifectaProbabilities, probabilityFor } from "./eliminationProbability";
import styles from "./elimination-lab.module.css";

const ALL_BETS = (() => {
  const bets = [];
  for (let a = 1; a <= 6; a += 1) {
    for (let b = 1; b <= 6; b += 1) {
      if (a === b) continue;
      for (let c = 1; c <= 6; c += 1) {
        if (c === a || c === b) continue;
        bets.push([a, b, c]);
      }
    }
  }
  return bets;
})();

function n(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
function get(entry, keys) {
  for (const key of keys) {
    const value = n(entry?.[key]);
    if (value !== null) return value;
  }
  return null;
}
function boatNo(entry) { return Number(entry?.boat_no ?? entry?.teiban ?? entry?.boatNo); }
function betKey(bet) { return bet.join("-"); }
function oddsFor(odds, bet) {
  const value = Number(odds?.[betKey(bet)]);
  return Number.isFinite(value) && value > 0 ? value : null;
}
function rankBoats(entries, keys, { lowerIsBetter = false } = {}) {
  return entries.map((entry) => ({ boat: boatNo(entry), value: get(entry, keys) }))
    .filter((row) => row.boat >= 1 && row.boat <= 6 && row.value !== null)
    .sort((a, b) => lowerIsBetter ? a.value - b.value : b.value - a.value);
}
function bottomBoats(entries, keys, count = 2, options = {}) {
  const ranked = rankBoats(entries, keys, options);
  return ranked.length >= 4 ? ranked.slice(-count).map((row) => row.boat) : [];
}
function buildMarketProbabilities(odds) {
  const raw = {}; let total = 0;
  for (const bet of ALL_BETS) {
    const currentOdds = oddsFor(odds, bet);
    if (!currentOdds) continue;
    const p = 1 / currentOdds;
    raw[betKey(bet)] = p; total += p;
  }
  if (!total) return {};
  return Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, value / total]));
}
function correctedProbability(probabilities, marketProbabilities, bet) {
  const model = probabilityFor(probabilities, bet);
  const market = Number(marketProbabilities?.[betKey(bet)]);
  if (model === null) return null;
  return Number.isFinite(market) && market > 0 ? model * 0.75 + market * 0.25 : model;
}
function valueMetrics(probabilities, marketProbabilities, odds, bet) {
  const corrected = correctedProbability(probabilities, marketProbabilities, bet);
  const market = Number(marketProbabilities?.[betKey(bet)]);
  const currentOdds = oddsFor(odds, bet);
  const ratio = corrected !== null && Number.isFinite(market) && market > 0 ? corrected / market : null;
  const ev = corrected !== null && currentOdds !== null ? corrected * currentOdds * 100 : null;
  return { corrected, market: Number.isFinite(market) ? market : null, currentOdds, ratio, ev };
}

export default function EliminationLabClient({
  entries, premiumAccess = false, syncedAt, exhibitionReady,
  odds = {}, oddsCount = 0, oddsFetchedAt = null, oddsSource = null, oddsError = null,
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [enabled, setEnabled] = useState({ exhibition456: false, exhibition56top2: false, st: false, motor: false, win: false });
  const [a1Correction, setA1Correction] = useState(false);
  const [valueEnabled, setValueEnabled] = useState(false);
  const [evThreshold, setEvThreshold] = useState(100);

  const exhibitionBottom3 = useMemo(() => bottomBoats(entries, ["exhibition_time", "official_exhibition_time", "tenji_time", "display_time"], 3, { lowerIsBetter: true }), [entries]);
  const exhibitionBottom2 = useMemo(() => bottomBoats(entries, ["exhibition_time", "official_exhibition_time", "tenji_time", "display_time"], 2, { lowerIsBetter: true }), [entries]);
  const stBottom2 = useMemo(() => bottomBoats(entries, ["average_st", "avg_st", "st_average"], 2, { lowerIsBetter: true }), [entries]);
  const motorBottom2 = useMemo(() => bottomBoats(entries, ["motor_2_rate", "motor_top2_rate", "motor_2ren_rate", "motor_rate"], 2), [entries]);
  const winBottom2 = useMemo(() => bottomBoats(entries, ["national_win_rate", "win_rate", "racer_win_rate"], 2), [entries]);
  const a1Boats = useMemo(() => entries.filter((entry) => String(entry?.racer_class ?? entry?.class ?? "").toUpperCase() === "A1").map(boatNo), [entries]);

  const probabilities = useMemo(() => buildTrifectaProbabilities(entries, { live: exhibitionReady }), [entries, exhibitionReady]);
  const marketProbabilities = useMemo(() => buildMarketProbabilities(odds), [odds]);
  const valueAvailable = Object.keys(probabilities).length === 120 && oddsCount > 0 && Object.keys(marketProbabilities).length > 0;

  const rules = [
    { key: "exhibition456", free: true, label: "展示4〜6位を1着から消す", desc: exhibitionBottom3.length ? `${exhibitionBottom3.join("・")}号艇の1着目を消去` : "展示データ待ち", available: exhibitionReady && exhibitionBottom3.length === 3, test: (bet) => exhibitionBottom3.includes(bet[0]) },
    { key: "exhibition56top2", label: "展示5〜6位を2着以内から消す", desc: exhibitionBottom2.length ? `${exhibitionBottom2.join("・")}号艇の1・2着目を消去` : "展示データ待ち", available: exhibitionReady && exhibitionBottom2.length === 2, test: (bet) => exhibitionBottom2.includes(bet[0]) || exhibitionBottom2.includes(bet[1]) },
    { key: "st", label: "ST下位2艇を1着から消す", desc: stBottom2.length ? `${stBottom2.join("・")}号艇の1着目を消去` : "STデータ不足", available: stBottom2.length === 2, test: (bet) => stBottom2.includes(bet[0]) },
    { key: "motor", label: "モーター下位2艇を1着から消す", desc: motorBottom2.length ? `${motorBottom2.join("・")}号艇の1着目を消去` : "モーターデータ不足", available: motorBottom2.length === 2, test: (bet) => motorBottom2.includes(bet[0]) },
    { key: "win", label: "勝率下位2艇を1着から消す", desc: winBottom2.length ? `${winBottom2.join("・")}号艇の1着目を消去` : "勝率データ不足", available: winBottom2.length === 2, test: (bet) => winBottom2.includes(bet[0]) },
  ];

  const evaluation = useMemo(() => {
    const map = {};
    let remain = 0;
    for (const bet of ALL_BETS) {
      const reasons = [];
      for (const rule of rules) {
        if (!enabled[rule.key] || !rule.available) continue;
        if (!premiumAccess && !rule.free) continue;
        if (rule.test(bet)) reasons.push(rule.label);
      }
      const rawEliminated = reasons.length > 0;
      const restored = rawEliminated && premiumAccess && a1Correction && a1Boats.includes(bet[0]) && reasons.every((reason) => reason.includes("1着") || reason.includes("1・2着"));
      let eliminated = rawEliminated && !restored;
      if (!eliminated && premiumAccess && valueEnabled && valueAvailable) {
        const metrics = valueMetrics(probabilities, marketProbabilities, odds, bet);
        if (metrics.corrected === null || metrics.corrected * 100 < 0.5 || metrics.ratio === null || metrics.ratio < 1.15 || metrics.ev === null || metrics.ev < evThreshold) {
          eliminated = true;
          reasons.push(`VALUE ${evThreshold}%未満`);
        }
      }
      if (!eliminated) remain += 1;
      map[betKey(bet)] = { eliminated, restored, reasons };
    }
    return { map, remain };
  }, [enabled, premiumAccess, a1Correction, a1Boats, valueEnabled, valueAvailable, evThreshold, probabilities, marketProbabilities, odds, exhibitionBottom3, exhibitionBottom2, stBottom2, motorBottom2, winBottom2]);

  const toggleRule = (rule) => {
    if (!rule.available) return;
    if (!premiumAccess && !rule.free) return;
    setEnabled((prev) => ({ ...prev, [rule.key]: !prev[rule.key] }));
  };
  const refresh = () => startTransition(() => router.refresh());
  const removed = 120 - evaluation.remain;
  const removalRate = Math.round((removed / 120) * 1000) / 10;

  return (
    <div className={styles.wrap}>
      {!premiumAccess && (
        <section style={{ padding: 16, borderRadius: 16, background: "#fff7ed", border: "1px solid #fed7aa", marginBottom: 14 }}>
          <strong style={{ color: "#9a4a12" }}>FREE TRIAL</strong>
          <p style={{ margin: "6px 0 0", color: "#76553b", fontSize: 12, lineHeight: 1.7, fontWeight: 700 }}>無料では「展示4〜6位を1着から消す」を体験できます。その他の消去条件・A1補正・VALUE判定はプレミアム会員限定です。</p>
        </section>
      )}

      <section className={styles.summary}>
        <div><span>START</span><strong>120通り</strong></div><div className={styles.arrow}>→</div>
        <div><span>REMAIN</span><strong>{evaluation.remain}通り</strong></div><div><span>消去率</span><strong>{removalRate}%</strong></div>
      </section>

      <button className={styles.refresh} onClick={refresh} disabled={isPending}>{isPending ? "再診断中…" : "最新データで再診断"}</button>
      <p className={styles.synced}>レースデータ同期: {syncedAt || "-"} / オッズ: {oddsFetchedAt || "-"}</p>

      <section className={styles.rulePanel}>
        <div className={styles.sectionTitle}><span>STEP 1</span><h2>消去条件を選ぶ</h2></div>
        <div className={styles.rules}>
          {rules.map((rule) => {
            const locked = !premiumAccess && !rule.free;
            return (
              <button key={rule.key} className={`${styles.rule} ${enabled[rule.key] && !locked ? styles.active : ""}`} onClick={() => toggleRule(rule)} disabled={!rule.available} style={locked ? { opacity: .62 } : undefined}>
                <span className={styles.switch}>{locked ? "🔒" : enabled[rule.key] ? "ON" : "OFF"}</span>
                <span><strong>{rule.label}{rule.free ? "  FREE" : ""}</strong><small>{locked ? "プレミアム会員限定" : rule.desc}</small></span>
              </button>
            );
          })}
        </div>
      </section>

      <section className={styles.rulePanel}>
        <div className={styles.sectionTitle}><span>CORRECTION</span><h2>補正条件</h2></div>
        <button className={`${styles.rule} ${premiumAccess && a1Correction ? styles.active : ""}`} onClick={() => premiumAccess && setA1Correction((v) => !v)} style={!premiumAccess ? { opacity: .62 } : undefined}>
          <span className={styles.switch}>{!premiumAccess ? "🔒" : a1Correction ? "ON" : "OFF"}</span>
          <span><strong>A1補正</strong><small>{premiumAccess ? `A1艇（${a1Boats.length ? a1Boats.join("・") : "該当なし"}）の1着消去を救済` : "プレミアム会員限定"}</small></span>
        </button>
      </section>

      <section className={styles.rulePanel}>
        <div className={styles.sectionTitle}><span>VALUE β2</span><h2>価値フィルター</h2></div>
        <button className={`${styles.rule} ${premiumAccess && valueEnabled ? styles.active : ""}`} onClick={() => premiumAccess && valueAvailable && setValueEnabled((v) => !v)} style={!premiumAccess ? { opacity: .62 } : undefined}>
          <span className={styles.switch}>{!premiumAccess ? "🔒" : valueEnabled ? "ON" : "OFF"}</span>
          <span><strong>市場補正VALUEでさらに消す</strong><small>{!premiumAccess ? "プレミアム会員限定" : valueAvailable ? `EV ${evThreshold}%以上を残す（最低確率0.5%・市場比1.15倍も併用）` : "確率またはオッズデータ待ち"}</small></span>
        </button>
        {premiumAccess && <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6, marginTop: 8 }}>{[80,100,120].map((v) => <button key={v} onClick={() => setEvThreshold(v)} style={{ padding: 9, borderRadius: 10, border: evThreshold === v ? "2px solid #ef7b22" : "1px solid #dfe6ef", background: evThreshold === v ? "#fff7ed" : "#fff", fontWeight: 900 }}>{v}%</button>)}</div>}
      </section>

      <section className={styles.betPanel}>
        <div className={styles.sectionTitle}><span>STEP 2</span><h2>3連単オッズ表</h2></div>
        {oddsError && <p style={{ color: "#a23434", fontWeight: 800 }}>オッズ取得エラー：{oddsError}</p>}
        <p style={{ margin: "0 0 10px", color: "#738195", fontSize: 11, fontWeight: 700 }}>白＝残す / グレー＝消去 / 黄＝補正で復活。条件をONにすると該当セルが塗りつぶされます。</p>
        <div style={{ overflowX: "auto", paddingBottom: 8 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 170px)", gap: 8, minWidth: 1060 }}>
            {[1,2,3,4,5,6].map((first) => (
              <div key={first} style={{ background: "#fff", borderRadius: 14, border: "1px solid #e3e9f0", overflow: "hidden" }}>
                <div style={{ padding: "10px 8px", fontWeight: 1000, textAlign: "center", background: first === 1 ? "#f4f4f4" : "#eef4fb" }}>{first}号艇 1着</div>
                {ALL_BETS.filter((bet) => bet[0] === first).map((bet) => {
                  const state = evaluation.map[betKey(bet)] || {};
                  const currentOdds = oddsFor(odds, bet);
                  const metrics = valueMetrics(probabilities, marketProbabilities, odds, bet);
                  const bg = state.restored ? "#fff4b8" : state.eliminated ? "#e5e7eb" : "#fff";
                  return (
                    <div key={betKey(bet)} title={(state.reasons || []).join(" / ")} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 6, padding: "8px 9px", borderTop: "1px solid #edf0f4", background: bg, opacity: state.eliminated ? .58 : 1 }}>
                      <span style={{ fontWeight: 900 }}>{betKey(bet)}</span>
                      <span style={{ fontWeight: 900, color: "#b85b16" }}>{currentOdds ? `${currentOdds}倍` : "-"}</span>
                      {premiumAccess && metrics.corrected !== null && <small style={{ gridColumn: "1 / -1", color: "#718096" }}>推定 {(metrics.corrected * 100).toFixed(2)}%{metrics.ev !== null ? ` / EV ${metrics.ev.toFixed(0)}%` : ""}</small>}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </section>

      <aside className={styles.note}>{premiumAccess ? "消去条件と補正条件を組み合わせて、120通りから買わない目を削れます。" : "無料体験では1条件のみ利用できます。ロック中の条件はプレミアム会員で解放されます。"}</aside>
    </div>
  );
}
