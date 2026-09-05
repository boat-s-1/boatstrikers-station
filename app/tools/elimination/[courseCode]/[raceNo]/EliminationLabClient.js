"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { buildTrifectaProbabilities, probabilityFor } from "./eliminationProbability";
import styles from "./elimination-lab.module.css";

const ALL_BETS = (() => {
  const bets = [];
  for (let a = 1; a <= 6; a += 1) {
    for (let b = 1; b <= 6; b += 1) {
      if (b === a) continue;
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

function boatNo(entry) {
  return Number(entry?.boat_no ?? entry?.teiban ?? entry?.boatNo);
}

function rankBoats(entries, keys, { lowerIsBetter = false } = {}) {
  return entries
    .map((entry) => ({ boat: boatNo(entry), value: get(entry, keys) }))
    .filter((row) => row.boat >= 1 && row.boat <= 6 && row.value !== null)
    .sort((a, b) => (lowerIsBetter ? a.value - b.value : b.value - a.value));
}

function bottomBoats(entries, keys, count = 2, options = {}) {
  const ranked = rankBoats(entries, keys, options);
  if (ranked.length < 4) return [];
  return ranked.slice(-count).map((row) => row.boat);
}

function worstBoat(entries, keys, options = {}) {
  const ranked = rankBoats(entries, keys, options);
  return ranked.length >= 4 ? ranked[ranked.length - 1]?.boat : null;
}

function betKey(bet) {
  return bet.join("-");
}

function oddsFor(odds, bet) {
  const value = Number(odds?.[betKey(bet)]);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function buildMarketProbabilities(odds) {
  const inverse = {};
  let total = 0;
  for (const bet of ALL_BETS) {
    const currentOdds = oddsFor(odds, bet);
    if (!currentOdds) continue;
    const value = 1 / currentOdds;
    inverse[betKey(bet)] = value;
    total += value;
  }
  if (!total) return {};
  return Object.fromEntries(Object.entries(inverse).map(([key, value]) => [key, value / total]));
}

function correctedProbability(probabilities, marketProbabilities, bet) {
  const model = probabilityFor(probabilities, bet);
  const market = Number(marketProbabilities?.[betKey(bet)]);
  if (model === null) return null;
  if (!Number.isFinite(market) || market <= 0) return model;
  // v2 beta: 市場をアンカーにして極端なモデル推定を縮める。
  return model * 0.75 + market * 0.25;
}

function valueMetrics(probabilities, marketProbabilities, odds, bet) {
  const model = probabilityFor(probabilities, bet);
  const market = Number(marketProbabilities?.[betKey(bet)]);
  const corrected = correctedProbability(probabilities, marketProbabilities, bet);
  const currentOdds = oddsFor(odds, bet);
  const marketRatio = corrected !== null && Number.isFinite(market) && market > 0 ? corrected / market : null;
  const ev = corrected !== null && currentOdds !== null ? corrected * currentOdds * 100 : null;
  return { model, market: Number.isFinite(market) ? market : null, corrected, currentOdds, marketRatio, ev };
}

export default function EliminationLabClient({
  entries,
  syncedAt,
  exhibitionReady,
  odds = {},
  oddsCount = 0,
  oddsFetchedAt = null,
  oddsSource = null,
  oddsError = null,
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [enabled, setEnabled] = useState({ win: true, motor: true, st: false, exhibition: false, exhibitionTop2: false });
  const [valueEnabled, setValueEnabled] = useState(false);
  const [evThreshold, setEvThreshold] = useState(100);
  const [minProbability, setMinProbability] = useState(0.5);
  const [minMarketRatio, setMinMarketRatio] = useState(1.15);

  const winWeak = useMemo(() => bottomBoats(entries, ["win_rate", "national_win_rate", "rate", "racer_win_rate"]), [entries]);
  const motorWeak = useMemo(() => bottomBoats(entries, ["motor_2ren_rate", "motor_2rate", "motor_rate", "motor2_rate", "motor_2_rate"]), [entries]);
  const stWeak = useMemo(() => bottomBoats(entries, ["average_st", "avg_st", "st_average"], 2, { lowerIsBetter: true }), [entries]);
  const exhibitionWeak = useMemo(() => bottomBoats(entries, ["exhibition_time", "official_exhibition_time", "tenji_time", "display_time"], 2, { lowerIsBetter: true }), [entries]);
  const exhibitionWorst = useMemo(() => worstBoat(entries, ["exhibition_time", "official_exhibition_time", "tenji_time", "display_time"], { lowerIsBetter: true }), [entries]);
  const probabilities = useMemo(() => buildTrifectaProbabilities(entries, { live: exhibitionReady }), [entries, exhibitionReady]);
  const marketProbabilities = useMemo(() => buildMarketProbabilities(odds), [odds]);
  const probabilityCount = Object.keys(probabilities).length;
  const valueAvailable = probabilityCount === 120 && oddsCount > 0 && Object.keys(marketProbabilities).length > 0;

  const headProbabilities = useMemo(() => {
    const out = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    for (const bet of ALL_BETS) {
      const probability = probabilityFor(probabilities, bet);
      if (probability !== null) out[bet[0]] += probability;
    }
    return out;
  }, [probabilities]);

  const rules = [
    { key: "win", label: "低勝率艇の1着を消す", description: winWeak.length ? `${winWeak.join("・")}号艇を1着候補から除外` : "勝率データ不足", available: winWeak.length > 0, test: (bet) => !winWeak.includes(bet[0]) },
    { key: "motor", label: "低モーター艇の1着を消す", description: motorWeak.length ? `${motorWeak.join("・")}号艇を1着候補から除外` : "モーターデータ不足", available: motorWeak.length > 0, test: (bet) => !motorWeak.includes(bet[0]) },
    { key: "st", label: "ST劣勢艇の1着を消す", description: stWeak.length ? `${stWeak.join("・")}号艇を1着候補から除外` : "STデータ不足", available: stWeak.length > 0, test: (bet) => !stWeak.includes(bet[0]) },
    { key: "exhibition", label: "展示下位艇の1着を消す", description: exhibitionWeak.length ? `${exhibitionWeak.join("・")}号艇を1着候補から除外` : "展示データ待ち", available: exhibitionReady && exhibitionWeak.length > 0, test: (bet) => !exhibitionWeak.includes(bet[0]) },
    { key: "exhibitionTop2", label: "展示最下位を2着以内から消す", description: exhibitionWorst ? `${exhibitionWorst}号艇を1・2着から除外（攻め条件）` : "展示データ待ち", available: exhibitionReady && Boolean(exhibitionWorst), test: (bet) => bet[0] !== exhibitionWorst && bet[1] !== exhibitionWorst },
  ];

  const result = useMemo(() => {
    let current = ALL_BETS;
    const history = [];
    for (const rule of rules) {
      if (!enabled[rule.key] || !rule.available) continue;
      const before = current.length;
      current = current.filter(rule.test);
      history.push({ key: rule.key, label: rule.label, before, after: current.length, removed: before - current.length });
    }
    if (valueEnabled && valueAvailable) {
      const before = current.length;
      current = current.filter((bet) => {
        const metrics = valueMetrics(probabilities, marketProbabilities, odds, bet);
        return metrics.corrected !== null
          && metrics.corrected * 100 >= minProbability
          && metrics.marketRatio !== null
          && metrics.marketRatio >= minMarketRatio
          && metrics.ev !== null
          && metrics.ev >= evThreshold;
      });
      history.push({
        key: "value",
        label: `価値フィルター（確率${minProbability}%・市場比${minMarketRatio.toFixed(2)}倍・EV${evThreshold}%）`,
        before,
        after: current.length,
        removed: before - current.length,
      });
    }
    return { bets: current, history };
  }, [enabled, winWeak, motorWeak, stWeak, exhibitionWeak, exhibitionWorst, exhibitionReady, valueEnabled, valueAvailable, minProbability, minMarketRatio, evThreshold, probabilities, marketProbabilities, odds]);

  const displayBets = useMemo(() => [...result.bets].sort((a, b) => {
    const ma = valueMetrics(probabilities, marketProbabilities, odds, a);
    const mb = valueMetrics(probabilities, marketProbabilities, odds, b);
    if (valueEnabled) return (mb.ev || -1) - (ma.ev || -1);
    return (mb.corrected || mb.model || -1) - (ma.corrected || ma.model || -1);
  }), [result.bets, probabilities, marketProbabilities, odds, valueEnabled]);

  const toggle = (key) => setEnabled((prev) => ({ ...prev, [key]: !prev[key] }));
  const refresh = () => startTransition(() => router.refresh());
  const removed = 120 - result.bets.length;
  const removalRate = Math.round((removed / 120) * 1000) / 10;

  return (
    <div className={styles.wrap}>
      <section className={styles.summary}>
        <div><span>START</span><strong>120通り</strong></div>
        <div className={styles.arrow}>→</div>
        <div><span>REMAIN</span><strong>{result.bets.length}通り</strong></div>
        <div><span>消去率</span><strong>{removalRate}%</strong></div>
      </section>

      <button className={styles.refresh} onClick={refresh} disabled={isPending}>{isPending ? "再診断中…" : "最新データで再診断"}</button>
      <p className={styles.synced}>レースデータ同期: {syncedAt || "-"}</p>

      <section className={styles.processPanel}>
        <div className={styles.sectionTitle}><span>MODEL β2</span><h2>{exhibitionReady ? "直前" : "事前"}確率モデル</h2></div>
        <div style={{ display: "grid", gap: 6, color: "#45586d", fontSize: 13, fontWeight: 800 }}>
          <div>3連単推定確率：{probabilityCount}/120通り</div>
          <div>1着トップ予測：{exhibitionReady ? "55.1%" : "54.4%"}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6,minmax(0,1fr))", gap: 5, marginTop: 5 }}>
            {[1,2,3,4,5,6].map((boat) => <span key={boat} style={{ textAlign: "center", padding: "7px 2px", borderRadius: 10, background: "#f3f6fa", fontSize: 10 }}>{boat}頭<br/><strong>{(headProbabilities[boat] * 100).toFixed(1)}%</strong></span>)}
          </div>
          <small style={{ color: "#7a8797", lineHeight: 1.6 }}>各艇の「頭確率」の中で3連単20通りへ配分しているため、高配当だけを理由に6号艇頭が膨らまない構造です。</small>
        </div>
      </section>

      <section className={styles.processPanel}>
        <div className={styles.sectionTitle}><span>LIVE ODDS</span><h2>3連単オッズ</h2></div>
        {oddsError ? <div style={{ color: "#a23434", fontSize: 13, fontWeight: 800 }}>オッズ取得エラー：{oddsError}</div> : oddsCount > 0 ? (
          <div style={{ display: "grid", gap: 6, color: "#45586d", fontSize: 13, fontWeight: 800 }}><div>取得：{oddsCount}/120通り</div><div>更新：{oddsFetchedAt || "-"}</div><div>取得元：{oddsSource || "-"}</div></div>
        ) : <p className={styles.empty}>現在オッズはまだ取得できません。</p>}
      </section>

      <section className={styles.rulePanel}>
        <div className={styles.sectionTitle}><span>STEP 1</span><h2>消去条件を選ぶ</h2></div>
        <div className={styles.rules}>{rules.map((rule) => (
          <button key={rule.key} className={`${styles.rule} ${enabled[rule.key] && rule.available ? styles.active : ""}`} onClick={() => rule.available && toggle(rule.key)} disabled={!rule.available}>
            <span className={styles.switch}>{enabled[rule.key] && rule.available ? "ON" : "OFF"}</span>
            <span><strong>{rule.label}</strong><small>{rule.description}</small></span>
          </button>
        ))}</div>
      </section>

      <section className={styles.rulePanel}>
        <div className={styles.sectionTitle}><span>VALUE β2</span><h2>価値フィルター</h2></div>
        <button className={`${styles.rule} ${valueEnabled && valueAvailable ? styles.active : ""}`} onClick={() => valueAvailable && setValueEnabled((value) => !value)} disabled={!valueAvailable}>
          <span className={styles.switch}>{valueEnabled && valueAvailable ? "ON" : "OFF"}</span>
          <span><strong>高オッズだけの目を除外して価値のある目を残す</strong><small>{valueAvailable ? `最低確率 ${minProbability}% / 市場比 ${minMarketRatio.toFixed(2)}倍 / EV ${evThreshold}%` : "確率またはオッズデータ待ち"}</small></span>
        </button>

        <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
          <div><small style={{ fontWeight: 900, color: "#657487" }}>最低推定確率</small><div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6, marginTop: 5 }}>{[0.3,0.5,1.0].map((value) => <button key={value} onClick={() => setMinProbability(value)} style={{ padding: 9, borderRadius: 10, border: value === minProbability ? "2px solid #ef7b22" : "1px solid #dfe6ef", background: value === minProbability ? "#fff7ed" : "#fff", fontWeight: 900 }}>{value}%</button>)}</div></div>
          <div><small style={{ fontWeight: 900, color: "#657487" }}>市場よりどれだけ高く評価するか</small><div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6, marginTop: 5 }}>{[1.05,1.15,1.30].map((value) => <button key={value} onClick={() => setMinMarketRatio(value)} style={{ padding: 9, borderRadius: 10, border: value === minMarketRatio ? "2px solid #ef7b22" : "1px solid #dfe6ef", background: value === minMarketRatio ? "#fff7ed" : "#fff", fontWeight: 900 }}>{value.toFixed(2)}倍</button>)}</div></div>
          <div><small style={{ fontWeight: 900, color: "#657487" }}>推定EV</small><div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6, marginTop: 5 }}>{[80,100,120].map((value) => <button key={value} onClick={() => setEvThreshold(value)} style={{ padding: 9, borderRadius: 10, border: value === evThreshold ? "2px solid #ef7b22" : "1px solid #dfe6ef", background: value === evThreshold ? "#fff7ed" : "#fff", fontWeight: 900 }}>{value}%</button>)}</div></div>
        </div>
        <p style={{ margin: "10px 0 0", color: "#7a8797", fontSize: 11, lineHeight: 1.7, fontWeight: 700 }}>推定確率はモデル75%＋市場25%で補正。単純な「確率×高オッズ」だけでは残しません。</p>
      </section>

      <section className={styles.processPanel}>
        <div className={styles.sectionTitle}><span>STEP 2</span><h2>消去の流れ</h2></div>
        {result.history.length === 0 ? <p className={styles.empty}>条件をONにすると、120通りから順番に削られます。</p> : result.history.map((item) => <div className={styles.process} key={item.key}><span>{item.label}</span><strong>{item.before} → {item.after}</strong><em>-{item.removed}通り</em></div>)}
      </section>

      <section className={styles.betPanel}>
        <div className={styles.sectionTitle}><span>STEP 3</span><h2>残った買い目</h2></div>
        {displayBets.length === 0 ? <div className={styles.skip}><strong>見送り</strong><p>現在の条件では買い目が残りません。無理に買い目を作らない判定です。</p></div> : (
          <div className={styles.bets}>{displayBets.map((bet) => {
            const m = valueMetrics(probabilities, marketProbabilities, odds, bet);
            return <span key={betKey(bet)} style={{ display: "grid", gap: 3 }}>
              <strong>{betKey(bet)}</strong>
              <small style={{ fontSize: 10, color: "#66778a" }}>補正推定 {m.corrected !== null ? `${(m.corrected * 100).toFixed(2)}%` : "-"}</small>
              <small style={{ fontSize: 10, color: "#66778a" }}>市場 {m.market !== null ? `${(m.market * 100).toFixed(2)}%` : "-"} / 比 {m.marketRatio !== null ? `${m.marketRatio.toFixed(2)}倍` : "-"}</small>
              <small style={{ fontSize: 10, color: m.currentOdds ? "#c45b12" : "#8b98a6" }}>{m.currentOdds ? `${m.currentOdds}倍` : "オッズ未取得"}</small>
              <small style={{ fontSize: 10, color: m.ev !== null && m.ev >= 100 ? "#16834d" : "#8b5560", fontWeight: 1000 }}>{m.ev !== null ? `推定EV ${m.ev.toFixed(0)}%` : "EV -"}</small>
            </span>;
          })}</div>
        )}
      </section>

      <aside className={styles.note}>VALUE β2は「最低確率」「市場との乖離」「推定EV」の3条件で消去します。高オッズだけを理由に残す設計ではありません。推定値は回収率や利益を保証するものではありません。</aside>
    </div>
  );
}
