"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildRaceTheaterModel,
  getBoatColor,
} from "../../lib/raceTheaterEngine";
import styles from "./AiRaceTheater.module.css";

const DURATION_MS = 6800;
const HISTORY_POINTS = 26;

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
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

function easeInOutSine(value) {
  const t = clamp01(value);
  return -(Math.cos(Math.PI * t) - 1) / 2;
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

function getCourseIndex(model, boatNo) {
  const index = Array.isArray(model?.entryOrder)
    ? model.entryOrder.indexOf(Number(boatNo))
    : -1;

  return index >= 0 ? index : Math.max(0, Number(boatNo) - 1);
}

function getFinishIndex(model, boatNo) {
  const index = Array.isArray(model?.finishOrder)
    ? model.finishOrder.indexOf(Number(boatNo))
    : -1;

  return index >= 0 ? index : getCourseIndex(model, boatNo);
}

function getTrajectoryType(model, boatNo) {
  const scenario = normalizeScenario(model);
  const leader = getLeaderBoat(model);
  const attack = Number(model?.attackBoatNo || 1);
  const course = getCourseIndex(model, boatNo);

  if (scenario === "escape") {
    if (Number(boatNo) === 1) return "innerLead";
    if (course === 1) return "insideChase";
    if (course === 2) return "outsideHold";
    return "outerFollow";
  }

  if (
    scenario === "sashi" ||
    scenario === "差し" ||
    (scenario.includes("sashi") && !scenario.includes("makuri"))
  ) {
    if (Number(boatNo) === attack) return "sharpSashi";
    if (Number(boatNo) === 1) return "innerResist";
    return course <= 2 ? "outsideHold" : "outerFollow";
  }

  if (
    scenario.includes("makuri_sashi") ||
    scenario.includes("makurisashi") ||
    scenario.includes("まくり差")
  ) {
    if (Number(boatNo) === attack) return "makuriSashi";
    if (Number(boatNo) === 1) return "innerResist";
    return course <= 2 ? "outsideHold" : "outerFollow";
  }

  if (
    scenario.includes("makuri") ||
    scenario.includes("まくり")
  ) {
    if (Number(boatNo) === attack) return "outerAttack";
    if (Number(boatNo) === 1) return "innerResist";
    return course <= 2 ? "outsideHold" : "outerFollow";
  }

  if (Number(boatNo) === leader) return "innerLead";
  return course <= 2 ? "outsideHold" : "outerFollow";
}

function buildLanePath(model, boat) {
  const boatNo = Number(boat.boatNo);
  const courseIndex = getCourseIndex(model, boatNo);
  const finishIndex = getFinishIndex(model, boatNo);
  const laneType = getTrajectoryType(model, boatNo);

  const slitY = 194 + courseIndex * 17;
  const finishY = 76 + finishIndex * 41;

  const startPower = Math.max(
    -8,
    Math.min(16, Number(boat.startPower || 0) * 0.14)
  );

  const start = { x: 76, y: slitY };
  const slitEnd = { x: 205 + startPower, y: slitY };

  const presets = {
    innerLead: [
      start,
      slitEnd,
      { x: 330, y: slitY - 1 },
      { x: 470, y: 252 },
      { x: 542, y: 224 },
      { x: 590, y: 162 },
      { x: 524, y: 106 },
      { x: 405, y: finishY + 14 },
      { x: 288, y: finishY },
    ],
    innerResist: [
      start,
      slitEnd,
      { x: 330, y: slitY + 3 },
      { x: 468, y: 262 },
      { x: 550, y: 232 },
      { x: 596, y: 166 },
      { x: 536, y: 110 },
      { x: 420, y: finishY + 18 },
      { x: 302, y: finishY },
    ],
    insideChase: [
      start,
      slitEnd,
      { x: 332, y: slitY + 3 },
      { x: 470, y: 272 },
      { x: 558, y: 243 },
      { x: 610, y: 178 },
      { x: 548, y: 114 },
      { x: 430, y: finishY + 21 },
      { x: 306, y: finishY },
    ],
    sharpSashi: [
      start,
      slitEnd,
      { x: 334, y: slitY + 1 },
      { x: 458, y: 283 },
      { x: 530, y: 255 },
      { x: 566, y: 198 },
      { x: 514, y: 128 },
      { x: 390, y: finishY + 8 },
      { x: 270, y: finishY },
    ],
    outerAttack: [
      start,
      slitEnd,
      { x: 344, y: slitY - 4 },
      { x: 500, y: 286 },
      { x: 598, y: 250 },
      { x: 652, y: 176 },
      { x: 585, y: 95 },
      { x: 455, y: finishY + 22 },
      { x: 320, y: finishY },
    ],
    makuriSashi: [
      start,
      slitEnd,
      { x: 342, y: slitY - 2 },
      { x: 492, y: 286 },
      { x: 579, y: 252 },
      { x: 615, y: 192 },
      { x: 548, y: 116 },
      { x: 415, y: finishY + 10 },
      { x: 282, y: finishY },
    ],
    outsideHold: [
      start,
      slitEnd,
      { x: 342, y: slitY },
      { x: 492, y: 289 },
      { x: 596, y: 265 },
      { x: 654, y: 198 },
      { x: 604, y: 112 },
      { x: 470, y: finishY + 29 },
      { x: 336, y: finishY },
    ],
    outerFollow: [
      start,
      slitEnd,
      { x: 350, y: slitY + 1 },
      { x: 510, y: 300 },
      { x: 620, y: 282 },
      { x: 676, y: 212 },
      { x: 625, y: 120 },
      { x: 490, y: finishY + 34 },
      { x: 350, y: finishY },
    ],
  };

  const points = presets[laneType] || presets.outerFollow;

  return {
    laneType,
    points,
  };
}

function samplePath(path, progress) {
  const t = clamp01(progress);

  /*
   * 区間1: スリット〜1M進入
   * 区間2: 1M攻防
   * 区間3: 旋回後〜立ち上がり
   */
  if (t <= 0.34) {
    const local = easeInOutSine(t / 0.34);

    const p0 = path[0];
    const p1 = path[2];
    const p2 = path[3];
    const p3 = path[4];

    return {
      point: cubicBezierPoint(p0, p1, p2, p3, local),
      derivative: cubicBezierDerivative(
        p0,
        p1,
        p2,
        p3,
        local
      ),
    };
  }

  if (t <= 0.72) {
    const local = easeInOutSine((t - 0.34) / 0.38);

    const p0 = path[4];
    const p1 = path[5];
    const p2 = path[5];
    const p3 = path[6];

    return {
      point: cubicBezierPoint(p0, p1, p2, p3, local),
      derivative: cubicBezierDerivative(
        p0,
        p1,
        p2,
        p3,
        local
      ),
    };
  }

  const local = easeInOutSine((t - 0.72) / 0.28);

  const p0 = path[6];
  const p1 = path[7];
  const p2 = path[7];
  const p3 = path[8];

  return {
    point: cubicBezierPoint(p0, p1, p2, p3, local),
    derivative: cubicBezierDerivative(
      p0,
      p1,
      p2,
      p3,
      local
    ),
  };
}

function getBoatState(model, boat, progress) {
  const { laneType, points } = buildLanePath(model, boat);
  const { point, derivative } = samplePath(points, progress);

  return {
    ...point,
    angle: vectorAngle(derivative, 0),
    laneType,
  };
}

function getTrailPoints(model, boat, progress) {
  const current = clamp01(progress);
  const start = Math.max(0, current - 0.12);
  const points = [];

  for (let i = 0; i < HISTORY_POINTS; i += 1) {
    const ratio = i / Math.max(1, HISTORY_POINTS - 1);
    const p = start + (current - start) * ratio;
    points.push(getBoatState(model, boat, p));
  }

  return points;
}

function getPhase(progress) {
  const p = clamp01(progress);

  if (p < 0.18) {
    return {
      label: "スリット通過",
      caption: "スタート隊形",
    };
  }

  if (p < 0.5) {
    return {
      label: "1マーク進入",
      caption: "攻め艇が仕掛ける",
    };
  }

  if (p < 0.8) {
    return {
      label: "1マーク旋回",
      caption: "1マークの攻防",
    };
  }

  return {
    label: "旋回後",
    caption: "隊形が決まる",
  };
}

function BoatMarker({ boat, state, active = false }) {
  const color = getBoatColor(boat.boatNo);

  return (
    <g
      className={`${styles.boatGroup} ${
        active ? styles.boatActive : ""
      }`}
      transform={`translate(${state.x} ${state.y}) rotate(${state.angle})`}
    >
      <ellipse
        cx="0"
        cy="8"
        rx="19"
        ry="7"
        fill="rgba(0,0,0,.24)"
      />

      <path
        d="M -21 -7 L 16 -7 L 26 0 L 16 7 L -21 7 L -12 0 Z"
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

function Trail({ points, boatNo }) {
  const color = getBoatColor(boatNo);

  if (!points || points.length < 2) return null;

  const d = points
    .map((point, index) =>
      `${index === 0 ? "M" : "L"} ${point.x.toFixed(
        1
      )} ${point.y.toFixed(1)}`
    )
    .join(" ");

  return (
    <path
      d={d}
      fill="none"
      stroke={color.main}
      strokeWidth="5"
      strokeOpacity=".23"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

function Wake({ points }) {
  if (!points || points.length < 2) return null;

  const d = points
    .map((point, index) =>
      `${index === 0 ? "M" : "L"} ${point.x.toFixed(
        1
      )} ${point.y.toFixed(1)}`
    )
    .join(" ");

  return (
    <path
      d={d}
      fill="none"
      stroke="rgba(225,248,255,.48)"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
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

  const boatStates = useMemo(() => {
    const states = {};

    for (const boat of model.boats) {
      states[boat.boatNo] = getBoatState(
        model,
        boat,
        progress
      );
    }

    return states;
  }, [model, progress]);

  const trails = useMemo(() => {
    const states = {};

    for (const boat of model.boats) {
      states[boat.boatNo] = getTrailPoints(
        model,
        boat,
        progress
      );
    }

    return states;
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
            艇ごとの専用軌道で再現
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
          ["1M進入", 0.34],
          ["旋回", 0.63],
          ["旋回後", 0.9],
        ].map(([label, point]) => {
          const active =
            Math.abs(progress - point) < 0.18 ||
            (label === "旋回後" && progress >= 0.8);

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
              aria-label="AI 1マーク展開シミュレーション"
            >
              <defs>
                <linearGradient
                  id="waterGradientSpline"
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
                  id="waterPatternSpline"
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

                <filter id="turnGlowSpline">
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
                fill="url(#waterGradientSpline)"
              />
              <rect
                width="700"
                height="380"
                rx="22"
                fill="url(#waterPatternSpline)"
              />

              <path
                d="M 46 72 L 46 330"
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
                cx="570"
                cy="165"
                r="18"
                fill="#f5f5f5"
                stroke="#e53935"
                strokeWidth="7"
                filter="url(#turnGlowSpline)"
              />

              <path
                d="M570 136 L570 105"
                stroke="#ffb14b"
                strokeWidth="5"
              />

              <path
                d="M560 105 L580 105 L570 86 Z"
                fill="#ff7043"
              />

              {model.boats.map((boat) => (
                <Trail
                  key={`trail-${boat.boatNo}`}
                  points={trails[boat.boatNo]}
                  boatNo={boat.boatNo}
                />
              ))}

              {model.boats.map((boat) => (
                <Wake
                  key={`wake-${boat.boatNo}`}
                  points={trails[boat.boatNo]}
                />
              ))}

              {model.boats.map((boat) => (
                <BoatMarker
                  key={boat.boatNo}
                  boat={boat}
                  state={boatStates[boat.boatNo]}
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
                  : progress < 0.5
                  ? `注目艇 ${model.attackBoatNo}号艇が仕掛ける`
                  : progress < 0.8
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
