"use client";

import { useEffect, useState } from "react";

const chapters = [
  {
    id: "chapter1-lesson1",
    title: "Chapter 1",
    subtitle: "競艇入門編",
    href: "/bsc2/play/chapter1",
    top: "78%",
    left: "43%",
  },
  {
    id: "chapter2-start-tenji",
    title: "Chapter 2",
    subtitle: "スタート展示",
    href: "/bsc2/play/chapter2",
    top: "57%",
    left: "51%",
  },
  {
    id: "chapter3-tenji-time",
    title: "Chapter 3",
    subtitle: "展示タイム",
    href: "/bsc2/play/chapter3",
    top: "45%",
    left: "49%",
    locked: true,
  },
  {
    id: "chapter4-ichigoutei",
    title: "Chapter 4",
    subtitle: "1号艇の基本",
    href: "/bsc2/play/chapter4",
    top: "32%",
    left: "51%",
    locked: true,
  },
  {
    id: "chapter5-kaime",
    title: "Chapter 5",
    subtitle: "買い目作成",
    href: "/bsc2/play/chapter5",
    top: "20%",
    left: "54%",
    locked: true,
  },
];

export default function BeginnerPage() {
  const [cleared, setCleared] = useState([]);

  useEffect(() => {
    setCleared(JSON.parse(localStorage.getItem("bscCleared") || "[]"));
  }, []);

  const clearCount = chapters.filter((c) => cleared.includes(c.id)).length;
  const currentIndex = Math.min(clearCount, chapters.length - 1);
  const clearRate = Math.round((clearCount / chapters.length) * 100);
  const isComplete = clearRate >= 100;

  return (
    <main className="beginnerGameMapPage">
      <style>{`
        .beginnerGameMapPage {
          min-height: 100vh;
          background: #071f4f;
          padding: 12px 10px 80px;
        }

        .beginnerMapHeader {
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

        .beginnerMapHeader a {
          width: 38px;
          height: 38px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          background: #17345c;
          color: #fff;
          text-decoration: none;
          font-size: 22px;
          font-weight: 900;
        }

        .beginnerMapHeader div {
          text-align: center;
        }

        .beginnerMapHeader span {
          color: #ff4f93;
          font-size: 11px;
          font-weight: 900;
        }

        .beginnerMapHeader h1 {
          margin: 2px 0 0;
          color: #17345c;
          font-size: 18px;
          font-weight: 900;
        }

        .beginnerMapInfo {
          max-width: 520px;
          margin: 0 auto 10px;
          padding: 10px 14px;
          border-radius: 18px;
          background: rgba(10,35,85,.95);
          border: 2px solid #ffd768;
          color: #fff;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .beginnerMapInfo span,
        .beginnerMapInfo strong {
          font-size: 12px;
          font-weight: 900;
        }

        .beginnerMapInfo strong {
          color: #ffd768;
        }

        .beginnerGameMap {
          position: relative;
          width: 100%;
          max-width: 520px;
          margin: 0 auto;
          border-radius: 28px;
          overflow: hidden;
          border: 3px solid #ffd768;
          box-shadow: 0 18px 40px rgba(0,0,0,.38);
          background: #071f4f;
          perspective: 900px;
        }

        .beginnerGameMapBg {
          width: 100%;
          display: block;
        }

        .mapStage {
          position: absolute;
          transform: translate(-50%, -50%);
          z-index: 10;
          text-decoration: none;
          animation: islandFloat 4s ease-in-out infinite;
        }

        .mapStage:nth-of-type(odd) {
          animation-delay: .4s;
        }

        .mapStageOrb {
          width: 54px;
          height: 54px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          background: linear-gradient(135deg, #ff4f93, #f6a800);
          color: #fff;
          border: 4px solid #fff;
          font-size: 22px;
          font-weight: 900;
          box-shadow: 0 0 18px rgba(255,255,255,.9), 0 8px 18px rgba(0,0,0,.35);
        }

        .mapStage.clear .mapStageOrb {
          background: #06c755;
        }

        .mapStage.locked .mapStageOrb {
          background: rgba(0,0,0,.42);
          backdrop-filter: blur(6px);
          opacity: .78;
        }

        .mapStage.current .mapStageOrb {
          background: linear-gradient(135deg, #ff4f93, #f6a800);
          animation: mapStagePulse 1.4s infinite;
        }

        .mapStage.locked {
          pointer-events: none;
        }

        .mapFog {
          position: absolute;
          inset: -34px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(255,255,255,.55), rgba(255,255,255,.08), transparent 70%);
          z-index: -1;
          animation: fogMove 3s ease-in-out infinite;
        }

        .mapFireworks {
          position: absolute;
          left: 50%;
          top: -26px;
          transform: translateX(-50%);
          font-size: 24px;
          animation: fireworkPop 1.4s ease-in-out infinite;
          z-index: 30;
        }

        .mapSparkle {
          position: absolute;
          inset: -24px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(255,255,255,.9), transparent 65%);
          animation: sparklePulse 1.4s infinite;
          z-index: -1;
        }

        .mapBoatIchika {
          position: absolute;
          left: 50%;
          top: -86px;
          width: 84px;
          height: 84px;
          object-fit: contain;
          transform: translateX(-50%);
          z-index: 25;
          animation: boatMove 1.8s ease-in-out infinite;
          filter: drop-shadow(0 8px 8px rgba(0,0,0,.35));
        }

        .mapWoodBoard {
          position: absolute;
          left: 50%;
          top: 64px;
          transform: translateX(-50%);
          min-width: 132px;
          padding: 9px 10px 10px;
          border-radius: 12px;
          background: linear-gradient(180deg, #8a5329, #5b3318);
          color: #fff7d6;
          border: 3px solid #ffd768;
          text-align: center;
          box-shadow: 0 8px 18px rgba(0,0,0,.36);
        }

        .mapWoodBoard span {
          display: inline-block;
          padding: 3px 8px;
          border-radius: 999px;
          background: rgba(255,255,255,.18);
          font-size: 9px;
          font-weight: 900;
        }

        .mapWoodBoard strong {
          display: block;
          margin-top: 4px;
          font-size: 14px;
          font-weight: 900;
        }

        .mapWoodBoard p {
          margin: 2px 0 0;
          font-size: 10px;
          font-weight: 900;
        }

        .mapLabel {
          position: absolute;
          left: 50%;
          transform: translateX(-50%);
          z-index: 8;
          padding: 8px 18px;
          border-radius: 999px;
          background: rgba(23,52,92,.92);
          color: #ffd768;
          border: 2px solid #ffd768;
          font-weight: 900;
          box-shadow: 0 8px 18px rgba(0,0,0,.28);
        }

        .mapStartLabel {
          bottom: 3.5%;
        }

        .mapGoalLabel {
          top: 4%;
        }

        .completeRibbon {
          position: absolute;
          top: 10%;
          left: 50%;
          transform: translateX(-50%);
          z-index: 40;
          padding: 14px 22px;
          border-radius: 999px;
          background: linear-gradient(135deg, #ffd768, #ff4f93);
          color: #fff;
          font-size: 22px;
          font-weight: 900;
          box-shadow: 0 10px 26px rgba(0,0,0,.35);
          animation: completePop 1.6s ease-in-out infinite;
        }

        @keyframes boatMove {
          0%, 100% {
            transform: translateX(-50%) translateY(0) rotate(-4deg);
          }
          50% {
            transform: translateX(-50%) translateY(-10px) rotate(4deg);
          }
        }

        @keyframes islandFloat {
          0%, 100% {
            scale: 1;
          }
          50% {
            scale: 1.045;
          }
        }

        @keyframes mapStagePulse {
          0%, 100% {
            box-shadow: 0 0 0 0 rgba(255,79,147,.65), 0 8px 18px rgba(0,0,0,.35);
          }
          50% {
            box-shadow: 0 0 0 14px rgba(255,79,147,0), 0 8px 18px rgba(0,0,0,.35);
          }
        }

        @keyframes fogMove {
          0%, 100% {
            opacity: .55;
            transform: scale(1);
          }
          50% {
            opacity: .85;
            transform: scale(1.12);
          }
        }

        @keyframes fireworkPop {
          0%, 100% {
            transform: translateX(-50%) scale(.9);
            opacity: .8;
          }
          50% {
            transform: translateX(-50%) scale(1.25);
            opacity: 1;
          }
        }

        @keyframes sparklePulse {
          0%, 100% {
            opacity: .35;
            transform: scale(.9);
          }
          50% {
            opacity: .8;
            transform: scale(1.2);
          }
        }

        @keyframes completePop {
          0%, 100% {
            transform: translateX(-50%) scale(1);
          }
          50% {
            transform: translateX(-50%) scale(1.08);
          }
        }
      `}</style>

      <header className="beginnerMapHeader">
        <a href="/bsc2">←</a>
        <div>
          <span>BSC AREA</span>
          <h1>初心者ロード</h1>
        </div>
        <b>🌸</b>
      </header>

      <section className="beginnerMapInfo">
        <span>🌸 ICHIKA BEGINNER ROAD</span>
        <strong>{isComplete ? "COMPLETE 👑" : `CLEAR率 ${clearRate}%`}</strong>
      </section>

      <section className="beginnerGameMap">
        <img
          src="/bsc/91BF36BB-4E29-45F4-A933-0F8803425BD1.png"
          alt="初心者ロード"
          className="beginnerGameMapBg"
        />

        {isComplete && <div className="completeRibbon">👑 COMPLETE</div>}

        <div className="mapLabel mapStartLabel">START</div>
        <div className="mapLabel mapGoalLabel">🏆 GOAL</div>

        {chapters.map((chapter, index) => {
          const isClear = cleared.includes(chapter.id);
          const isCurrent = index === currentIndex && !chapter.locked;
          const isLocked = chapter.locked;

          return (
            <a
              key={chapter.id}
              href={isLocked ? "#" : chapter.href}
              className={`mapStage ${isClear ? "clear" : ""} ${
                isCurrent ? "current" : ""
              } ${isLocked ? "locked" : ""}`}
              style={{
                top: chapter.top,
                left: chapter.left,
              }}
            >
              {isLocked && <div className="mapFog" />}
              {isClear && <div className="mapFireworks">🎆</div>}
              {isCurrent && <div className="mapSparkle" />}

              {isCurrent && (
                <img
                  src="/bsc/ichika-boat.png"
                  alt="一果"
                  className="mapBoatIchika"
                  onError={(e) => {
                    e.currentTarget.src = "/bsc/status-ichika.png";
                  }}
                />
              )}

              <div className="mapStageOrb">
                {isLocked ? "🔒" : isClear ? "✓" : index + 1}
              </div>

              {(isCurrent || isClear) && (
                <div className="mapWoodBoard">
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
