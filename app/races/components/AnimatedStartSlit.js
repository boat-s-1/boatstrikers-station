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

function finite(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeMark(value) {
  const text = String(value ?? "").trim().toUpperCase();
  if (!text || text === "0" || text === "-" || text === "NULL") return "";
  if (text.includes("F") || text === "1") return "F";
  if (text.includes("L") || text === "2") return "L";
  return text;
}

function normalizeName(value) {
  return String(value || "選手名未取得")
    .replace(/\u3000/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatSt(value, mark) {
  const number = finite(value);
  if (number === null) return "-";
  const absText = Math.abs(number).toFixed(2).replace(/^0/, "");
  if (mark === "F" || number < 0) return `F${absText}`;
  if (mark === "L") return `L${absText}`;
  return number.toFixed(2).replace(/^0/, "");
}

function getEvaluation(signedSt, mark) {
  if (signedSt === null) return { label: "未取得", className: styles.unknown };
  if (mark === "F" || signedSt < 0) return { label: "F", className: styles.flying };
  if (mark === "L") return { label: "L", className: styles.late };
  if (signedSt <= 0.06) return { label: "超抜", className: styles.excellent };
  if (signedSt <= 0.10) return { label: "優秀", className: styles.good };
  if (signedSt <= 0.15) return { label: "標準", className: styles.normal };
  return { label: "遅れ", className: styles.slow };
}

export default function AnimatedStartSlit({
  entries = [],
  valueKey = "exhibition_st",
  markKey = "exhibition_fl",
  title = "公式スタート展示アニメーション",
  eyebrow = "OFFICIAL START EXHIBITION",
  description = "展示STをもとに各艇の踏み込みを再現します。",
  note = "※ 展示STの相対差を見やすく表現したアニメーションです。実際の映像や距離ではありません。",
}) {
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const frameRef = useRef(null);
  const startTimeRef = useRef(null);

  const rows = useMemo(() => {
    const normalized = (entries || [])
      .map((entry) => {
        const rawSt = finite(entry?.[valueKey]);
        const mark = normalizeMark(entry?.[markKey]);
        const signedSt = rawSt === null
          ? null
          : mark === "F"
            ? -Math.abs(rawSt)
            : Math.abs(rawSt);

        return {
          ...entry,
          boatNo: Number(entry.boat_no),
          rawSt,
          signedSt,
          mark,
        };
      })
      .filter((entry) => entry.boatNo >= 1 && entry.boatNo <= 6)
      .sort((a, b) => {
        const courseA = finite(a.exhibition_course) ?? a.boatNo;
        const courseB = finite(b.exhibition_course) ?? b.boatNo;
        return courseA - courseB;
      });

    const valid = normalized.filter((entry) => entry.signedSt !== null);
    const fastest = valid.length
      ? Math.min(...valid.map((entry) => entry.signedSt))
      : null;
    const slowest = valid.length
      ? Math.max(...valid.map((entry) => entry.signedSt))
      : null;

    return normalized.map((entry) => ({
      ...entry,
      isFastest: entry.signedSt !== null && entry.signedSt === fastest,
      isSlowest: entry.signedSt !== null && entry.signedSt === slowest,
    }));
  }, [entries, valueKey, markKey]);

  const hasData = rows.some((row) => row.signedSt !== null);

  useEffect(() => () => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
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
          <small>{eyebrow}</small>
          <h3>{title}</h3>
          <p>{description}</p>
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
              const evaluation = getEvaluation(row.signedSt, row.mark);
              const target = row.signedSt === null
                ? 18
                : row.signedSt < 0
                  ? 84 + Math.min(Math.abs(row.signedSt) * 180, 10)
                  : 84 - Math.min(row.signedSt * 180, 34);
              const animatedPosition = 10 + (target - 10) * progress;

              return (
                <div className={styles.lane} key={row.boatNo}>
                  <div
                    className={styles.boatNumber}
                    style={{ background: color.bg, color: color.fg, borderColor: color.border }}
                  >
                    {row.boatNo}
                  </div>

                  <div className={styles.track}>
                    <div
                      className={`${styles.boatMarker} ${row.isFastest ? styles.fastestMarker : ""} ${row.isSlowest ? styles.slowestMarker : ""} ${row.mark === "F" ? styles.flyingMarker : ""}`}
                      style={{
                        left: `${animatedPosition}%`,
                        background: color.bg,
                        color: color.fg,
                        borderColor: color.border,
                      }}
                    >
                      {row.boatNo}
                    </div>
                  </div>

                  <div className={styles.info}>
                    <strong className={row.mark === "F" ? styles.flyingText : ""}>
                      {formatSt(row.rawSt, row.mark)}
                    </strong>
                    <span className={evaluation.className}>{evaluation.label}</span>
                  </div>

                  <div className={styles.name}>{normalizeName(row.racer_name)}</div>
                </div>
              );
            })}
          </div>

          <p className={styles.note}>{note}</p>
        </>
      )}
    </section>
  );
}
