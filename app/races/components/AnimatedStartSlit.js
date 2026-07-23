"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./AnimatedStartSlit.module.css";

const BOAT_COLORS = {
  1: { bg: "#ffffff", fg: "#111827", border: "#cbd5e1" },
  2: { bg: "#111827", fg: "#ffffff", border: "#111827" },
  3: { bg: "#ef4444", fg: "#ffffff", border: "#ef4444" },
  4: { bg: "#3b82f6", fg: "#ffffff", border: "#3b82f6" },
  5: { bg: "#facc15", fg: "#111827", border: "#eab308" },
  6: { bg: "#22c55e", fg: "#ffffff", border: "#16a34a" },
};

const finite = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const normalizeName = (value) =>
  String(value || "選手名未取得")
    .replace(/\u3000/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function formatSt(value) {
  const number = finite(value);
  if (number === null) return "-";
  if (number < 0) return `F${Math.abs(number).toFixed(2)}`;
  return number.toFixed(2);
}

function getEvaluation(st) {
  if (st === null) return { label: "未取得", className: styles.unknown };
  if (st < 0) return { label: "F", className: styles.flying };
  if (st <= 0.06) return { label: "超抜", className: styles.excellent };
  if (st <= 0.10) return { label: "優秀", className: styles.good };
  if (st <= 0.15) return { label: "標準", className: styles.normal };
  return { label: "遅れ", className: styles.slow };
}

export default function AnimatedStartSlit({ entries = [] }) {
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  console.log(
    "AnimatedStartSlit entries:",
    entries.map((entry) => ({
      boat_no: entry.boat_no,
      exhibition_st: entry.exhibition_st,
      exhibition_time: entry.exhibition_time,
    }))
  );
  const frameRef = useRef(null);
  const startTimeRef = useRef(null);

  console.log(
    "AnimatedStartSlit entries:",
    entries.map((entry) => ({
      boat_no: entry.boat_no,
      exhibition_st: entry.exhibition_st,
      exhibition_time: entry.exhibition_time,
    }))
  );

  const rows = useMemo(() => {
    const normalized = (entries || [])
      .map((entry) => ({
        ...entry,
        boatNo: Number(entry.boat_no),
        st: finite(entry.exhibition_st),
      }))
      .filter((entry) => entry.boatNo >= 1 && entry.boatNo <= 6)
      .sort((a, b) => a.boatNo - b.boatNo);

    const valid = normalized.filter((entry) => entry.st !== null);
    const fastest = valid.length ? Math.min(...valid.map((entry) => entry.st)) : null;
    const slowest = valid.length ? Math.max(...valid.map((entry) => entry.st)) : null;

    return normalized.map((entry) => ({
      ...entry,
      isFastest: entry.st !== null && entry.st === fastest,
      isSlowest: entry.st !== null && entry.st === slowest,
    }));
  }, [entries]);

  const hasData = rows.some((row) => row.st !== null);

  useEffect(() => {
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  function animate(timestamp) {
    if (!startTimeRef.current) startTimeRef.current = timestamp;
    const duration = 1800 / speed;
    const elapsed = timestamp - startTimeRef.current;
    const next = Math.min(elapsed / duration, 1);
    setProgress(next);

    if (next < 1) {
      frameRef.current = requestAnimationFrame(animate);
    } else {
      setPlaying(false);
      startTimeRef.current = null;
    }
  }

  function play() {
    if (!hasData) return;
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    setProgress(0);
    setPlaying(true);
    startTimeRef.current = null;
    frameRef.current = requestAnimationFrame(animate);
  }

  function stop() {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    startTimeRef.current = null;
    setPlaying(false);
  }

  function reset() {
    stop();
    setProgress(0);
  }

  return (
    <section className={styles.wrapper}>
      <div className={styles.header}>
        <div>
          <small>START EXHIBITION SLIT</small>
          <h3>スタート展示スリット</h3>
          <p>展示STをもとに各艇の踏み込みを再現します。</p>
        </div>

        <div className={styles.controls}>
          <button type="button" onClick={playing ? stop : play} disabled={!hasData}>
            {playing ? "停止" : progress > 0 ? "もう一度" : "再生"}
          </button>
          <button type="button" onClick={reset}>リセット</button>
          <select value={speed} onChange={(event) => setSpeed(Number(event.target.value))}>
            <option value={0.75}>0.75倍</option>
            <option value={1}>1倍</option>
            <option value={1.5}>1.5倍</option>
            <option value={2}>2倍</option>
          </select>
        </div>
      </div>

      {!hasData ? (
        <div className={styles.empty}>展示ST取得後に表示します。</div>
      ) : (
        <>
          <div className={styles.slitArea}>
            <div className={styles.startLabel}>START</div>
            <div className={styles.slitLine} />
            <div className={styles.slitLabel}>スリット</div>

            {rows.map((row) => {
              const color = BOAT_COLORS[row.boatNo];
              const evaluation = getEvaluation(row.st);
              const target = row.st === null
                ? 18
                : row.st < 0
                ? 84 + Math.min(Math.abs(row.st) * 120, 8)
                : 84 - Math.min(row.st * 180, 34);
              const animatedPosition = 10 + (target - 10) * progress;

              return (
                <div className={styles.lane} key={row.boatNo}>
                  <div className={styles.boatNumber} style={{ background: color.bg, color: color.fg, borderColor: color.border }}>
                    {row.boatNo}
                  </div>

                  <div className={styles.track}>
                    <div
                      className={`${styles.boatMarker} ${row.isFastest ? styles.fastestMarker : ""} ${row.isSlowest ? styles.slowestMarker : ""}`}
                      style={{ left: `${animatedPosition}%`, background: color.bg, color: color.fg, borderColor: color.border }}
                    >
                      {row.boatNo}
                    </div>
                  </div>

                  <div className={styles.info}>
                    <strong>{formatSt(row.st)}</strong>
                    <span className={evaluation.className}>{evaluation.label}</span>
                  </div>

                  <div className={styles.name}>{normalizeName(row.racer_name)}</div>
                </div>
              );
            })}
          </div>

          <p className={styles.note}>
            ※ 展示STの相対差を見やすく表現したアニメーションです。実際の映像や距離ではありません。
          </p>
        </>
      )}
    </section>
  );
}
