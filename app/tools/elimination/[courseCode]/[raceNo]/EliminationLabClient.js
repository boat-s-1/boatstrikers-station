"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
    .sort((a, b) => lowerIsBetter ? a.value - b.value : b.value - a.value);
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

function oddsFor(odds, bet) {
  const value = Number(odds?.[bet.join("-")]);
  return Number.isFinite(value) && value > 0 ? value : null;
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

  const winWeak = useMemo(() => bottomBoats(entries, ["win_rate", "national_win_rate", "rate", "racer_win_rate"]), [entries]);
  const motorWeak = useMemo(() => bottomBoats(entries, ["motor_2ren_rate", "motor_2rate", "motor_rate", "motor2_rate"]), [entries]);
  const stWeak = useMemo(() => bottomBoats(entries, ["average_st", "avg_st", "st_average"], 2, { lowerIsBetter: true }), [entries]);
  const exhibitionWeak = useMemo(() => bottomBoats(entries, ["exhibition_time", "tenji_time", "display_time"], 2, { lowerIsBetter: true }), [entries]);
  const exhibitionWorst = useMemo(() => worstBoat(entries, ["exhibition_time", "tenji_time", "display_time"], { lowerIsBetter: true }), [entries]);

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
    return { bets: current, history };
  }, [enabled, winWeak, motorWeak, stWeak, exhibitionWeak, exhibitionWorst, exhibitionReady]);

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

      <button className={styles.refresh} onClick={refresh} disabled={isPending}>
        {isPending ? "再診断中…" : "最新データで再診断"}
      </button>
      <p className={styles.synced}>レースデータ同期: {syncedAt || "-"}</p>

      <section className={styles.processPanel}>
        <div className={styles.sectionTitle}><span>LIVE ODDS</span><h2>3連単オッズ</h2></div>
        {oddsError ? (
          <div style={{ color: "#a23434", fontSize: 13, fontWeight: 800, lineHeight: 1.7 }}>
            オッズ取得エラー：{oddsError}
          </div>
        ) : oddsCount > 0 ? (
          <div style={{ display: "grid", gap: 6, color: "#45586d", fontSize: 13, fontWeight: 800 }}>
            <div>取得：{oddsCount}/120通り</div>
            <div>更新：{oddsFetchedAt || "-"}</div>
            <div>取得元：{oddsSource || "-"}</div>
          </div>
        ) : (
          <p className={styles.empty}>現在オッズはまだ取得できません。</p>
        )}
      </section>

      <section className={styles.rulePanel}>
        <div className={styles.sectionTitle}><span>STEP 1</span><h2>消去条件を選ぶ</h2></div>
        <div className={styles.rules}>
          {rules.map((rule) => (
            <button key={rule.key} className={`${styles.rule} ${enabled[rule.key] && rule.available ? styles.active : ""}`} onClick={() => rule.available && toggle(rule.key)} disabled={!rule.available}>
              <span className={styles.switch}>{enabled[rule.key] && rule.available ? "ON" : "OFF"}</span>
              <span><strong>{rule.label}</strong><small>{rule.description}</small></span>
            </button>
          ))}
        </div>
      </section>

      <section className={styles.processPanel}>
        <div className={styles.sectionTitle}><span>STEP 2</span><h2>消去の流れ</h2></div>
        {result.history.length === 0 ? <p className={styles.empty}>条件をONにすると、120通りから順番に削られます。</p> : result.history.map((item) => (
          <div className={styles.process} key={item.key}>
            <span>{item.label}</span><strong>{item.before} → {item.after}</strong><em>-{item.removed}通り</em>
          </div>
        ))}
      </section>

      <section className={styles.betPanel}>
        <div className={styles.sectionTitle}><span>STEP 3</span><h2>残った買い目</h2></div>
        {result.bets.length === 0 ? (
          <div className={styles.skip}><strong>見送り</strong><p>現在の消去条件では買い目が残りません。無理に買い目を作らない判定です。</p></div>
        ) : (
          <div className={styles.bets}>
            {result.bets.map((bet) => {
              const currentOdds = oddsFor(odds, bet);
              return (
                <span key={bet.join("-")} style={{ display: "grid", gap: 3 }}>
                  <strong>{bet.join("-")}</strong>
                  <small style={{ fontSize: 10, color: currentOdds ? "#c45b12" : "#8b98a6" }}>
                    {currentOdds ? `${currentOdds}倍` : "オッズ未取得"}
                  </small>
                </span>
              );
            })}
          </div>
        )}
      </section>

      <aside className={styles.note}>現在は公式3連単オッズの取得・表示まで接続しています。次段階で、予測確率とオッズを組み合わせた期待値フィルターを追加します。過去回収率や将来の利益を保証する表示は行いません。</aside>
    </div>
  );
}
