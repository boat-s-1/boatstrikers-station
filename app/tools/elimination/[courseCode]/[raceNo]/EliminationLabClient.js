"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { buildTrifectaProbabilities, probabilityFor } from "./eliminationProbability";
import styles from "./elimination-lab.module.css";

const BOATS = [1, 2, 3, 4, 5, 6];
const RULE_BACKTESTS = {
  exhibition456: { races: 59843, elimination: 44.9, survival: 81.86, miss: 18.14 },
  exhibition6top2: { races: 59843, elimination: 32.1, survival: 82.38, miss: 17.62 },
  exhibition56top2: { races: 59843, elimination: 57.7, survival: 62.8, miss: 37.2 },
  st: { races: 7123, elimination: 29.7, survival: 91.13, miss: 8.87 },
  motor: { races: 59847, elimination: 28.1, survival: 87.1, miss: 12.9 },
  win: { races: 59847, elimination: 29.8, survival: 93.23, miss: 6.77 },
};

const LEVELS = {
  safe: { label: "安全", fg: "#17663a", bg: "#eefaf3", border: "#b8e3c7" },
  standard: { label: "標準", fg: "#9a6700", bg: "#fff8e6", border: "#f2d58b" },
  attack: { label: "攻め", fg: "#b42318", bg: "#fff0f0", border: "#f1b8b5" },
};

