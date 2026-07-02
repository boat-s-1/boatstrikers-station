"use client";

import { useEffect, useState } from "react";

const chapters = [
  {
    id: "intermediate-1",
    title: "Chapter 1",
    subtitle: "スタート展示",
    href: "/bsc2/intermediate/chapter1",
    top: "78%",
    left: "48%",
  },
  {
    id: "intermediate-2",
    title: "Chapter 2",
    subtitle: "展示タイム",
    href: "/bsc2/intermediate/chapter2",
    top: "62%",
    left: "50%",
    locked: true,
  },
  {
    id: "intermediate-3",
    title: "Chapter 3",
    subtitle: "モーター評価",
    href: "/bsc2/intermediate/chapter3",
    top: "47%",
    left: "50%",
    locked: true,
  },
  {
    id: "intermediate-4",
    title: "Chapter 4",
    subtitle: "ST分析",
    href: "/bsc2/intermediate/chapter4",
    top: "32%",
    left: "51%",
    locked: true,
  },
  {
    id: "intermediate-5",
    title: "Chapter 5",
    subtitle: "展示総合判断",
    href: "/bsc2/intermediate/chapter5",
    top: "18%",
    left: "51%",
    locked: true,
  },
];

export default function IntermediatePage() {
  const [cleared, setCleared] = useState([]);

  useEffect(() => {
    setCleared(JSON.parse(localStorage.getItem("bscCleared") || "[]"));
  }, []);

  const clearCount = chapters.filter((c) => cleared.includes(c.id)).length;
  const currentIndex = Math.min(clearCount, chapters.length - 1);
  const clearRate = Math.round((clearCount / chapters.length) * 100);
  const isComplete = clearRate >= 100;

  return (
    <main className="intermediateGameMapPage">
      <style>{`
        .intermediateGameMapPage {
          min-height: 100vh;
          background: #160b28;
          padding: 12px 10px 80px;
        }

        .intermediateMapHeader {
          position: sticky;
          top: 8px;
          z-index: 50;
          height: 62px;
          display: grid;
          grid-template-columns: 42px 1fr 48px;
          align-items: center;
          padding: 8px 10px;
          margin-bottom: 12px;
          border-radius: 22px;
          background: rgba(255,255,255,.94);
          box-shadow: 0 8px 22px rgba(0,0,0,.18);
        }

        .intermediateMapHeader a {
          width: 38px;
          height: 38px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          background: #2c1b55;
          color: #fff;
          text-decoration: none;
          font-size: 22px;
          font-weight: 900;
        }

        .intermediateMapHeader div {
          text-align: center;
        }

        .intermediateMapHeader span {
          color: #f6a800;
          font-size: 11px;
          font-weight: 900;
        }

        .intermediateMapHeader h1 {
          margin: 2px 0 0;
          color: #2c1b55;
          font-size: 18px;
          font-weight: 900;
        }

        .intermediateMapInfo {
          max-width: 520px;
          margin: 0 auto 10px;
          padding: 10px 14px;
          border-radius: 18px;
          background: rgba(28, 15, 62, .95);
          border: 2px solid #ffd768;
          color: #fff;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .intermediateMapInfo span,
        .intermediateMapInfo strong {
          font-size: 12px;
          font-weight: 900;
        }

        .intermediateMapInfo strong {
          color: #ffd768;
        }

        .intermediateGameMap {
          position: relative;
          width: 100%;
          max-width: 520px;
          margin: 0 auto;
          border-radius: 28px;
          overflow: hidden;
          border: 3px solid #ffd768;
          box-shadow: 0 18px 40px rgba(0,0,0,.45);
          background: #160b28;
        }

        .intermediateGameMapBg {
          width: 100%;
          display: block;
        }

        .intermediateStage {
          position: absolute;
          transform: translate(-50%, -50%);
          z-index: 10;
          text-decoration: none;
        }

        .intermediateStageOrb {
          width: 54px;
          height: 54px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          background: linear-gradient(135deg, #f6a800, #ff4f00);
          color: #fff;
          border: 4px solid #fff;
          font-size: 22px;
          font-weight: 900;
          box-shadow: 0 0 18px rgba(255,215,104,.95), 0 8px 18px rgba(0,0,0,.35);
        }

        .intermediateStage.clear .intermediateStageOrb {
          background: #06c755;
        }

        .intermediateStage.locked .intermediateStageOrb {
          background: rgba(0,0,0,.48);
          backdrop-filter: blur(6px);
          opacity: .78;
        }

        .intermediateStage.current .intermediateStageOrb {
          animation: intermediateStagePulse 1.4s infinite;
        }

        .intermediateStage.locked {
          pointer-events: none;
        }

        .intermediateFog {
          position: absolute;
          inset: -34px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(255,220,120,.45), rgba(255,255,255,.08), transparent 70%);
          z-index: -1;
          animation: intermediateFogMove 3s ease-in-out infinite;
        }

        .intermediateFireworks {
          position: absolute;
          left: 50%;
          top: -26px;
          transform: translateX(-50%);
          font-size: 24px;
          animation: intermediateFireworkPop 1.4s ease-in-out infinite;
          z-index: 30;
        }

        .intermediateSparkle {
          position: absolute;
          inset: -24px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(255,215,104,.95), transparent 65%);
          animation: intermediateSparklePulse 1.4s infinite;
          z-index: -1;
        }

        .intermediateBoatKiina {
          position: absolute;
          left: 50%;
          top: -86px;
          width: 84px;
          height: 84px;
          object-fit: contain;
          transform: translateX(-50%);
          z-index: 25;
          animation: intermediateBoatMove 1.8s ease-in-out infinite;
          filter: drop-shadow(0 8px 8px rgba(0,0,0,.42));
        }

        .intermediateWoodBoard {
          position: absolute;
          left: 50%;
          top: 64px;
          transform: translateX(-50%);
          min-width: 140px;
          padding: 9px 10px 10px;
          border-radius: 12px;
          background: linear-gradient(180deg, #8b5a1d, #3c2310);
          color: #fff7d6;
          border: 3px solid #ffd768;
          text-align: center;
          box-shadow: 0 8px 18px rgba(0,0,0,.4);
        }

        .intermediateWoodBoard span {
          display: inline-block;
          padding: 3px 8px;
          border-radius: 999px;
          background: rgba(255,255,255,.18);
          font-size: 9px;
          font-weight: 900;
        }

        .intermediateWoodBoard strong {
          display: block;
          margin-top: 4px;
          font-size: 14px;
          font-weight: 900;
        }

        .intermediateWoodBoard p {
          margin: 2px 0 0;
          font-size: 10px;
          font-weight: 900;
        }

        .intermediateMapLabel {
          position: absolute;
          left: 50%;
          transform: translateX(-50%);
          z-index: 8;
          padding: 8px 18px;
          border-radius: 999px;
          background: rgba(28,15,62,.92);
          color: #ffd768;
          border: 2px solid #ffd768;
          font-weight: 900;
          box-shadow: 0 8px 18px rgba(0,0,0,.32);
        }

        .intermediateStartLabel {
          bottom: 3.5%;
        }

        .intermediateGoalLabel {
          top: 4%;
        }

        .intermediateCompleteRibbon {
          position: absolute;
          top: 10%;
          left: 50%;
          transform: translateX(-50%);
          z-index: 40;
          padding: 14px 22px;
          border-radius: 999px;
          background: linear-gradient(135deg, #ffd768, #ff7a00);
          color: #fff;
          font-size: 22px;
          font-weight: 900;
          box-shadow: 0 10px 26px rgba(0,0,0,.35);
          animation: intermediateCompletePop 1.6s ease-in-out infinite;
        }

        @keyframes intermediateBoatMove {
          0%, 100% {
            transform: translateX(-50%) translateY(0) rotate(-4deg);
          }
          50% {
            transform: translateX(-50%) translateY(-10px) rotate(4deg);
          }
        }

        @keyframes intermediateStagePulse {
          0%, 100% {
            box-shadow: 0 0 0 0 rgba(255,215,104,.7), 0 8px 18px rgba(0,0,0,.35);
          }
          50% {
            box-shadow: 0 0 0 14px rgba(255,215,104,0), 0 8px 18px rgba(0,0,0,.35);
          }
        }

        @keyframes intermediateFogMove {
          0%, 100% {
            opacity: .55;
            transform: scale(1);
          }
          50% {
            opacity: .85;
            transform: scale(1.12);
          }
        }

        @keyframes intermediateFireworkPop {
          0%, 100% {
            transform: translateX(-50%) scale(.9);
            opacity: .8;
          }
          50% {
            transform: translateX(-50%) scale(1.25);
            opacity: 1;
          }
        }

        @keyframes intermediateSparklePulse {
          0%, 100% {
            opacity: .35;
            transform: scale(.9);
          }
          50% {
            opacity: .85;
            transform: scale(1.2);
          }
        }

        @keyframes intermediateCompletePop {
          0%, 100% {
            transform: translateX(-50%) scale(1);
          }
          50% {
            transform: translateX(-50%) scale(1.08);
          }
        }
      `}</style>

      <header className="intermediateMapHeader">
        <a href="/bsc2">←</a>
        <div>
          <span>BSC AREA</span>
          <h1>中級者ロード</h1>
        </div>
        <b>⚡</b>
      </header>

      <section className="intermediateMapInfo">
        <span>⚡ KIINA INTERMEDIATE ROAD</span>
        <strong>{isComplete ? "COMPLETE 👑" : `CLEAR率 ${clearRate}%`}</strong>
      </section>

      <section className="intermediateGameMap">
        <img
          src="/bsc/24D7EEF1-05AD-43D0-858B-97E739210A1D.png"
          alt="中級者ロード"
          className="intermediateGameMapBg"
        />

        {isComplete && (
          <div className="intermediateCompleteRibbon">👑 COMPLETE</div>
        )}

        <div className="intermediateMapLabel intermediateStartLabel">START</div>
        <div className="intermediateMapLabel intermediateGoalLabel">🏆 GOAL</div>

        {chapters.map((chapter, index) => {
          const isClear = cleared.includes(chapter.id);
          const isCurrent = index === currentIndex && !chapter.locked;
          const isLocked = chapter.locked;

          return (
            <a
              key={chapter.id}
              href={isLocked ? "#" : chapter.href}
              className={`intermediateStage ${isClear ? "clear" : ""} ${
                isCurrent ? "current" : ""
              } ${isLocked ? "locked" : ""}`}
              style={{
                top: chapter.top,
                left: chapter.left,
              }}
            >
              {isLocked && <div className="intermediateFog" />}
              {isClear && <div className="intermediateFireworks">🎆</div>}
              {isCurrent && <div className="intermediateSparkle" />}

              {isCurrent && (
                <img
                  src="/bsc/kiina-boat.png"
                  alt="キイナ"
                  className="intermediateBoatKiina"
                  onError={(e) => {
                    e.currentTarget.src = "/bsc/status-kiina.png";
                  }}
                />
              )}

              <div className="intermediateStageOrb">
                {isLocked ? "🔒" : isClear ? "✓" : index + 1}
              </div>

              {(isCurrent || isClear) && (
                <div className="intermediateWoodBoard">
                  <span>{isClear ? "CLEAR" : "NOW"}</span>
                  <strong>{chapter.title}</strong>
                  <p>{chapter.subtitle}</p>
                </div>
              )}
            </a>
          );
        })}
      </section>
    </main>
  );
}
