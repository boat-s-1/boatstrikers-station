"use client";

import { useEffect, useState } from "react";

const chapters = [
  {
    id: "advanced-1",
    title: "Chapter 1",
    subtitle: "勝率の見方",
    href: "/bsc2/advanced/chapter1",
    top: "78%",
    left: "48%",
  },
  {
    id: "advanced-2",
    title: "Chapter 2",
    subtitle: "回収率",
    href: "/bsc2/advanced/chapter2",
    top: "63%",
    left: "50%",
    locked: true,
  },
  {
    id: "advanced-3",
    title: "Chapter 3",
    subtitle: "期待値",
    href: "/bsc2/advanced/chapter3",
    top: "48%",
    left: "50%",
    locked: true,
  },
  {
    id: "advanced-4",
    title: "Chapter 4",
    subtitle: "オッズ攻略",
    href: "/bsc2/advanced/chapter4",
    top: "33%",
    left: "51%",
    locked: true,
  },
  {
    id: "advanced-5",
    title: "Chapter 5",
    subtitle: "資金管理",
    href: "/bsc2/advanced/chapter5",
    top: "18%",
    left: "51%",
    locked: true,
  },
];

export default function AdvancedPage() {
  const [cleared, setCleared] = useState([]);

  useEffect(() => {
    setCleared(JSON.parse(localStorage.getItem("bscCleared") || "[]"));
  }, []);

  const clearCount = chapters.filter((c) => cleared.includes(c.id)).length;
  const currentIndex = Math.min(clearCount, chapters.length - 1);
  const clearRate = Math.round((clearCount / chapters.length) * 100);
  const isComplete = clearRate >= 100;

  return (
    <main className="advancedGameMapPage">
      <style>{`
        .advancedGameMapPage {
          min-height: 100vh;
          background: #08051e;
          padding: 12px 10px 80px;
        }

        .advancedMapHeader {
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

        .advancedMapHeader a {
          width: 38px;
          height: 38px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          background: #1b1240;
          color: #fff;
          text-decoration: none;
          font-size: 22px;
          font-weight: 900;
        }

        .advancedMapHeader div {
          text-align: center;
        }

        .advancedMapHeader span {
          color: #9b5cff;
          font-size: 11px;
          font-weight: 900;
        }

        .advancedMapHeader h1 {
          margin: 2px 0 0;
          color: #1b1240;
          font-size: 18px;
          font-weight: 900;
        }

        .advancedMapHeader b {
          text-align: center;
          font-size: 24px;
        }

        .advancedMapInfo {
          max-width: 520px;
          margin: 0 auto 10px;
          padding: 10px 14px;
          border-radius: 18px;
          background: rgba(20, 10, 55, .95);
          border: 2px solid #c99cff;
          color: #fff;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .advancedMapInfo span,
        .advancedMapInfo strong {
          font-size: 12px;
          font-weight: 900;
        }

        .advancedMapInfo strong {
          color: #ffd768;
        }

        .advancedGameMap {
          position: relative;
          width: 100%;
          max-width: 520px;
          margin: 0 auto;
          border-radius: 28px;
          overflow: hidden;
          border: 3px solid #c99cff;
          box-shadow: 0 18px 42px rgba(0,0,0,.55);
          background: #08051e;
        }

        .advancedGameMapBg {
          width: 100%;
          display: block;
        }

        .advancedStage {
          position: absolute;
          transform: translate(-50%, -50%);
          z-index: 10;
          text-decoration: none;
        }

        .advancedStageOrb {
          width: 54px;
          height: 54px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          background: linear-gradient(135deg, #8f4fff, #ff4fd8);
          color: #fff;
          border: 4px solid #fff;
          font-size: 22px;
          font-weight: 900;
          box-shadow: 0 0 20px rgba(201,156,255,.95), 0 8px 18px rgba(0,0,0,.4);
        }

        .advancedStage.clear .advancedStageOrb {
          background: #06c755;
        }

        .advancedStage.locked .advancedStageOrb {
          background: rgba(0,0,0,.5);
          backdrop-filter: blur(6px);
          opacity: .78;
        }

        .advancedStage.current .advancedStageOrb {
          animation: advancedStagePulse 1.4s infinite;
        }

        .advancedStage.locked {
          pointer-events: none;
        }

        .advancedFog {
          position: absolute;
          inset: -34px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(170,100,255,.55), rgba(255,255,255,.08), transparent 70%);
          z-index: -1;
          animation: advancedFogMove 3s ease-in-out infinite;
        }

        .advancedFireworks {
          position: absolute;
          left: 50%;
          top: -26px;
          transform: translateX(-50%);
          font-size: 24px;
          animation: advancedFireworkPop 1.4s ease-in-out infinite;
          z-index: 30;
        }

        .advancedSparkle {
          position: absolute;
          inset: -24px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(210,160,255,.95), transparent 65%);
          animation: advancedSparklePulse 1.4s infinite;
          z-index: -1;
        }

        .advancedBoatHatsune {
          position: absolute;
          left: 50%;
          top: -86px;
          width: 84px;
          height: 84px;
          object-fit: contain;
          transform: translateX(-50%);
          z-index: 25;
          animation: advancedBoatMove 1.8s ease-in-out infinite;
          filter: drop-shadow(0 8px 8px rgba(0,0,0,.45));
        }

        .advancedWoodBoard {
          position: absolute;
          left: 50%;
          top: 64px;
          transform: translateX(-50%);
          min-width: 140px;
          padding: 9px 10px 10px;
          border-radius: 12px;
          background: linear-gradient(180deg, #3c246f, #1a0d3d);
          color: #fff7ff;
          border: 3px solid #c99cff;
          text-align: center;
          box-shadow: 0 8px 18px rgba(0,0,0,.45);
        }

        .advancedWoodBoard span {
          display: inline-block;
          padding: 3px 8px;
          border-radius: 999px;
          background: rgba(255,255,255,.18);
          font-size: 9px;
          font-weight: 900;
        }

        .advancedWoodBoard strong {
          display: block;
          margin-top: 4px;
          font-size: 14px;
          font-weight: 900;
        }

        .advancedWoodBoard p {
          margin: 2px 0 0;
          font-size: 10px;
          font-weight: 900;
        }

        .advancedMapLabel {
          position: absolute;
          left: 50%;
          transform: translateX(-50%);
          z-index: 8;
          padding: 8px 18px;
          border-radius: 999px;
          background: rgba(20,10,55,.92);
          color: #ffd768;
          border: 2px solid #c99cff;
          font-weight: 900;
          box-shadow: 0 8px 18px rgba(0,0,0,.35);
        }

        .advancedStartLabel {
          bottom: 3.5%;
        }

        .advancedGoalLabel {
          top: 4%;
        }

        .advancedCompleteRibbon {
          position: absolute;
          top: 10%;
          left: 50%;
          transform: translateX(-50%);
          z-index: 40;
          padding: 14px 22px;
          border-radius: 999px;
          background: linear-gradient(135deg, #c99cff, #ff4fd8);
          color: #fff;
          font-size: 22px;
          font-weight: 900;
          box-shadow: 0 10px 26px rgba(0,0,0,.4);
          animation: advancedCompletePop 1.6s ease-in-out infinite;
        }

        @keyframes advancedBoatMove {
          0%, 100% {
            transform: translateX(-50%) translateY(0) rotate(-4deg);
          }
          50% {
            transform: translateX(-50%) translateY(-10px) rotate(4deg);
          }
        }

        @keyframes advancedStagePulse {
          0%, 100% {
            box-shadow: 0 0 0 0 rgba(201,156,255,.75), 0 8px 18px rgba(0,0,0,.35);
          }
          50% {
            box-shadow: 0 0 0 14px rgba(201,156,255,0), 0 8px 18px rgba(0,0,0,.35);
          }
        }

        @keyframes advancedFogMove {
          0%, 100% {
            opacity: .55;
            transform: scale(1);
          }
          50% {
            opacity: .9;
            transform: scale(1.12);
          }
        }

        @keyframes advancedFireworkPop {
          0%, 100% {
            transform: translateX(-50%) scale(.9);
            opacity: .8;
          }
          50% {
            transform: translateX(-50%) scale(1.25);
            opacity: 1;
          }
        }

        @keyframes advancedSparklePulse {
          0%, 100% {
            opacity: .35;
            transform: scale(.9);
          }
          50% {
            opacity: .85;
            transform: scale(1.2);
          }
        }

        @keyframes advancedCompletePop {
          0%, 100% {
            transform: translateX(-50%) scale(1);
          }
          50% {
            transform: translateX(-50%) scale(1.08);
          }
        }
      `}</style>

      <header className="advancedMapHeader">
        <a href="/bsc2">←</a>
        <div>
          <span>BSC AREA</span>
          <h1>上級者ロード</h1>
        </div>
        <b>💜</b>
      </header>

      <section className="advancedMapInfo">
        <span>💜 HATSUNE ADVANCED ROAD</span>
        <strong>{isComplete ? "COMPLETE 👑" : `CLEAR率 ${clearRate}%`}</strong>
      </section>

      <section className="advancedGameMap">
        <img
          src="/bsc/advanced-map.png"
          alt="上級者ロード"
          className="advancedGameMapBg"
        />

        {isComplete && (
          <div className="advancedCompleteRibbon">👑 COMPLETE</div>
        )}

        <div className="advancedMapLabel advancedStartLabel">START</div>
        <div className="advancedMapLabel advancedGoalLabel">🏆 GOAL</div>

        {chapters.map((chapter, index) => {
          const isClear = cleared.includes(chapter.id);
          const isCurrent = index === currentIndex && !chapter.locked;
          const isLocked = chapter.locked;

          return (
            <a
              key={chapter.id}
              href={isLocked ? "#" : chapter.href}
              className={`advancedStage ${isClear ? "clear" : ""} ${
                isCurrent ? "current" : ""
              } ${isLocked ? "locked" : ""}`}
              style={{
                top: chapter.top,
                left: chapter.left,
              }}
            >
              {isLocked && <div className="advancedFog" />}
              {isClear && <div className="advancedFireworks">🎆</div>}
              {isCurrent && <div className="advancedSparkle" />}

              {isCurrent && (
                <img
                  src="/bsc/hatsune-boat.png"
                  alt="初音"
                  className="advancedBoatHatsune"
                  onError={(e) => {
                    e.currentTarget.src = "/bsc/status-hatsune.png";
                  }}
                />
              )}

              <div className="advancedStageOrb">
                {isLocked ? "🔒" : isClear ? "✓" : index + 1}
              </div>

              {(isCurrent || isClear) && (
                <div className="advancedWoodBoard">
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
