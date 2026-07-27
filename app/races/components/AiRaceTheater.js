"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildRaceTheaterModel,
  getBoatColor,
  getBoatPose,
  getBoatTrailPath,
  getStageLabel,
} from "../../lib/raceTheaterEngine";
import styles from "./AiRaceTheater.module.css";

const STAGE_DURATIONS = [700, 1800, 1800, 1800, 3000, 2200, 1200];
const STAGE_LABELS = [
  "待機",
  "START",
  "加速",
  "1M接近",
  "1M攻防",
  "BACK",
  "予想着順",
];

const MANEUVER_LABELS = {
  escape: "逃げ",
  resist: "残し",
  sashi: "差し",
  makuri: "まくり",
  makuriSashi: "まくり差し",
  follow: "追走",
};

function BoatMarker({ boat, pose, active = false }) {
  const color = getBoatColor(boat.boatNo);

  return (
    <g
      className={`${styles.boatGroup} ${active ? styles.boatActive : ""}`}
      transform={`translate(${pose.x} ${pose.y}) rotate(${pose.angle})`}
    >
      <ellipse cx="-1" cy="9" rx="20" ry="7" fill="rgba(0,0,0,.25)" />
      <path
        d="M -22 -8 L 16 -8 L 26 0 L 16 8 L -22 8 L -13 0 Z"
        fill={color.main}
        stroke={color.edge}
        strokeWidth="2"
      />
      <circle cx="-3" cy="0" r="10" fill={color.main} stroke={color.edge} strokeWidth="2" />
      <text x="-3" y="4" textAnchor="middle" fill={color.text} fontSize="12" fontWeight="900">
        {boat.boatNo}
      </text>
      <path
        d="M -24 0 C -35 0 -43 -2 -53 -5"
        fill="none"
        stroke="rgba(190,235,255,.7)"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </g>
  );
}

