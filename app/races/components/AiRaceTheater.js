"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildRaceTheaterModel,
  getBoatColor,
  getStageLabel,
} from "../../lib/raceTheaterEngine";
import styles from "./AiRaceTheater.module.css";

const STAGE_DURATIONS = [800, 2100, 1800, 2200, 2600, 2200, 2600];

function BoatMarker({ boat, position, angle = 0, active = false }) {
  const color = getBoatColor(boat.boatNo);

  return (
    <g
      className={`${styles.boatGroup} ${
        active ? styles.boatActive : ""
      }`}
      transform={`translate(${position.x} ${position.y}) rotate(${angle})`}
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
        stroke="rgba(190,235,255,.68)"
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

const TURN_MARK = Object.freeze({ x: 545, y: 182 });

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function lerp(from, to, t) {
  return from + (to - from) * t;
}

function easeInOutSine(value) {
  const t = clamp01(value);
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

function cubicBezierPoint(p0, p1, p2, p3, t) {
  const u = 1 - t;
  return {
    x: u*u*u*p0.x + 3*u*u*t*p1.x + 3*u*t*t*p2.x + t*t*t*p3.x,
    y: u*u*u*p0.y + 3*u*u*t*p1.y + 3*u*t*t*p2.y + t*t*t*p3.y,
  };
}

function cubicBezierDerivative(p0, p1, p2, p3, t) {
  const u = 1 - t;
  return {
    x: 3*u*u*(p1.x-p0.x) + 6*u*t*(p2.x-p1.x) + 3*t*t*(p3.x-p2.x),
    y: 3*u*u*(p1.y-p0.y) + 6*u*t*(p2.y-p1.y) + 3*t*t*(p3.y-p2.y),
  };
}

function vectorAngle(vector, fallback = 0) {
  const x = Number(vector?.x);
  const y = Number(vector?.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return fallback;
  if (Math.abs(x) < 0.0001 && Math.abs(y) < 0.0001) return fallback;
  return Math.atan2(y, x) * 180 / Math.PI;
}

function getCourseIndex(model, boatNo) {
  const index = Array.isArray(model?.entryOrder) ? model.entryOrder.indexOf(boatNo) : -1;
  return index >= 0 ? index : Math.max(0, Number(boatNo) - 1);
}

function getScenarioName(model) {
  return String(model?.scenario || 'escape').trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function getTurnRadius(model, boat) {
  const courseIndex = getCourseIndex(model, boat.boatNo);
  const scenario = getScenarioName(model);
  let radius = 57 + courseIndex * 12.5;
  const isAttackBoat = Number(boat.boatNo) === Number(model?.attackBoatNo);

  if (scenario !== 'escape' && Number(boat.boatNo) === 1) radius += 7;

  if (isAttackBoat) {
    if (scenario === 'sashi' || scenario === '差し' || (scenario.includes('sashi') && !scenario.includes('makuri'))) {
      radius -= 8;
    } else if (scenario.includes('makuri_sashi') || scenario.includes('makurisashi') || scenario.includes('まくり差')) {
      radius -= 3;
    } else if (scenario.includes('makuri') || scenario.includes('まくり')) {
      radius += 5;
    }
  }

  return Math.max(48, Math.min(126, radius));
}

function getTurnProgress(model, boat, progress) {
  const t = clamp01(progress);
  const scenario = getScenarioName(model);
  const isLeader =
    (scenario === 'escape' && Number(boat.boatNo) === 1) ||
    (scenario !== 'escape' && Number(boat.boatNo) === Number(model?.attackBoatNo));
  const isSecond = Array.isArray(model?.finishOrder) && Number(boat.boatNo) === Number(model.finishOrder[1]);
  const bonus = isLeader ? 0.055 : isSecond ? 0.018 : 0;
  return clamp01(t + bonus * Math.sin(Math.PI * t));
}

function pointOnCounterClockwiseTurn(radius, progress) {
  // SVGのY軸は下向き。90°→0°→-90°で、画面上は 下→右→上 の反時計回り。
  const t = easeInOutSine(progress);
  const theta = lerp(90, -90, t);
  const radians = theta * Math.PI / 180;
  const x = TURN_MARK.x + radius * Math.cos(radians);
  const y = TURN_MARK.y + radius * Math.sin(radians);

  // 円弧の接線方向。艇首と航跡の向きを常に進行方向へ合わせる。
  const tangent = { x: Math.sin(radians), y: -Math.cos(radians) };
  return { x, y, angle: vectorAngle(tangent, 0) };
}

function getTurnEntryPoint(model, boat) {
  const radius = getTurnRadius(model, boat);
  return { x: TURN_MARK.x, y: TURN_MARK.y + radius };
}

function getTurnExitPoint(model, boat) {
  const radius = getTurnRadius(model, boat);
  return { x: TURN_MARK.x, y: TURN_MARK.y - radius };
}

function getPositions(model, stage, progress) {
  const result = {};
  const t = clamp01(progress);

  model.boats.forEach((boat) => {
    const boatNo = Number(boat.boatNo);
    const courseIndex = getCourseIndex(model, boatNo);
    const baseY = 72 + courseIndex * 47;
    const turnEntry = getTurnEntryPoint(model, boat);
    const turnExit = getTurnExitPoint(model, boat);

    if (stage <= 1) {
      const startBoost = Math.max(-6, Math.min(16, Number(boat.startPower || 0) * 0.16));
      result[boatNo] = { x: 72 + t * (138 + startBoost), y: baseY, angle: 0 };
      return;
    }

    if (stage === 2) {
      const e = easeInOutSine(t);
      const x = lerp(210, 300, e);
      const y = lerp(baseY, turnEntry.y, e);
      result[boatNo] = { x, y, angle: vectorAngle({ x: 90, y: turnEntry.y - baseY }, 0) };
      return;
    }

    if (stage === 3) {
      const p0 = { x: 300, y: turnEntry.y };
      const p1 = { x: 375, y: turnEntry.y };
      const p2 = { x: TURN_MARK.x - 88, y: turnEntry.y };
      const p3 = { x: turnEntry.x, y: turnEntry.y };
      const point = cubicBezierPoint(p0, p1, p2, p3, t);
      const derivative = cubicBezierDerivative(p0, p1, p2, p3, t);
      result[boatNo] = { ...point, angle: vectorAngle(derivative, 0) };
      return;
    }

    if (stage === 4) {
      result[boatNo] = pointOnCounterClockwiseTurn(
        getTurnRadius(model, boat),
        getTurnProgress(model, boat, t)
      );
      return;
    }

    if (stage === 5) {
      const finishIndex = Math.max(0, Array.isArray(model.finishOrder) ? model.finishOrder.indexOf(boatNo) : courseIndex);
      const targetY = 70 + finishIndex * 47;
      const targetX = 238 - Math.max(0, 5 - finishIndex) * 3;
      const p0 = { x: turnExit.x, y: turnExit.y };
      const p1 = { x: turnExit.x - 92, y: turnExit.y };
      const p2 = { x: targetX + 92, y: targetY };
      const p3 = { x: targetX, y: targetY };
      const point = cubicBezierPoint(p0, p1, p2, p3, t);
      const derivative = cubicBezierDerivative(p0, p1, p2, p3, t);
      result[boatNo] = { ...point, angle: vectorAngle(derivative, 180) };
      return;
    }

    const finishIndex = Math.max(0, Array.isArray(model.finishOrder) ? model.finishOrder.indexOf(boatNo) : courseIndex);
    result[boatNo] = { x: 102 + finishIndex * 8, y: 70 + finishIndex * 47, angle: 180 };
  });

  return result;
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

  const [stage, setStage] = useState(0);
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const animationRef = useRef(null);
  const startedAtRef = useRef(null);

  const positions = useMemo(
    () => getPositions(model, stage, progress),
    [model, stage, progress]
  );

  useEffect(() => {
    if (!playing) return undefined;

    const duration = STAGE_DURATIONS[stage] / speed;

    const animate = (timestamp) => {
      if (!startedAtRef.current) {
        startedAtRef.current = timestamp - progress * duration;
      }

      const nextProgress = Math.min(
        1,
        (timestamp - startedAtRef.current) / duration
      );

      setProgress(nextProgress);

      if (nextProgress >= 1) {
        startedAtRef.current = null;

        if (stage >= 6) {
          setPlaying(false);
          return;
        }

        setStage((current) => current + 1);
        setProgress(0);
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [playing, stage, speed]);

  const play = () => {
    if (stage >= 6 && progress >= 1) {
      setStage(0);
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
    setStage(0);
    setProgress(0);
    startedAtRef.current = null;

    window.setTimeout(() => {
      setPlaying(true);
    }, 80);
  };

  const seekStage = (nextStage) => {
    setPlaying(false);
    setStage(nextStage);
    setProgress(nextStage === 6 ? 1 : 0);
    startedAtRef.current = null;
  };

  const leaderBoat =
    model.scenario === "escape" ? 1 : model.attackBoatNo;

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
          <span>BOATSTRIKERS PHASE 6.1</span>
          <h2>AI RACE THEATER</h2>
          <p>AIが1マークの攻防を2Dシミュレーション</p>
        </div>

        <div className={styles.heroStatus}>
          <i />
          {livePrediction ? "展示後AI反映" : "前日データ版"}
        </div>
      </header>

      <nav className={styles.stageNav}>
        {[
          "待機",
          "START",
          "進入",
          "1M進入",
          "旋回",
          "BACK",
          "予想着順",
        ].map((label, index) => (
          <button
            key={label}
            type="button"
            className={index === stage ? styles.stageActive : ""}
            onClick={() => seekStage(index)}
          >
            <small>0{index}</small>
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <div className={styles.mainGrid}>
        <div className={styles.raceScreen}>
          <div className={styles.screenHeader}>
            <div>
              <small>CURRENT STAGE</small>
              <strong>{getStageLabel(stage)}</strong>
            </div>

            <div className={styles.environment}>
              <span>風 {model.environment.windSpeed}m</span>
              <span>波 {model.environment.waveHeight}cm</span>
              <span>
                進入 {model.entryOrder.join("")}/
                {model.entryOrder.slice(3).join("")}
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
                  id="waterGradient"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor="#074f7e" />
                  <stop offset="55%" stopColor="#063862" />
                  <stop offset="100%" stopColor="#041c3b" />
                </linearGradient>

                <pattern
                  id="waterPattern"
                  width="40"
                  height="14"
                  patternUnits="userSpaceOnUse"
                >
                  <path
                    d="M0 7 Q10 2 20 7 T40 7"
                    fill="none"
                    stroke="rgba(120,210,255,.13)"
                    strokeWidth="2"
                  />
                </pattern>

                <filter id="glow">
                  <feGaussianBlur stdDeviation="4" result="blur" />
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
                fill="url(#waterGradient)"
              />
              <rect
                width="700"
                height="380"
                rx="22"
                fill="url(#waterPattern)"
              />

              <path
                d="M 42 55 L 42 345"
                stroke="#ff6268"
                strokeWidth="3"
                strokeDasharray="11 9"
                opacity=".8"
              />

              <text
                x="25"
                y="42"
                fill="#ffb6b9"
                fontSize="12"
                fontWeight="900"
              >
                START
              </text>

              <path
                d="M 360 35 C 520 55 610 145 625 292"
                fill="none"
                stroke="rgba(184,228,255,.42)"
                strokeWidth="3"
                strokeDasharray="10 10"
              />

              <path
                d="M 545 306 C 625 306 665 250 665 182 C 665 114 625 58 545 58"
                fill="none"
                stroke="rgba(255,255,255,.18)"
                strokeWidth="2"
                strokeDasharray="7 10"
              />
              <path
                d="M 557 64 L 541 58 L 551 45"
                fill="none"
                stroke="rgba(255,255,255,.42)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              <circle
                cx="545"
                cy="182"
                r="18"
                fill="#f5f5f5"
                stroke="#e53935"
                strokeWidth="7"
                filter="url(#glow)"
              />
              <path
                d="M545 153 L545 120"
                stroke="#ffb14b"
                strokeWidth="5"
              />
              <path
                d="M535 120 L555 120 L545 101 Z"
                fill="#ff7043"
              />

              {model.boats.map((boat) => {
                const position = positions[boat.boatNo] || {
                  x: 70,
                  y: 80,
                  angle: 0,
                };

                return (
                  <BoatMarker
                    key={boat.boatNo}
                    boat={boat}
                    position={position}
                    angle={position.angle}
                    active={boat.boatNo === leaderBoat}
                  />
                );
              })}
            </svg>

            <div className={styles.stageCaption}>
              <span>{getStageLabel(stage)}</span>
              <strong>
                {stage < 3
                  ? "スタート隊形を解析中"
                  : stage === 4
                  ? model.mainComment
                  : stage >= 5
                  ? `予想着順 ${model.finishOrder
                      .slice(0, 3)
                      .join("-")}`
                  : "1マークへ進入"}
              </strong>
            </div>
          </div>

          <div className={styles.controls}>
            <button
              type="button"
              className={styles.playButton}
              onClick={playing ? pause : play}
            >
              {playing ? "Ⅱ 一時停止" : "▶ 再生"}
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
                  width: `${
                    ((stage + progress) / 7) * 100
                  }%`,
                }}
              />
            </div>

            <div className={styles.speedButtons}>
              {[0.5, 1, 2].map((value) => (
                <button
                  key={value}
                  type="button"
                  className={
                    speed === value ? styles.speedActive : ""
                  }
                  onClick={() => {
                    setSpeed(value);
                    startedAtRef.current = null;
                  }}
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
            <span>一果AIコメント</span>
            <strong>{model.mainComment}</strong>
            <p>
              展示タイム・展示ST・モーター・全国勝率・当地勝率・
              AIイン逃げ期待度をもとに算出しています。
            </p>
          </div>

          <div className={styles.finishPrediction}>
            <small>予想着順</small>
            <strong>
              {model.finishOrder.slice(0, 3).join(" - ")}
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
              {model.finishOrder.slice(0, 3).join("-")}
            </strong>
          </div>

          <span>VS</span>

          <div>
            <small>実際の結果</small>
            <strong>{result.trifecta_result || "-"}</strong>
          </div>
        </div>
      )}

      <p className={styles.note}>
        ※ このシミュレーションは過去データと当日の取得情報をもとにした
        研究用予測です。実際の進入・展開・着順を保証するものではありません。
      </p>
    </section>
  );
}
