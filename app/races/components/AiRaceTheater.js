"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildRaceTheaterModel,
  getBoatColor,
} from "../../lib/raceTheaterEngine";
import styles from "./AiRaceTheater.module.css";

const DURATION_MS = 6800;
const TURN_MARK = Object.freeze({ x: 570, y: 165 });

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function easeInOutSine(value) {
  const t = clamp01(value);
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

function cubicBezierPoint(p0, p1, p2, p3, t) {
  const u = 1 - t;
  const uu = u * u;
  const tt = t * t;

  return {
    x:
      uu * u * p0.x +
      3 * uu * t * p1.x +
      3 * u * tt * p2.x +
      tt * t * p3.x,
    y:
      uu * u * p0.y +
      3 * uu * t * p1.y +
      3 * u * tt * p2.y +
      tt * t * p3.y,
  };
}

function cubicBezierDerivative(p0, p1, p2, p3, t) {
  const u = 1 - t;

  return {
    x:
      3 * u * u * (p1.x - p0.x) +
      6 * u * t * (p2.x - p1.x) +
      3 * t * t * (p3.x - p2.x),
    y:
      3 * u * u * (p1.y - p0.y) +
      6 * u * t * (p2.y - p1.y) +
      3 * t * t * (p3.y - p2.y),
  };
}

function vectorAngle(vector, fallback = 0) {
  const x = Number(vector?.x);
  const y = Number(vector?.y);

  if (!Number.isFinite(x) || !Number.isFinite(y)) return fallback;
  if (Math.abs(x) < 0.0001 && Math.abs(y) < 0.0001) return fallback;

  return (Math.atan2(y, x) * 180) / Math.PI;
}

function getCourseIndex(model, boatNo) {
  const index = Array.isArray(model?.entryOrder)
    ? model.entryOrder.indexOf(boatNo)
    : -1;

  return index >= 0 ? index : Math.max(0, Number(boatNo) - 1);
}

function normalizeScenario(model) {
  return String(model?.scenario || "escape")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function getTurnRadius(model, boatNo) {
  const courseIndex = getCourseIndex(model, boatNo);
  const scenario = normalizeScenario(model);
  const isAttack = Number(boatNo) === Number(model?.attackBoatNo);

  let radius = 62 + courseIndex * 13.5;

  if (scenario !== "escape" && Number(boatNo) === 1) {
    radius += 6;
  }

  if (isAttack) {
    if (
      scenario === "sashi" ||
      scenario === "差し" ||
      (scenario.includes("sashi") && !scenario.includes("makuri"))
    ) {
      radius -= 8;
    } else if (
      scenario.includes("makuri_sashi") ||
      scenario.includes("makurisashi") ||
      scenario.includes("まくり差")
    ) {
      radius -= 4;
    } else if (
      scenario.includes("makuri") ||
      scenario.includes("まくり")
    ) {
      radius += 5;
    }
  }

  return Math.max(52, Math.min(136, radius));
}

function getLeaderBoat(model) {
  return normalizeScenario(model) === "escape"
    ? 1
    : Number(model?.attackBoatNo || 1);
}

function getTurnProgress(model, boatNo, progress) {
  const t = clamp01(progress);
  const leader = getLeaderBoat(model);
  const finishSecond = Number(model?.finishOrder?.[1]);

  let bonus = 0;

  if (Number(boatNo) === leader) {
    bonus = 0.055;
  } else if (Number(boatNo) === finishSecond) {
    bonus = 0.018;
  }

  return clamp01(t + bonus * Math.sin(Math.PI * t));
}

function getPhase(progress) {
  const p = clamp01(progress);

  if (p < 0.18) {
    return {
      key: "slit",
      label: "スリット通過",
      caption: "スタート隊形",
    };
  }

  if (p < 0.52) {
    return {
      key: "approach",
      label: "1マーク進入",
      caption: "1マークへ加速",
    };
  }

  if (p < 0.86) {
    return {
      key: "turn",
      label: "1マーク旋回",
      caption: "AI本命展開",
    };
  }

  return {
    key: "exit",
    label: "旋回後",
    caption: "バックストレッチへ",
  };
}

function getContinuousPosition(model, boat, progress) {
  const p = clamp01(progress);
  const boatNo = Number(boat.boatNo);
  const courseIndex = getCourseIndex(model, boatNo);
  const radius = getTurnRadius(model, boatNo);

  /*
   * スリット位置。
   * 1〜6号艇を詰めすぎず、旋回進入位置へ自然につながる高さに配置。
   */
  const slitY = 205 + courseIndex * 16;
  const slitStart = { x: 72, y: slitY };
  const slitEnd = {
    x: 192 + Math.max(-5, Math.min(14, Number(boat.startPower || 0) * 0.12)),
    y: slitY,
  };

  const turnEntry = {
    x: TURN_MARK.x,
    y: TURN_MARK.y + radius,
  };

  const turnExit = {
    x: TURN_MARK.x,
    y: TURN_MARK.y - radius,
  };

  /*
   * 0.00〜0.18 : スリット通過
   */
  if (p <= 0.18) {
    const t = easeInOutSine(p / 0.18);

    return {
      x: lerp(slitStart.x, slitEnd.x, t),
      y: slitY,
      angle: 0,
    };
  }

  /*
   * 0.18〜0.52 : 1マークへ進入
   *
   * 最後の制御点をturnEntryと同じYにすることで、
   * ターン開始時の艇首が右向きになり、
   * 円弧への接続が滑らかになります。
   */
  if (p <= 0.52) {
    const t = easeInOutSine((p - 0.18) / 0.34);

    const p0 = slitEnd;
    const p1 = {
      x: 320,
      y: slitY + (turnEntry.y - slitY) * 0.18,
    };
    const p2 = {
      x: TURN_MARK.x - 112,
      y: turnEntry.y,
    };
    const p3 = turnEntry;

    const point = cubicBezierPoint(p0, p1, p2, p3, t);
    const derivative = cubicBezierDerivative(p0, p1, p2, p3, t);

    return {
      ...point,
      angle: vectorAngle(derivative, 0),
    };
  }

  /*
   * 0.52〜0.86 : 1マーク旋回
   *
   * SVGのY軸は下向きなので、
   * θ=90° → -90° と減少させると
   *
   *   マーク下 → マーク右 → マーク上
   *
   * の反時計回り左旋回になります。
   * 艇首は円弧の接線方向から毎フレーム計算。
   */
  if (p <= 0.86) {
    const rawTurn = (p - 0.52) / 0.34;
    const t = easeInOutSine(
      getTurnProgress(model, boatNo, rawTurn)
    );

    const theta = lerp(90, -90, t);
    const radians = (theta * Math.PI) / 180;

    const point = {
      x: TURN_MARK.x + radius * Math.cos(radians),
      y: TURN_MARK.y + radius * Math.sin(radians),
    };

    const tangent = {
      x: Math.sin(radians),
      y: -Math.cos(radians),
    };

    return {
      ...point,
      angle: vectorAngle(tangent, 0),
    };
  }

  /*
   * 0.86〜1.00 : 旋回後
   *
   * 円弧の終点から左方向へそのまま抜けます。
   * 旋回終了時の接線方向（左）とBezierの開始方向を一致。
   */
  const t = easeInOutSine((p - 0.86) / 0.14);
  const finishIndex = Math.max(
    0,
    Array.isArray(model?.finishOrder)
      ? model.finishOrder.indexOf(boatNo)
      : courseIndex
  );

  const target = {
    x: 285 - Math.max(0, 5 - finishIndex) * 4,
    y: 72 + finishIndex * 43,
  };

  const p0 = turnExit;
  const p1 = {
    x: turnExit.x - 100,
    y: turnExit.y,
  };
  const p2 = {
    x: target.x + 105,
    y: target.y,
  };
  const p3 = target;

  const point = cubicBezierPoint(p0, p1, p2, p3, t);
  const derivative = cubicBezierDerivative(p0, p1, p2, p3, t);

  return {
    ...point,
    angle: vectorAngle(derivative, 180),
  };
}

function BoatMarker({ boat, position, active = false }) {
  const color = getBoatColor(boat.boatNo);

  return (
    <g
      className={`${styles.boatGroup} ${
        active ? styles.boatActive : ""
      }`}
      transform={`translate(${position.x} ${position.y}) rotate(${position.angle})`}
    >
      <ellipse
        cx="0"
        cy="8"
        rx="19"
        ry="7"
        fill="rgba(0,0,0,.25)"
      />

      <path
        d="M -20 -7 L 16 -7 L 25 0 L 16 7 L -20 7 L -12 0 Z"
        fill={color.main}
        stroke={color.edge}
        strokeWidth="2"
      />

      <circle
        cx="-2"
        cy="0"
        r="10"
        fill={color.main}
        stroke={color.edge}
        strokeWidth="2"
      />

      <text
        x="-2"
        y="4"
        textAnchor="middle"
        fill={color.text}
        fontSize="12"
        fontWeight="900"
      >
        {boat.boatNo}
      </text>

      <path
        d="M -23 0 C -35 0 -42 -3 -50 -7"
        fill="none"
        stroke="rgba(190,235,255,.72)"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </g>
  );
}

function ProbabilityBar({ label, value, type }) {
  return (
    <div className={styles.probabilityRow}>
      <div>
        <span>{label}</span>
        <strong>{value}%</strong>
      </div>
      <div className={styles.probabilityTrack}>
        <i
          className={styles[type]}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

export default function AiRaceTheater({
  event,
  entries = [],
  previousPrediction,
  livePrediction,
  result,
}) {
  const model = useMemo(
    () =>
      buildRaceTheaterModel({
        entries,
        event,
        previousPrediction,
        livePrediction,
      }),
    [entries, event, previousPrediction, livePrediction]
  );

  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  const animationRef = useRef(null);
  const startedAtRef = useRef(null);

  const phase = getPhase(progress);
  const leaderBoat = getLeaderBoat(model);

  const positions = useMemo(() => {
    const next = {};

    for (const boat of model.boats) {
      next[boat.boatNo] = getContinuousPosition(
        model,
        boat,
        progress
      );
    }

    return next;
  }, [model, progress]);

  useEffect(() => {
    if (!playing) return undefined;

    const duration = DURATION_MS / speed;

    const animate = (timestamp) => {
      if (!startedAtRef.current) {
        startedAtRef.current =
          timestamp - progress * duration;
      }

      const nextProgress = Math.min(
        1,
        (timestamp - startedAtRef.current) / duration
      );

      setProgress(nextProgress);

      if (nextProgress >= 1) {
        setPlaying(false);
        startedAtRef.current = null;
        return;
      }

      animationRef.current =
        requestAnimationFrame(animate);
    };

    animationRef.current =
      requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [playing, speed, progress]);

  const play = () => {
    if (progress >= 1) {
      setProgress(0);
    }

    startedAtRef.current = null;
    setPlaying(true);
  };

  const pause = () => {
    setPlaying(false);
    startedAtRef.current = null;
  };

  const replay = () => {
    setPlaying(false);
    setProgress(0);
    startedAtRef.current = null;

    window.setTimeout(() => {
      setPlaying(true);
    }, 80);
  };

  const changeSpeed = (value) => {
    setSpeed(value);
    startedAtRef.current = null;
  };

  if (!entries || entries.length === 0) {
    return (
      <section className={styles.empty}>
        <strong>AI Race Theaterを準備できません</strong>
        <p>出走表データの同期後に表示されます。</p>
      </section>
    );
  }

  return (
    <section className={styles.theater}>
      <header className={styles.hero}>
        <div>
          <span>BOATSTRIKERS 1 MARK SIMULATION</span>
          <h2>AI 1マーク展開予想</h2>
          <p>
            スリット通過から1マーク旋回後までを
            1本の連続軌道で再生
          </p>
        </div>

        <div className={styles.heroStatus}>
          <i />
          {livePrediction
            ? "展示後AI反映"
            : "前日データ版"}
        </div>
      </header>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 8,
          margin: "12px 0",
        }}
      >
        {[
          ["スリット", 0.09],
          ["1M進入", 0.35],
          ["旋回", 0.69],
          ["旋回後", 0.93],
        ].map(([label, point]) => {
          const active =
            Math.abs(progress - point) < 0.18 ||
            (label === "旋回後" && progress >= 0.86);

          return (
            <div
              key={label}
              style={{
                padding: "9px 6px",
                borderRadius: 12,
                textAlign: "center",
                fontSize: 11,
                fontWeight: 900,
                color: active ? "#fff" : "#597089",
                background: active
                  ? "#168dcc"
                  : "#f4f8fb",
                border: "1px solid #d8e6ef",
              }}
            >
              {label}
            </div>
          );
        })}
      </div>

      <div className={styles.mainGrid}>
        <div className={styles.raceScreen}>
          <div className={styles.screenHeader}>
            <div>
              <small>CURRENT</small>
              <strong>{phase.label}</strong>
            </div>

            <div className={styles.environment}>
              <span>
                風 {model.environment.windSpeed}m
              </span>
              <span>
                波 {model.environment.waveHeight}cm
              </span>
              <span>
                進入 {model.entryOrder.join("")}
              </span>
            </div>
          </div>

          <div className={styles.svgWrap}>
            <svg
              viewBox="0 0 700 380"
              role="img"
              aria-label="AI 1マーク連続シミュレーション"
            >
              <defs>
                <linearGradient
                  id="waterGradientContinuous"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="0%"
                    stopColor="#075987"
                  />
                  <stop
                    offset="58%"
                    stopColor="#064369"
                  />
                  <stop
                    offset="100%"
                    stopColor="#042943"
                  />
                </linearGradient>

                <pattern
                  id="waterPatternContinuous"
                  width="42"
                  height="15"
                  patternUnits="userSpaceOnUse"
                >
                  <path
                    d="M0 8 Q10 3 21 8 T42 8"
                    fill="none"
                    stroke="rgba(130,220,255,.12)"
                    strokeWidth="2"
                  />
                </pattern>

                <filter id="turnGlowContinuous">
                  <feGaussianBlur
                    stdDeviation="4"
                    result="blur"
                  />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              <rect
                width="700"
                height="380"
                rx="22"
                fill="url(#waterGradientContinuous)"
              />
              <rect
                width="700"
                height="380"
                rx="22"
                fill="url(#waterPatternContinuous)"
              />

              <path
                d="M 45 72 L 45 330"
                stroke="#ff6b72"
                strokeWidth="3"
                strokeDasharray="10 9"
                opacity=".8"
              />

              <text
                x="25"
                y="55"
                fill="#ffc1c4"
                fontSize="12"
                fontWeight="900"
              >
                SLIT
              </text>

              <circle
                cx={TURN_MARK.x}
                cy={TURN_MARK.y}
                r="18"
                fill="#f5f5f5"
                stroke="#e53935"
                strokeWidth="7"
                filter="url(#turnGlowContinuous)"
              />

              <path
                d={`M ${TURN_MARK.x} ${
                  TURN_MARK.y - 29
                } L ${TURN_MARK.x} ${
                  TURN_MARK.y - 61
                }`}
                stroke="#ffb14b"
                strokeWidth="5"
              />

              <path
                d={`M ${TURN_MARK.x - 10} ${
                  TURN_MARK.y - 61
                } L ${TURN_MARK.x + 10} ${
                  TURN_MARK.y - 61
                } L ${TURN_MARK.x} ${
                  TURN_MARK.y - 80
                } Z`}
                fill="#ff7043"
              />

              {model.boats.map((boat) => {
                const position =
                  positions[boat.boatNo] || {
                    x: 72,
                    y: 220,
                    angle: 0,
                  };

                return (
                  <BoatMarker
                    key={boat.boatNo}
                    boat={boat}
                    position={position}
                    active={
                      Number(boat.boatNo) ===
                      Number(leaderBoat)
                    }
                  />
                );
              })}
            </svg>

            <div className={styles.stageCaption}>
              <span>{phase.caption}</span>
              <strong>
                {phase.key === "slit"
                  ? "スリット通過から展開予想を開始"
                  : phase.key === "approach"
                  ? `注目艇 ${model.attackBoatNo}号艇の攻めを解析`
                  : phase.key === "turn"
                  ? model.mainComment
                  : `予想着順 ${model.finishOrder
                      .slice(0, 3)
                      .join("-")}`}
              </strong>
            </div>
          </div>

          <div className={styles.controls}>
            <button
              type="button"
              className={styles.playButton}
              onClick={playing ? pause : play}
            >
              {playing ? "Ⅱ 一時停止" : "▶ 展開を見る"}
            </button>

            <button
              type="button"
              className={styles.replayButton}
              onClick={replay}
            >
              ↻ リプレイ
            </button>

            <div className={styles.progressTrack}>
              <i
                style={{
                  width: `${progress * 100}%`,
                }}
              />
            </div>

            <div className={styles.speedButtons}>
              {[0.5, 1, 2].map((value) => (
                <button
                  key={value}
                  type="button"
                  className={
                    speed === value
                      ? styles.speedActive
                      : ""
                  }
                  onClick={() => changeSpeed(value)}
                >
                  ×{value}
                </button>
              ))}
            </div>
          </div>
        </div>

        <aside className={styles.sidePanel}>
          <div className={styles.sideHeading}>
            <small>1 MARK PROBABILITY</small>
            <h3>1マーク予測</h3>
          </div>

          <ProbabilityBar
            label="逃げ"
            value={model.probabilities.escape}
            type="escapeBar"
          />
          <ProbabilityBar
            label="差し"
            value={model.probabilities.sashi}
            type="sashiBar"
          />
          <ProbabilityBar
            label="まくり"
            value={model.probabilities.makuri}
            type="makuriBar"
          />
          <ProbabilityBar
            label="まくり差し"
            value={model.probabilities.makuriSashi}
            type="makuriSashiBar"
          />

          <div className={styles.aiComment}>
            <span>AI本命展開</span>
            <strong>{model.mainComment}</strong>
            <p>
              展示タイム・展示ST・モーター・全国勝率・
              当地勝率・AIイン逃げ期待度を反映。
            </p>
          </div>

          <div className={styles.finishPrediction}>
            <small>予想着順</small>
            <strong>
              {model.finishOrder
                .slice(0, 3)
                .join(" - ")}
            </strong>
            <span>
              注目艇 {model.attackBoatNo}号艇
            </span>
          </div>
        </aside>
      </div>

      <div className={styles.boatData}>
        {model.boats.map((boat) => {
          const color = getBoatColor(boat.boatNo);

          return (
            <article key={boat.boatNo}>
              <b
                style={{
                  background: color.main,
                  color: color.text,
                  borderColor: color.edge,
                }}
              >
                {boat.boatNo}
              </b>

              <div>
                <strong>{boat.racerName}</strong>
                <span>{boat.racerClass}</span>
              </div>

              <dl>
                <div>
                  <dt>AI指数</dt>
                  <dd>{boat.ability}</dd>
                </div>
                <div>
                  <dt>ST力</dt>
                  <dd>{boat.startPower}</dd>
                </div>
                <div>
                  <dt>展示ST</dt>
                  <dd>
                    {boat.exhibitionSt === null
                      ? "-"
                      : boat.exhibitionSt.toFixed(2)}
                  </dd>
                </div>
              </dl>
            </article>
          );
        })}
      </div>

      {result && (
        <div className={styles.resultCompare}>
          <div>
            <small>AI予想</small>
            <strong>
              {model.finishOrder
                .slice(0, 3)
                .join("-")}
            </strong>
          </div>

          <span>VS</span>

          <div>
            <small>実際の結果</small>
            <strong>
              {result.trifecta_result || "-"}
            </strong>
          </div>
        </div>
      )}

      <p className={styles.note}>
        ※ このシミュレーションは過去データと
        当日の取得情報をもとにした研究用予測です。
        実際の進入・展開・着順を保証するものではありません。
      </p>
    </section>
  );
}
