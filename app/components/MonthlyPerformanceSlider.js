"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./MonthlyPerformanceSlider.module.css";

const MODES = [
  { key: "equal", label: "均等買い", note: "全買い目を100円で購入" },
  { key: "confidence", label: "自信配分", note: "自信上位300円・中間200円・下位100円" },
  { key: "odds", label: "オッズ配分", note: "低オッズ側300円・中間200円・高オッズ側100円" },
];

function formatNumber(value, digits = 1) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("ja-JP", { minimumFractionDigits: digits, maximumFractionDigits: digits });
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
      <strong>{value}{value !== "—" && suffix ? <small>{suffix}</small> : null}</strong>
    </div>
  );
}

function TicketChip({ ticket, isHit, stake }) {
  return (
    <div className={`${styles.ticketChip} ${isHit ? styles.ticketChipHit : ""}`}>
      <span className={styles.ticketText}>{ticket}</span>
      {stake ? <small className={styles.ticketStake}>{Number(stake).toLocaleString("ja-JP")}円</small> : null}
      {isHit ? <span className={styles.ticketHitMark}>HIT</span> : null}
    </div>
  );
}

function BetCard({ item }) {
  const tickets = Array.isArray(item.tickets) ? item.tickets : [];
  const hitTicket = item.isHit ? String(item.resultCombination || "") : "";

  return (
    <article className={styles.betCard}>
      <div className={styles.betTop}>
        <strong>{item.courseName}{item.raceNo}R</strong>
        {item.isHit == null ? null : (
          <span className={item.isHit ? styles.hitBadge : styles.missBadge}>{item.isHit ? "的中" : "不的中"}</span>
        )}
      </div>

      <div className={styles.betSectionHead}>
        <strong>買い目</strong>
        <span>（{tickets.length}点）</span>
      </div>

      <div className={styles.ticketGrid}>
        {tickets.length ? tickets.map((ticket) => (
          <TicketChip
            key={ticket}
            ticket={ticket}
            isHit={ticket === hitTicket}
            stake={item.stakes?.[ticket]}
          />
        )) : <span className={styles.emptyTickets}>—</span>}
      </div>

      <div className={styles.betMeta}>
        <span>{item.characterLabel}</span>
        {item.investment ? <span>投資 {formatYen(item.investment)}</span> : null}
        {item.isHit ? <span className={styles.payoutMeta}>払戻 {formatYen(item.payout)}</span> : null}
      </div>
    </article>
  );
}

export default function MonthlyPerformanceSlider({ initialEqualStats, character }) {
  const sliderRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const query = character ? `?character=${encodeURIComponent(character)}` : "";
    fetch(`/api/home-performance${query}`, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => { if (!cancelled && data) setDetail(data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [character]);

  const modes = useMemo(() => {
    const equal = detail?.modes?.equal || { ready: true, stats: initialEqualStats, bets: [] };
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
          const note = data?.rule || mode.note;
          return (
            <section className={styles.slide} key={mode.key} role="tabpanel">
              <div className={styles.modeHeader}>
                <div>
                  <strong>{mode.label}</strong>
                  <span>{note}</span>
                  {mode.key === "odds" && data?.ready && data?.coverageRaceCount < data?.totalRaceCount ? (
                    <span>※保存オッズがある {data.coverageRaceCount}R のみ集計</span>
                  ) : null}
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
                    <p className={styles.noBets}>対象データがありません。</p>
                  )}
                </div>
              ) : (
                <div className={styles.pendingBox}>
                  <strong>{mode.label}は対象データを準備中です</strong>
                  <p>保存済みデータが揃ったレースから自動で集計します。</p>
                </div>
              )}
            </section>
          );
        })}
      </div>

      <div className={styles.dots} aria-hidden="true">
        {MODES.map((mode, index) => <span key={mode.key} className={activeIndex === index ? styles.activeDot : ""} />)}
      </div>
    </div>
  );
}
