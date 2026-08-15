"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildRaceTheaterModel,
  getBoatColor,
} from "../../lib/raceTheaterEngine";
import styles from "./AiRaceTheater.module.css";

/*
 * BoatStrikers 1マーク予想
 * Drop-in版:
 *   app/races/components/AiRaceTheater.js
 *
 * 設計方針
 * - 既存 raceTheaterEngine.js をそのまま使用
 * - CSSも既存 AiRaceTheater.module.css をそのまま使用
 * - 7ステージ方式をやめ、スリット→1M→旋回後を1本で再生
 * - 6艇は1マーク周辺で絶対に同じ軌道へ収束させない
 * - 1〜6コースを大きく離した専用半径に固定
 * - 攻め艇は「速度差」で表現し、他艇のレーンを横切らせない
 */

const DURATION_MS = 6200;
const TURN_MARK = Object.freeze({ x: 548, y: 116 });

const COURSE_RADIUS = Object.freeze({
  1: 54,
  2: 80,
  3: 106,
  4: 132,
  5: 158,
  6: 184,
});

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function clamp01(value) {
  return clamp(value, 0, 1);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function easeInOutSine(value) {
  const t = clamp01(value);
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

function easeOutCubic(value) {
  const t = clamp01(value);
  return 1 - Math.pow(1 - t, 3);
}

function cubicBezierPoint(p0, p1, p2, p3, t) {
  const u = 1 - t;
  const tt = t * t;
  const uu = u * u;

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

function angleOf(vector, fallback = 0) {
  const x = Number(vector?.x);
  const y = Number(vector?.y);

  if (!Number.isFinite(x) || !Number.isFinite(y)) return fallback;
  if (Math.abs(x) < 0.0001 && Math.abs(y) < 0.0001) return fallback;

  return (Math.atan2(y, x) * 180) / Math.PI;
}

function getCourseIndex(model, boatNo) {
  const order = Array.isArray(model?.entryOrder)
    ? model.entryOrder.map(Number)
    : [1, 2, 3, 4, 5, 6];

  const index = order.indexOf(Number(boatNo));
  return index >= 0 ? index : Math.max(0, Number(boatNo) - 1);
}

function getFinishIndex(model, boatNo) {
  const order = Array.isArray(model?.finishOrder)
    ? model.finishOrder.map(Number)
    : [1, 2, 3, 4, 5, 6];

  const index = order.indexOf(Number(boatNo));
  return index >= 0 ? index : getCourseIndex(model, boatNo);
}

function normalizeScenario(model) {
  return String(model?.scenario || "escape")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function getLeaderBoat(model) {
  return normalizeScenario(model) === "escape"
    ? 1
    : Number(model?.attackBoatNo || 1);
}

/*
 * 攻め艇は隣のレーンへワープさせない。
 * 位置の進捗だけ少し先行させることで
 * 「差し・まくり・まくり差し」の攻め感を作る。
 */
function getBoatTimelineProgress(model, boatNo, progress) {
  const p = clamp01(progress);
  const scenario = normalizeScenario(model);
  const leaderBoat = getLeaderBoat(model);
  const finishSecond = Number(model?.finishOrder?.[1]);

  let bonus = 0;

  if (Number(boatNo) === leaderBoat) {
    bonus = scenario === "escape" ? 0.055 : 0.075;
  } else if (Number(boatNo) === finishSecond) {
    bonus = 0.018;
  }

  // 0と1では補正を0へ戻すので、開始/終了で位置が飛ばない
  return clamp01(p + bonus * Math.sin(Math.PI * p));
}

function getPhase(progress) {
  const p = clamp01(progress);

  if (p < 0.18) {
    return {
      label: "スリット",
      eyebrow: "START FORMATION",
      caption: "スタート隊形から1マークへ",
    };
  }

  if (p < 0.48) {
    return {
      label: "1マーク進入",
      eyebrow: "APPROACH",
      caption: "各艇が自分のレーンを保って進入",
    };
  }

  if (p < 0.82) {
    return {
      label: "1マーク旋回",
      eyebrow: "1 MARK BATTLE",
      caption: "1マークの攻防",
    };
  }

  return {
    label: "旋回後",
    eyebrow: "TURN EXIT",
    caption: "バックストレッチを直進",
  };
}

/*
 * 1マーク進入位置
 *
 * 全艇がマーク直前で一点へ集まらないよう、
 * 1〜6コースで明確に半径を分離。
 */
function getTurnEntry(model, boatNo) {
  const courseIndex = getCourseIndex(model, boatNo);
  const course = courseIndex + 1;
  const radius = COURSE_RADIUS[course] || COURSE_RADIUS[6];

  return {
    radius,
    point: {
      x: TURN_MARK.x,
      y: TURN_MARK.y + radius,
    },
  };
}

/*
 * 旋回終了位置
 *
 * 下 → 右 → 上 とマークを反時計回りに回り、
 * 終点では艇首が左向きになる。
 */
function getTurnExit(model, boatNo) {
  const { radius } = getTurnEntry(model, boatNo);

  return {
    radius,
    point: {
      x: TURN_MARK.x,
      y: TURN_MARK.y - radius,
    },
  };
}

function getBoatPosition(model, boat, rawProgress) {
  const boatNo = Number(boat.boatNo);
  const courseIndex = getCourseIndex(model, boatNo);
  const finishIndex = getFinishIndex(model, boatNo);
  const progress = getBoatTimelineProgress(
    model,
    boatNo,
    rawProgress
  );

  const { radius, point: turnEntry } = getTurnEntry(
    model,
    boatNo
  );
  const { point: turnExit } = getTurnExit(model, boatNo);

  /*
   * スリット側。
   * 6艇の縦間隔を十分に取る。
   */
  const startY = 168 + courseIndex * 28;
  const startBoost = clamp(
    Number(boat.startPower || 0) * 0.12,
    -5,
    14
  );

  const slitStart = {
    x: 72,
    y: startY,
  };

  const slitEnd = {
    x: 180 + startBoost,
    y: startY,
  };

  /*
   * 0.00〜0.18 : スリット
   */
  if (progress <= 0.18) {
    const t = easeOutCubic(progress / 0.18);

    return {
      x: lerp(slitStart.x, slitEnd.x, t),
      y: startY,
      angle: 0,
    };
  }

  /*
   * 0.18〜0.48 : 1M進入
   *
   * 外艇ほど下側の専用進入レーンを通る。
   * 終点は各艇固有のturnEntryなので重ならない。
   */
  if (progress <= 0.48) {
    const t = easeInOutSine(
      (progress - 0.18) / 0.30
    );

    const p0 = slitEnd;
    const p1 = {
      x: 290,
      y: startY,
    };
    const p2 = {
      x: TURN_MARK.x - 118 - courseIndex * 5,
      y: turnEntry.y,
    };
    const p3 = turnEntry;

    const point = cubicBezierPoint(p0, p1, p2, p3, t);
    const tangent = cubicBezierDerivative(
      p0,
      p1,
      p2,
      p3,
      t
    );

    return {
      ...point,
      angle: angleOf(tangent, 0),
    };
  }

  /*
   * 0.48〜0.82 : 1マーク旋回
   *
   * 1号艇 54px
   * 2号艇 80px
   * ...
   * 6号艇 184px
   *
   * 半径差26pxを確保するので、
   * 1マーク周辺で縦積みになりにくい。
   *
   * SVGはY軸が下向き。
   * θ=90 → -90 と進めると
   *   下 → 右 → 上
   * と左旋回する。
   */
  if (progress <= 0.82) {
    const t = easeInOutSine(
      (progress - 0.48) / 0.34
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
      angle: angleOf(tangent, 0),
    };
  }

  /*
   * 0.82〜1.00 : バックストレッチ
   *
   * 旋回を抜けたら、艇首を左向きに揃えて
   * それぞれのレーンを「まっすぐ」走らせる。
   *
   * ここではBezierで着順位置へ吸い寄せず、
   * 旋回出口のY座標を基本的に維持することで
   * ボートレースらしい直線のバックストレッチにする。
   */
  const t = easeOutCubic(
    (progress - 0.82) / 0.18
  );

  /*
   * 旋回後の隊形差はX方向（前後差）だけで表現。
   * Y方向はturnExit.yを維持して直進させる。
   */
  const rankAdvance =
    Math.max(0, 5 - finishIndex) * 10;

  const targetX =
    270 - rankAdvance;

  return {
    x: lerp(turnExit.x, targetX, t),
    y: turnExit.y,
    angle: 180,
  };
}

function getTrail(model, boat, progress) {
  const current = clamp01(progress);
  const from = Math.max(0, current - 0.10);
  const points = [];
  const count = 18;

  for (let i = 0; i < count; i += 1) {
    const ratio = i / (count - 1);
    const p = from + (current - from) * ratio;
    points.push(getBoatPosition(model, boat, p));
  }

  return points;
}

function pathFromPoints(points) {
  return points
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"} ${point.x.toFixed(
          1
        )} ${point.y.toFixed(1)}`
    )
    .join(" ");
}

function BoatTrail({ boat, points }) {
  const color = getBoatColor(boat.boatNo);

  if (!points || points.length < 2) return null;

  const d = pathFromPoints(points);

  return (
    <>
      <path
        d={d}
        fill="none"
        stroke="rgba(225,248,255,.48)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d={d}
        fill="none"
        stroke={color.main}
        strokeOpacity=".25"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  );
}

function BoatMarker({ boat, position, active }) {
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
        cy="9"
        rx="19"
        ry="7"
        fill="rgba(0,0,0,.23)"
      />

      <path
        d="M -21 -7 L 16 -7 L 27 0 L 16 7 L -21 7 L -12 0 Z"
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
    [
      entries,
      event,
      previousPrediction,
      livePrediction,
    ]
  );

  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  const animationRef = useRef(null);
  const startedAtRef = useRef(null);

  const phase = getPhase(progress);
  const leaderBoat = getLeaderBoat(model);

  const positions = useMemo(() => {
    const resultMap = {};

    for (const boat of model.boats) {
      resultMap[boat.boatNo] = getBoatPosition(
        model,
        boat,
        progress
      );
    }

    return resultMap;
  }, [model, progress]);

  const trails = useMemo(() => {
    const resultMap = {};

    for (const boat of model.boats) {
      resultMap[boat.boatNo] = getTrail(
        model,
        boat,
        progress
      );
    }

    return resultMap;
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
            シンプルに再生
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
          ["1M進入", 0.33],
          ["旋回", 0.65],
          ["旋回後", 0.91],
        ].map(([label, point]) => {
          const active =
            Math.abs(progress - point) < 0.17 ||
            (label === "旋回後" && progress >= 0.82);

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
              <small>{phase.eyebrow}</small>
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
              aria-label="1マークAIシミュレーション"
            >
              <defs>
                <linearGradient
                  id="waterGradientDropin"
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
                  id="waterPatternDropin"
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

                <filter id="turnGlowDropin">
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
                fill="url(#waterGradientDropin)"
              />
              <rect
                width="700"
                height="380"
                rx="22"
                fill="url(#waterPatternDropin)"
              />

              <path
                d="M 45 88 L 45 330"
                stroke="#ff6b72"
                strokeWidth="3"
                strokeDasharray="10 9"
                opacity=".8"
              />

              <text
                x="24"
                y="70"
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
                filter="url(#turnGlowDropin)"
              />

              <path
                d={`M ${TURN_MARK.x} ${
                  TURN_MARK.y - 28
                } L ${TURN_MARK.x} ${
                  TURN_MARK.y - 59
                }`}
                stroke="#ffb14b"
                strokeWidth="5"
              />

              <path
                d={`M ${TURN_MARK.x - 10} ${
                  TURN_MARK.y - 59
                } L ${TURN_MARK.x + 10} ${
                  TURN_MARK.y - 59
                } L ${TURN_MARK.x} ${
                  TURN_MARK.y - 78
                } Z`}
                fill="#ff7043"
              />

              {model.boats.map((boat) => (
                <BoatTrail
                  key={`trail-${boat.boatNo}`}
                  boat={boat}
                  points={trails[boat.boatNo]}
                />
              ))}

              {model.boats.map((boat) => (
                <BoatMarker
                  key={boat.boatNo}
                  boat={boat}
                  position={positions[boat.boatNo]}
                  active={
                    Number(boat.boatNo) ===
                    Number(leaderBoat)
                  }
                />
              ))}
            </svg>

            <div className={styles.stageCaption}>
              <span>{phase.caption}</span>
              <strong>
                {progress < 0.18
                  ? "スリット通過から展開予想を開始"
                  : progress < 0.48
                  ? `注目艇 ${model.attackBoatNo}号艇の攻めを解析`
                  : progress < 0.82
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
              {playing
                ? "Ⅱ 一時停止"
                : "▶ 展開を見る"}
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