const ALL_BETS = (() => {
  const bets = [];
  for (const a of BOATS) {
    for (const b of BOATS) {
      if (a === b) continue;
      for (const c of BOATS) {
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
  return entries
    .map((entry) => ({ boat: boatNo(entry), value: get(entry, keys) }))
    .filter((row) => row.boat >= 1 && row.boat <= 6 && row.value !== null)
    .sort((a, b) => lowerIsBetter ? a.value - b.value : b.value - a.value);
}
function bottomBoats(entries, keys, count = 2, options = {}) {
  const ranked = rankBoats(entries, keys, options);
  return ranked.length >= 4 ? ranked.slice(-count).map((row) => row.boat) : [];
}
function worstBoat(entries, keys, options = {}) {
  const ranked = rankBoats(entries, keys, options);
  return ranked.length >= 4 ? ranked[ranked.length - 1]?.boat ?? null : null;
}
function buildMarketProbabilities(odds) {
  const raw = {};
  let total = 0;
  for (const bet of ALL_BETS) {
    const currentOdds = oddsFor(odds, bet);
    if (!currentOdds) continue;
    const p = 1 / currentOdds;
    raw[betKey(bet)] = p;
    total += p;
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
function levelFor(backtest) {
  if (backtest.survival >= 90) return "safe";
  if (backtest.survival >= 80) return "standard";
  return "attack";
}

function OddsRow({ bet, odds, evaluation, probabilities, marketProbabilities, expanded, onToggle }) {
  const key = betKey(bet);
  const state = evaluation.map[key] || { eliminated: false, restored: false, reasons: [] };
  const metrics = valueMetrics(probabilities, marketProbabilities, odds, bet);
  const currentOdds = metrics.currentOdds;
  const className = state.restored ? styles.oddsRowRestored : state.eliminated ? styles.oddsRowEliminated : styles.oddsRowAlive;
  const status = state.restored ? "補正復活" : state.eliminated ? "消去" : state.lane1Protected ? "1号艇保護" : "残す";
  return (
    <button type="button" className={`${styles.oddsRow} ${className}`} onClick={onToggle}>
      <div className={styles.oddsMain}>
        <strong>{key}</strong>
        <span>{currentOdds ? `${currentOdds}倍` : "-"}</span>
      </div>
      <div className={styles.oddsStatus}>{status}</div>
      {expanded && (
        <div className={styles.oddsDetail}>
          <span>補正推定 {metrics.corrected !== null ? `${(metrics.corrected * 100).toFixed(2)}%` : "-"}</span>
          <span>市場 {metrics.market !== null ? `${(metrics.market * 100).toFixed(2)}%` : "-"}</span>
          <span>市場比 {metrics.ratio !== null ? `${metrics.ratio.toFixed(2)}倍` : "-"}</span>
          <span>推定EV {metrics.ev !== null ? `${metrics.ev.toFixed(0)}%` : "-"}</span>
          {state.reasons.length > 0 && <small>{state.reasons.join(" / ")}</small>}
        </div>
      )}
    </button>
  );
}

export default function EliminationLabClient({
  entries, premiumAccess = false, syncedAt, exhibitionReady,
  odds = {}, oddsCount = 0, oddsFetchedAt = null, oddsSource = null, oddsError = null,
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [enabled, setEnabled] = useState({ exhibition456: false, exhibition6top2: false, exhibition56top2: false, st: false, motor: false, win: false });
  const [a1Correction, setA1Correction] = useState(false);
  const [valueEnabled, setValueEnabled] = useState(false);
  const [evThreshold, setEvThreshold] = useState(100);
  const [activeFirst, setActiveFirst] = useState(1);
  const [expandedBet, setExpandedBet] = useState(null);

  const exhibitionBottom3 = useMemo(() => bottomBoats(entries, ["exhibition_time", "official_exhibition_time", "tenji_time", "display_time"], 3, { lowerIsBetter: true }), [entries]);
  const exhibitionBottom2 = useMemo(() => bottomBoats(entries, ["exhibition_time", "official_exhibition_time", "tenji_time", "display_time"], 2, { lowerIsBetter: true }), [entries]);
  const exhibitionWorst = useMemo(() => worstBoat(entries, ["exhibition_time", "official_exhibition_time", "tenji_time", "display_time"], { lowerIsBetter: true }), [entries]);
  const stBottom2 = useMemo(() => bottomBoats(entries, ["average_st", "avg_st", "st_average"], 2, { lowerIsBetter: true }), [entries]);
  const motorBottom2 = useMemo(() => bottomBoats(entries, ["motor_2_rate", "motor_top2_rate", "motor_2ren_rate", "motor_rate"], 2), [entries]);
  const winBottom2 = useMemo(() => bottomBoats(entries, ["national_win_rate", "win_rate", "racer_win_rate"], 2), [entries]);
  const a1Boats = useMemo(() => entries.filter((entry) => String(entry?.racer_class ?? entry?.class ?? "").toUpperCase() === "A1").map(boatNo), [entries]);

  const probabilities = useMemo(() => buildTrifectaProbabilities(entries, { live: exhibitionReady }), [entries, exhibitionReady]);
  const marketProbabilities = useMemo(() => buildMarketProbabilities(odds), [odds]);
  const valueAvailable = Object.keys(probabilities).length === 120 && oddsCount > 0 && Object.keys(marketProbabilities).length > 0;

  const rules = [
    { key: "win", label: "勝率下位2艇を1着から消す", desc: winBottom2.length ? `${winBottom2.join("・")}号艇の1着目を消去` : "勝率データ不足", available: winBottom2.length === 2, firstBoats: winBottom2, secondBoats: [], backtest: RULE_BACKTESTS.win },
    { key: "st", label: "ST下位2艇を1着から消す", desc: stBottom2.length ? `${stBottom2.join("・")}号艇の1着目を消去` : "STデータ不足", available: stBottom2.length === 2, firstBoats: stBottom2, secondBoats: [], backtest: RULE_BACKTESTS.st },
    { key: "motor", label: "モーター下位2艇を1着から消す", desc: motorBottom2.length ? `${motorBottom2.join("・")}号艇の1着目を消去` : "モーターデータ不足", available: motorBottom2.length === 2, firstBoats: motorBottom2, secondBoats: [], backtest: RULE_BACKTESTS.motor },
    { key: "exhibition456", free: true, label: "展示4〜6位を1着から消す", desc: exhibitionBottom3.length ? `${exhibitionBottom3.join("・")}号艇の1着目を消去` : "展示データ待ち", available: exhibitionReady && exhibitionBottom3.length === 3, firstBoats: exhibitionBottom3, secondBoats: [], backtest: RULE_BACKTESTS.exhibition456 },
    { key: "exhibition6top2", label: "展示6位を2着以内から消す", desc: exhibitionWorst ? `${exhibitionWorst}号艇の1・2着目を消去` : "展示データ待ち", available: exhibitionReady && Boolean(exhibitionWorst), firstBoats: exhibitionWorst ? [exhibitionWorst] : [], secondBoats: exhibitionWorst ? [exhibitionWorst] : [], backtest: RULE_BACKTESTS.exhibition6top2, recommended: true },
    { key: "exhibition56top2", label: "展示5〜6位を2着以内から消す", desc: exhibitionBottom2.length ? `${exhibitionBottom2.join("・")}号艇の1・2着目を消去` : "展示データ待ち", available: exhibitionReady && exhibitionBottom2.length === 2, firstBoats: exhibitionBottom2, secondBoats: exhibitionBottom2, backtest: RULE_BACKTESTS.exhibition56top2, warning: "的中目を37.2%消す強攻め条件" },
  ].map((rule) => ({ ...rule, level: levelFor(rule.backtest) }));

  const lane1Danger = useMemo(() => {
    const factors = [];
    const exhibitionSelected = (
      enabled.exhibition456 && exhibitionReady && exhibitionBottom3.includes(1)
    ) || (
      premiumAccess && enabled.exhibition6top2 && exhibitionReady && exhibitionWorst === 1
    ) || (
      premiumAccess && enabled.exhibition56top2 && exhibitionReady && exhibitionBottom2.includes(1)
    );
    if (exhibitionSelected) factors.push("展示劣勢");
    if (premiumAccess && enabled.st && stBottom2.includes(1)) factors.push("ST劣勢");
    if (premiumAccess && enabled.motor && motorBottom2.includes(1)) factors.push("モーター劣勢");
    if (premiumAccess && enabled.win && winBottom2.includes(1)) factors.push("勝率劣勢");
    return { score: factors.length, factors, eliminate: factors.length >= 3 };
  }, [enabled, premiumAccess, exhibitionReady, exhibitionBottom3, exhibitionBottom2, exhibitionWorst, stBottom2, motorBottom2, winBottom2]);

  const evaluation = useMemo(() => {
    const map = {};
    let remain = 0;
    for (const bet of ALL_BETS) {
      const reasons = [];
      const firstReasons = [];
      let secondElimination = false;

      for (const rule of rules) {
        if (!enabled[rule.key] || !rule.available) continue;
        if (!premiumAccess && !rule.free) continue;

        const firstHit = rule.firstBoats.includes(bet[0]);
        const secondHit = rule.secondBoats.includes(bet[1]);
        if (firstHit) {
          if (bet[0] === 1) firstReasons.push(rule.label);
          else reasons.push(rule.label);
        }
        if (secondHit) {
          secondElimination = true;
          reasons.push(`${rule.label}（2着条件）`);
        }
      }

      let lane1Protected = false;
      if (bet[0] === 1 && firstReasons.length > 0) {
        if (lane1Danger.eliminate) {
          reasons.push(`1号艇危険スコア ${lane1Danger.score}/4`);
          reasons.push(...lane1Danger.factors);
        } else {
          lane1Protected = true;
          reasons.push(`1号艇保護 ${lane1Danger.score}/4（3条件未満）`);
        }
      }

      const lane1HeadEliminated = bet[0] === 1 && firstReasons.length > 0 && lane1Danger.eliminate;
      const rawEliminated = reasons.some((reason) => !reason.startsWith("1号艇保護")) && (
        bet[0] !== 1 || lane1HeadEliminated || secondElimination || reasons.some((reason) => !reason.includes("1号艇") && !lane1Danger.factors.includes(reason))
      );
      const hasNonHeadElimination = secondElimination || (bet[0] !== 1 && reasons.length > 0);
      const restored = rawEliminated && premiumAccess && a1Correction && a1Boats.includes(bet[0]) && !hasNonHeadElimination;
      let eliminated = rawEliminated && !restored;

      if (!eliminated && premiumAccess && valueEnabled && valueAvailable) {
        const metrics = valueMetrics(probabilities, marketProbabilities, odds, bet);
        if (metrics.corrected === null || metrics.corrected * 100 < 0.5 || metrics.ratio === null || metrics.ratio < 1.15 || metrics.ev === null || metrics.ev < evThreshold) {
          eliminated = true;
          lane1Protected = false;
          reasons.push(`VALUE ${evThreshold}%未満`);
        }
      }

      if (!eliminated) remain += 1;
      map[betKey(bet)] = { eliminated, restored, lane1Protected: lane1Protected && !eliminated, reasons };
    }
    return { map, remain };
  }, [enabled, premiumAccess, a1Correction, a1Boats, valueEnabled, valueAvailable, evThreshold, probabilities, marketProbabilities, odds, lane1Danger, exhibitionBottom3, exhibitionBottom2, exhibitionWorst, stBottom2, motorBottom2, winBottom2]);

  const headCounts = useMemo(() => {
    const result = {};
    for (const first of BOATS) {
      const bets = ALL_BETS.filter((bet) => bet[0] === first);
      result[first] = bets.filter((bet) => !evaluation.map[betKey(bet)]?.eliminated).length;
    }
    return result;
  }, [evaluation]);

  const toggleRule = (rule) => {
    if (!rule.available) return;
    if (!premiumAccess && !rule.free) return;
    setEnabled((prev) => ({ ...prev, [rule.key]: !prev[rule.key] }));
  };
  const refresh = () => startTransition(() => router.refresh());
  const removed = 120 - evaluation.remain;
  const removalRate = Math.round((removed / 120) * 1000) / 10;
  const activeBets = ALL_BETS.filter((bet) => bet[0] === activeFirst);

  return (
    <div className={styles.wrap}>
      {!premiumAccess && (
        <section className={styles.freeTrial}>
          <strong>FREE TRIAL</strong>
          <p>無料では「展示4〜6位を1着から消す」を体験できます。1号艇は単独条件では消さず、複数の危険条件が重なった時だけ1着消去になります。</p>
        </section>
      )}

      <section className={styles.summary}>
        <div><span>START</span><strong>120通り</strong></div><div className={styles.arrow}>→</div>
        <div><span>REMAIN</span><strong>{evaluation.remain}通り</strong></div><div><span>消去率</span><strong>{removalRate}%</strong></div>
      </section>

      <button className={styles.refresh} onClick={refresh} disabled={isPending}>{isPending ? "再診断中…" : "最新データで再診断"}</button>
      <p className={styles.synced}>レースデータ同期: {syncedAt || "-"} / オッズ: {oddsFetchedAt || "-"}</p>

      <section className={styles.processPanel}>
        <div className={styles.sectionTitle}><span>LANE 1 GUARD</span><h2>1号艇保護判定</h2></div>
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <strong style={{ fontSize: 18, color: lane1Danger.eliminate ? "#b42318" : "#17663a" }}>危険スコア {lane1Danger.score}/4</strong>
            <span style={{ padding: "6px 10px", borderRadius: 999, fontSize: 11, fontWeight: 1000, background: lane1Danger.eliminate ? "#fff0f0" : "#eefaf3", color: lane1Danger.eliminate ? "#b42318" : "#17663a" }}>{lane1Danger.eliminate ? "1頭消去条件成立" : "1頭は保護"}</span>
          </div>
          <small style={{ color: "#6f7f90", lineHeight: 1.7, fontWeight: 700 }}>展示・ST・モーター・勝率の4系統のうち、選択中の条件で1号艇に3つ以上の危険要素が重なった時だけ「1号艇1着」を消します。</small>
          {lane1Danger.factors.length > 0 && <div style={{ fontSize: 12, fontWeight: 800, color: "#526477" }}>該当：{lane1Danger.factors.join(" / ")}</div>}
        </div>
      </section>

      <section className={styles.rulePanel}>
        <div className={styles.sectionTitle}><span>STEP 1</span><h2>消去条件を選ぶ</h2></div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "-2px 0 10px" }}>
          {Object.values(LEVELS).map((level) => <span key={level.label} style={{ padding: "4px 9px", borderRadius: 999, border: `1px solid ${level.border}`, background: level.bg, color: level.fg, fontSize: 10, fontWeight: 1000 }}>{level.label}</span>)}
        </div>
        <p style={{ margin: "0 0 12px", color: "#718096", fontSize: 11, lineHeight: 1.7, fontWeight: 700 }}>安全＝的中残存90%以上 / 標準＝80〜89.99% / 攻め＝80%未満。過去成績は各条件を単独ONにし、現在の1号艇保護を適用した検証です。</p>
        <div className={styles.rules}>
          {rules.map((rule) => {
            const locked = !premiumAccess && !rule.free;
            const bt = rule.backtest;
            const level = LEVELS[rule.level];
            return (
              <button key={rule.key} className={`${styles.rule} ${enabled[rule.key] && !locked ? styles.active : ""}`} onClick={() => toggleRule(rule)} disabled={!rule.available} style={locked ? { opacity: .62 } : undefined}>
                <span className={styles.switch}>{locked ? "🔒" : enabled[rule.key] ? "ON" : "OFF"}</span>
                <span>
                  <span style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <strong>{rule.label}{rule.free ? "  FREE" : ""}</strong>
                    <em style={{ fontStyle: "normal", padding: "3px 7px", borderRadius: 999, border: `1px solid ${level.border}`, background: level.bg, color: level.fg, fontSize: 9, fontWeight: 1000 }}>{level.label}</em>
                    {rule.recommended && <em style={{ fontStyle: "normal", padding: "3px 7px", borderRadius: 999, background: "#edf3fb", color: "#2c5f97", fontSize: 9, fontWeight: 1000 }}>おすすめ</em>}
                  </span>
                  <small>{locked ? "プレミアム会員限定" : rule.desc}</small>
                  {rule.warning && <small style={{ marginTop: 5, color: "#b42318", fontWeight: 1000 }}>⚠ {rule.warning}</small>}
                  <small style={{ marginTop: 7, color: level.fg, fontWeight: 1000 }}>過去{bt.races.toLocaleString()}R｜平均消去率 {bt.elimination}%｜的中残存率 {bt.survival}%</small>
                  <small style={{ marginTop: 2, color: "#8a97a6" }}>的中目を消した率 {bt.miss}%</small>
                </span>
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
        {premiumAccess && <div className={styles.evButtons}>{[80,100,120].map((v) => <button key={v} onClick={() => setEvThreshold(v)} className={evThreshold === v ? styles.evActive : ""}>{v}%</button>)}</div>}
      </section>

      <section className={styles.betPanel}>
        <div className={styles.sectionTitle}><span>STEP 2</span><h2>3連単オッズ表</h2></div>
        {oddsError && <p className={styles.oddsError}>オッズ取得エラー：{oddsError}</p>}
        <p className={styles.legend}>白＝残す / グレー＝消去 / 黄＝補正で復活。1号艇は単独条件では保護されます。買い目をタップすると詳細を表示します。</p>

        <div className={styles.mobileOdds}>
          <div className={styles.headTabs}>
            {BOATS.map((first) => (
              <button key={first} type="button" className={activeFirst === first ? styles.headTabActive : ""} onClick={() => { setActiveFirst(first); setExpandedBet(null); }}>
                <strong>{first}頭</strong><small>{headCounts[first]}/20</small>
              </button>
            ))}
          </div>
          <div className={styles.mobileOddsHeader}><strong>{activeFirst}号艇 1着</strong><span>残り {headCounts[activeFirst]}/20</span></div>
          <div className={styles.mobileRows}>
            {activeBets.map((bet) => (
              <OddsRow key={betKey(bet)} bet={bet} odds={odds} evaluation={evaluation} probabilities={probabilities} marketProbabilities={marketProbabilities} expanded={expandedBet === betKey(bet)} onToggle={() => setExpandedBet((prev) => prev === betKey(bet) ? null : betKey(bet))} />
            ))}
          </div>
        </div>

        <div className={styles.desktopOdds}>
          {BOATS.map((first) => (
            <div className={styles.oddsColumn} key={first}>
              <div className={styles.oddsColumnHeader}><strong>{first}号艇 1着</strong><small>{headCounts[first]}/20</small></div>
              {ALL_BETS.filter((bet) => bet[0] === first).map((bet) => (
                <OddsRow key={betKey(bet)} bet={bet} odds={odds} evaluation={evaluation} probabilities={probabilities} marketProbabilities={marketProbabilities} expanded={false} onToggle={() => {}} />
              ))}
            </div>
          ))}
        </div>
      </section>

      <aside className={styles.note}>「安全・標準・攻め」は過去の的中残存率による目安です。攻め条件は買い目を大きく削れますが、的中目も多く消します。1号艇は単独条件では切らず、危険条件が3系統以上重なった時だけ1着消去します。過去成績やVALUEは将来の結果・回収率・利益を保証するものではありません。</aside>
    </div>
  );
}
