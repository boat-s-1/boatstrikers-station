"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./MonthlyPerformanceSlider.module.css";

const MODES = [
  { key: "equal", label: "均等買い", note: "各買い目を同額で購入した場合" },
  { key: "confidence", label: "自信配分", note: "AIの自信度に合わせた資金配分" },
  { key: "odds", label: "オッズ配分", note: "オッズを考慮した資金配分" },
];

function formatNumber(value, digits = 1) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("ja-JP", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatYen(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `${Math.round(n).toLocaleString("ja-JP")}円`;
}

function MetricCard({ label, value, suffix = "" }) {
  return (
    <div className={styles.metricCard}>
      <span>{label}</span>
      <strong>
        {value}
        {value !== "—" && suffix ? <small>{suffix}</small> : null}
      </strong>
    </div>
  );
}

function BetCard({ item }) {
  return (
    <article className={styles.betCard}>
      <div className={styles.betTop}>
        <strong>{item.courseName}{item.raceNo}R</strong>
        {item.isHit == null ? null : (
          <span className={item.isHit ? styles.hitBadge : styles.missBadge}>
            {item.isHit ? "的中" : "不的中"}
          </span>
        )}
      </div>
      <div className={styles.betFormation}>{item.formation || item.tickets?.join(" / ") || "—"}</div>
      <div className={styles.betMeta}>
        <span>{item.characterLabel}</span>
        {item.investment ? <span>投資 {formatYen(item.investment)}</span> : null}
        {item.isHit ? <span>払戻 {formatYen(item.payout)}</span> : null}
      </div>
    </article>
  );
}

export default function MonthlyPerformanceSlider({ initialEqualStats }) {
  const sliderRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/home-performance", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!cancelled && data) setDetail(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const modes = useMemo(() => {
    const equal = detail?.modes?.equal || {
      ready: true,
      stats: initialEqualStats,
      bets: [],
    };
    return {
      equal,
      confidence: detail?.modes?.confidence || { ready: false, stats: null, bets: [] },
      odds: detail?.modes?.odds || { ready: false, stats: null, bets: [] },
    };
  }, [detail, initialEqualStats]);

  function goTo(index) {
    const slider = sliderRef.current;
    const slide = slider?.children[index];
    if (!slider || !slide) return;
    slider.scrollTo({ left: slide.offsetLeft, behavior: "smooth" });
    setActiveIndex(index);
  }

  function handleScroll() {
    const slider = sliderRef.current;
    if (!slider) return;
    const index = Math.round(slider.scrollLeft / Math.max(1, slider.clientWidth));
    setActiveIndex(Math.max(0, Math.min(MODES.length - 1, index)));
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.tabs} role="tablist" aria-label="資金配分方式">
        {MODES.map((mode, index) => (
          <button
            key={mode.key}
            type="button"
            role="tab"
            aria-selected={activeIndex === index}
            className={activeIndex === index ? styles.activeTab : ""}
            onClick={() => goTo(index)}
          >
            {mode.label}
          </button>
        ))}
      </div>

      <div className={styles.swipeHint}>← 横にスライドして切り替え →</div>

      <div ref={sliderRef} className={styles.slider} onScroll={handleScroll}>
        {MODES.map((mode) => {
          const data = modes[mode.key];
          const stats = data?.stats || {};
          return (
            <section className={styles.slide} key={mode.key} role="tabpanel">
              <div className={styles.modeHeader}>
                <div>
                  <strong>{mode.label}</strong>
                  <span>{mode.note}</span>
                </div>
                {!data?.ready ? <b className={styles.preparing}>準備中</b> : null}
              </div>

              <div className={styles.metrics}>
                <MetricCard label="予想レース数" value={data?.ready ? Number(stats.totalRace || 0).toLocaleString("ja-JP") : "—"} suffix="R" />
                <MetricCard label="的中率" value={data?.ready ? formatNumber(stats.hitRate) : "—"} suffix="%" />
                <MetricCard label="回収率" value={data?.ready ? formatNumber(stats.recoveryRate) : "—"} suffix="%" />
                <MetricCard label="最高配当" value={data?.ready ? Math.round(Number(stats.maxPayout || 0)).toLocaleString("ja-JP") : "—"} suffix="円" />
              </div>

              {data?.ready ? (
                <div className={styles.betsArea}>
                  <div className={styles.betsHeading}>
                    <strong>今月の買い目</strong>
                    <span>最新順</span>
                  </div>
                  {Array.isArray(data.bets) && data.bets.length ? (
                    <div className={styles.betGrid}>
                      {data.bets.slice(0, 8).map((item) => (
                        <BetCard key={`${item.raceDate}-${item.courseCode}-${item.raceNo}-${item.characterCode}`} item={item} />
                      ))}
                    </div>
                  ) : (
                    <p className={styles.noBets}>買い目データを読み込み中です。</p>
                  )}
                </div>
              ) : (
                <div className={styles.pendingBox}>
                  <strong>{mode.label}は資金配分ルール確定後に自動集計します</strong>
                  <p>画面と集計枠は先に実装済みです。買い目数や配分方法を変更しても、このタブのまま対応できます。</p>
                </div>
              )}
            </section>
          );
        })}
      </div>

      <div className={styles.dots} aria-hidden="true">
        {MODES.map((mode, index) => (
          <span key={mode.key} className={activeIndex === index ? styles.activeDot : ""} />
        ))}
      </div>
    </div>
  );
}