function ProbabilityBar({ label, value, type, active }) {
  return (
    <div className={`${styles.probabilityRow} ${active ? styles.probabilityActive : ""}`}>
      <div>
        <span>{label}</span>
        <strong>{value}%</strong>
      </div>
      <div className={styles.probabilityTrack}>
        <i className={styles[type]} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function formatSt(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "-.--";
  return number.toFixed(2).replace(/^0/, "");
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

  useEffect(() => {
    if (!playing) return undefined;

    const duration = STAGE_DURATIONS[stage] / speed;

    const animate = (timestamp) => {
      if (!startedAtRef.current) {
        startedAtRef.current = timestamp - progress * duration;
      }

      const nextProgress = Math.min(1, (timestamp - startedAtRef.current) / duration);
      setProgress(nextProgress);

      if (nextProgress >= 1) {
        startedAtRef.current = null;

        if (stage >= STAGE_LABELS.length - 1) {
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
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [playing, progress, speed, stage]);

  const play = () => {
    if (stage >= STAGE_LABELS.length - 1 && progress >= 1) {
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
    window.setTimeout(() => setPlaying(true), 80);
  };

  const seekStage = (nextStage) => {
    setPlaying(false);
    setStage(nextStage);
    setProgress(nextStage === STAGE_LABELS.length - 1 ? 1 : 0);
    startedAtRef.current = null;
  };

  if (!entries || entries.length === 0) {
    return (
      <section className={styles.empty}>
        <strong>AI 1マーク予想を準備できません</strong>
        <p>出走表データの同期後に自動表示されます。</p>
      </section>
    );
  }

  const totalProgress = ((stage + progress) / STAGE_LABELS.length) * 100;

  return (
    <section className={styles.theater}>
      <header className={styles.hero}>
        <div>
          <span>BOATSTRIKERS ULTIMATE v15</span>
          <h2>AI 1マーク予想 Ver.2</h2>
          <p>進入・スタート・旋回力から6艇別の攻め筋を描画</p>
        </div>
        <div className={styles.heroStatus}>
          <i />
          {livePrediction ? "展示後AI反映" : "前日データ版"}
        </div>
      </header>

      <nav className={styles.stageNav} aria-label="シミュレーション段階">
        {STAGE_LABELS.map((label, index) => (
          <button
            key={label}
            type="button"
            className={index === stage ? styles.stageActive : ""}
            onClick={() => seekStage(index)}
          >
            <small>{String(index).padStart(2, "0")}</small>
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
              <span>進入 {model.entryOrder.join("")}</span>
            </div>
          </div>

          <div className={styles.svgWrap}>
            <svg viewBox="0 0 700 380" role="img" aria-label="AIによる1マーク展開予想">
              <defs>
                <linearGradient id="v15WaterGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#075987" />
                  <stop offset="58%" stopColor="#063a65" />
                  <stop offset="100%" stopColor="#041c3b" />
                </linearGradient>
                <pattern id="v15WaterPattern" width="42" height="14" patternUnits="userSpaceOnUse">
                  <path d="M0 7 Q10 2 21 7 T42 7" fill="none" stroke="rgba(120,210,255,.13)" strokeWidth="2" />
                </pattern>
                <filter id="v15Glow">
                  <feGaussianBlur stdDeviation="4" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              <rect width="700" height="380" rx="22" fill="url(#v15WaterGradient)" />
              <rect width="700" height="380" rx="22" fill="url(#v15WaterPattern)" />

              <path d="M 48 48 L 48 345" stroke="#ff656b" strokeWidth="3" strokeDasharray="11 9" opacity=".84" />
              <text x="27" y="38" fill="#ffb7ba" fontSize="12" fontWeight="900">START</text>

              <path
                d="M 330 315 C 430 330 530 315 573 250 C 612 192 608 126 566 76"
                fill="none"
                stroke="rgba(193,231,255,.3)"
                strokeWidth="3"
                strokeDasharray="11 10"
              />

              <circle cx="545" cy="190" r="18" fill="#f7f7f7" stroke="#e53935" strokeWidth="7" filter="url(#v15Glow)" />
              <path d="M545 161 L545 127" stroke="#ffb14b" strokeWidth="5" />
              <path d="M535 127 L555 127 L545 108 Z" fill="#ff7043" />

              {stage >= 1 && stage <= 5 &&
                model.boats.map((boat) => {
                  const path = getBoatTrailPath(model, boat.boatNo, stage, progress);
                  const color = getBoatColor(boat.boatNo);
                  return path ? (
                    <path
                      key={`trail-${boat.boatNo}`}
                      d={path}
                      fill="none"
                      stroke={color.main}
                      strokeWidth={boat.boatNo === model.leaderBoatNo ? 4 : 2.2}
                      strokeLinecap="round"
                      opacity={boat.boatNo === model.leaderBoatNo ? 0.74 : 0.35}
                    />
                  ) : null;
                })}

              {model.boats.map((boat) => {
                const pose = getBoatPose(model, boat.boatNo, stage, progress);
                return (
                  <BoatMarker
                    key={boat.boatNo}
                    boat={boat}
                    pose={pose}
                    active={boat.boatNo === model.leaderBoatNo}
                  />
                );
              })}
            </svg>

            <div className={styles.stageCaption}>
              <span>{model.scenarioLabel}シナリオ</span>
              <strong>
                {stage <= 1
                  ? "予測スタートタイミングから初速差を再現"
                  : stage === 2
                  ? "伸び指数を反映して1マークへの隊形を形成"
                  : stage === 3
                  ? `${model.attackBoatNo}号艇の攻めに注目`
                  : stage === 4
                  ? model.mainComment
                  : `予想着順 ${model.finishOrder.slice(0, 3).join("-")}`}
              </strong>
            </div>
          </div>

          <div className={styles.controls}>
            <button type="button" className={styles.playButton} onClick={playing ? pause : play}>
              {playing ? "Ⅱ 一時停止" : "▶ 再生"}
            </button>
            <button type="button" className={styles.replayButton} onClick={replay}>↻ リプレイ</button>
            <div className={styles.progressTrack}><i style={{ width: `${totalProgress}%` }} /></div>
            <label className={styles.speedControl}>
              <span>速度</span>
              <select value={speed} onChange={(eventValue) => setSpeed(Number(eventValue.target.value))}>
                <option value={0.75}>0.75x</option>
                <option value={1}>1.0x</option>
                <option value={1.5}>1.5x</option>
                <option value={2}>2.0x</option>
              </select>
            </label>
          </div>
        </div>

        <aside className={styles.analysisPanel}>
          <div className={styles.scenarioCard}>
            <small>MAIN SCENARIO</small>
            <strong>{model.scenarioLabel}</strong>
            <span>{model.attackBoatNo}号艇が展開の鍵</span>
          </div>

          <div className={styles.probabilityCard}>
            <h3>展開確率</h3>
            <ProbabilityBar label="逃げ" value={model.probabilities.escape} type="escape" active={model.scenario === "escape"} />
            <ProbabilityBar label="差し" value={model.probabilities.sashi} type="sashi" active={model.scenario === "sashi"} />
            <ProbabilityBar label="まくり" value={model.probabilities.makuri} type="makuri" active={model.scenario === "makuri"} />
            <ProbabilityBar label="まくり差し" value={model.probabilities.makuriSashi} type="makuriSashi" active={model.scenario === "makuriSashi"} />
          </div>

          <div className={styles.boatPlanCard}>
            <h3>6艇の予測プラン</h3>
            <div className={styles.boatPlanList}>
              {model.boats.map((boat) => (
                <div key={boat.boatNo} className={boat.boatNo === model.leaderBoatNo ? styles.boatPlanLeader : ""}>
                  <b className={styles[`boat${boat.boatNo}`]}>{boat.boatNo}</b>
                  <span>
                    <strong>{MANEUVER_LABELS[boat.maneuver] || "追走"}</strong>
                    <small>予測ST {formatSt(boat.predictedSt)}</small>
                  </span>
                  <em>{boat.turnPower}</em>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.evidenceCard}>
            <h3>AI判断根拠</h3>
            <ul>
              {model.evidence.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>

          <div className={styles.finishCard}>
            <small>1M出口 予想着順</small>
            <strong>{model.finishOrder.slice(0, 3).join(" - ")}</strong>
            {result ? <span>確定結果反映済み</span> : <span>AI予測値</span>}
          </div>
        </aside>
      </div>

      <p className={styles.disclaimer}>
        この表示はPC-KYOTEI同期データとBoatStrikers分析値による展開予測です。実際の進入・スタート・旋回を保証するものではありません。
      </p>
    </section>
  );
}
