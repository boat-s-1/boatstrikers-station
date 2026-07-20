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

function getPositions(model, stage, progress) {
  const result = {};

  model.boats.forEach((boat, index) => {
    const baseY = 78 + index * 48;

    if (stage <= 1) {
      result[boat.boatNo] = {
        x: 70 + progress * (105 + boat.startPower * 0.6),
        y: baseY,
        angle: 0,
      };
      return;
    }

    if (stage === 2) {
      const courseIndex = model.entryOrder.indexOf(boat.boatNo);
      result[boat.boatNo] = {
        x: 205 + progress * 75,
        y: 76 + courseIndex * 46,
        angle: 0,
      };
      return;
    }

    if (stage === 3) {
      const courseIndex = model.entryOrder.indexOf(boat.boatNo);
      const targetX = 455 - courseIndex * 8;
      const targetY = 102 + courseIndex * 38;

      result[boat.boatNo] = {
        x: 280 + (targetX - 280) * progress,
        y:
          76 +
          courseIndex * 46 +
          (targetY - (76 + courseIndex * 46)) * progress,
        angle: progress * 8,
      };
      return;
    }

    if (stage === 4) {
      const courseIndex = model.entryOrder.indexOf(boat.boatNo);
      const isLeader =
        (model.scenario === "escape" && boat.boatNo === 1) ||
        (model.scenario !== "escape" &&
          boat.boatNo === model.attackBoatNo);

      const angle = -8 - progress * (60 + courseIndex * 3);
      const radius = 78 + courseIndex * 13;
      const radians = (angle * Math.PI) / 180;

      result[boat.boatNo] = {
        x:
          535 -
          Math.cos(radians) * radius +
          (isLeader ? progress * 15 : 0),
        y:
          180 +
          Math.sin(radians) * radius +
          courseIndex * 3,
        angle: -angle - 10,
      };
      return;
    }

    if (stage === 5) {
      const finishIndex = model.finishOrder.indexOf(boat.boatNo);

      result[boat.boatNo] = {
        x: 520 + progress * (95 - finishIndex * 5),
        y: 86 + finishIndex * 43,
        angle: -4,
      };
      return;
    }

    const finishIndex = model.finishOrder.indexOf(boat.boatNo);
    result[boat.boatNo] = {
      x: 590 - finishIndex * 15,
      y: 76 + finishIndex * 45,
      angle: 0,
    };
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
