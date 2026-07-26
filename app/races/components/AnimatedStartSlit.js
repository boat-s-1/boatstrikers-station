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
  if (value === true) return "F";
  if (value === false || value === null || value === undefined) return "";

  const text = String(value)
    .trim()
    .toUpperCase()
    .replace(/Ｆ/g, "F")
    .replace(/Ｌ/g, "L");

  if (!text || text === "0" || text === "-" || text === "NULL") return "";
  if (text.includes("F") || text === "1" || text === "FLYING") return "F";
  if (text.includes("L") || text === "2" || text === "LATE") return "L";
  return text;
}

function resolveStartMark(entry, markKey) {
  const candidates = [
    entry?.[markKey],
    entry?.exhibition_fl,
    entry?.official_exhibition_symbol,
    entry?.show_fl,
    entry?.start_exhibition_fl,
    entry?.exhibition_f_mark,
    entry?.exhibition_mark,
    entry?.start_mark,
    entry?.st_mark,
    entry?.flying_flag,
    entry?.is_flying,
    entry?.fl,
    entry?.mark,
    entry?.note,
  ];

  for (const candidate of candidates) {
    const mark = normalizeMark(candidate);
    if (mark === "F" || mark === "L") return mark;
  }

  return "";
}

const START_LINE_POSITION = 84;

function getTargetPosition(signedSt, allowLineOverrun = true) {
  if (signedSt === null) return 18;

  if (signedSt < 0 && allowLineOverrun) {
    // F.01は少し、F.10以上は大きくスタートラインを越える。
    // 表示領域の右端を超えないよう最大98%に制限する。
    const overrun = Math.max(2.5, Math.min(Math.abs(signedSt) * 140, 14));
    return Math.min(98, START_LINE_POSITION + overrun);
  }

  // 正常STは値が小さいほどスタートラインに近い位置で停止する。
  const beforeLine = Math.max(2.5, Math.min(signedSt * 180, 34));
  return START_LINE_POSITION - beforeLine;
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
  note = "※ F艇はF値に応じてスタートラインを越えて進みます。実際の映像や距離ではありません。",
  showStartMarks = true,
  allowLineOverrun = true,
  clampMin = null,
  clampMax = null,
}) {
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const frameRef = useRef(null);
  const startTimeRef = useRef(null);

  const rows = useMemo(() => {
    const normalized = (entries || [])
      .map((entry) => {
        const sourceSt = finite(entry?.[valueKey]);
        const mark = showStartMarks ? resolveStartMark(entry, markKey) : "";

        let rawSt = sourceSt;
        if (rawSt !== null && clampMin !== null) {
          rawSt = Math.max(Number(clampMin), Math.abs(rawSt));
        }
        if (rawSt !== null && clampMax !== null) {
          rawSt = Math.min(Number(clampMax), Math.abs(rawSt));
        }

        const signedSt = rawSt === null
          ? null
          : showStartMarks && mark === "F"
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
  }, [entries, valueKey, markKey, showStartMarks, clampMin, clampMax]);

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
              const target = getTargetPosition(row.signedSt, allowLineOverrun);
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
                      aria-label={row.mark === "F" ? `${row.boatNo}号艇 フライング ${formatSt(row.rawSt, row.mark)}` : `${row.boatNo}号艇 ${formatSt(row.rawSt, row.mark)}`}
                      className={`${styles.boatMarker} ${row.isFastest ? styles.fastestMarker : ""} ${row.isSlowest ? styles.slowestMarker : ""} ${row.mark === "F" ? styles.flyingMarker : ""}`}
                      style={{
                        left: `${animatedPosition}%`,
                        background: color.bg,
                        color: color.fg,
                        borderColor: color.border,
                      }}
                    >
                      {row.boatNo}
                      {row.mark === "F" && <span className={styles.fBadge}>F</span>}
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
