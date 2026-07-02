"use client";

import { useEffect, useState } from "react";

const chapters = [
  {
    id: "chapter1-lesson1",
    title: "Chapter 1",
    subtitle: "競艇入門編",
    href: "/bsc2/play/chapter1",

    // 一番下の島
    top: "78%",
    left: "43%",
  },
  {
    id: "chapter2-start-tenji",
    title: "Chapter 2",
    subtitle: "スタート展示",
    href: "/bsc2/play/chapter2",

    // 2つ目の島
    top: "57%",
    left: "51%",
  },
  {
    id: "chapter3-tenji-time",
    title: "Chapter 3",
    subtitle: "展示タイム",
    href: "/bsc2/play/chapter3",

    // 真ん中
    top: "55%",
    left: "49%",
    locked: true,
  },
  {
    id: "chapter4-ichigoutei",
    title: "Chapter 4",
    subtitle: "1号艇の基本",
    href: "/bsc2/play/chapter4",

    // 上から2番目
    top: "46%",
    left: "51%",
    locked: true,
  },
  {
    id: "chapter5-kaime",
    title: "Chapter 5",
    subtitle: "買い目作成",
    href: "/bsc2/play/chapter5",

    // 一番上
    top: "27%",
    left: "50%",
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
          display: block;
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

        .beginnerMapHeader b {
          text-align: center;
          font-size: 24px;
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
        }

        .mapStageOrb {
          width: 48px;
          height: 48px;
          margin: 0 auto 5px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          background: linear-gradient(135deg, #ff4f93, #f6a800);
          color: #fff;
          border: 4px solid #fff;
          font-size: 18px;
          font-weight: 900;
          box-shadow: 0 0 18px rgba(255,255,255,.9), 0 8px 18px rgba(0,0,0,.35);
        }

        .mapStageCard {
          min-width: 104px;
          padding: 7px 8px;
          border-radius: 15px;
          background: rgba(255,255,255,.95);
          color: #17345c;
          border: 3px solid #ffd768;
          text-align: center;
          box-shadow: 0 8px 18px rgba(0,0,0,.3);
        }

        .mapStageCard span {
          display: inline-block;
          padding: 3px 8px;
          border-radius: 999px;
          background: #ff4f93;
          color: #fff;
          font-size: 9px;
          font-weight: 900;
        }

        .mapStageCard strong {
          display: block;
          margin-top: 4px;
          font-size: 12px;
          font-weight: 900;
        }

        .mapStageCard p {
          margin: 2px 0 0;
          font-size: 9px;
          font-weight: 900;
        }

        .mapStage.clear .mapStageOrb {
          background: #06c755;
        }

        .mapStage.clear .mapStageCard {
          border-color: #06c755;
        }

        .mapStage.clear .mapStageCard span {
          background: #06c755;
        }

        .mapStage.current .mapStageOrb {
          animation: mapStagePulse 1.4s infinite;
        }

        .mapStage.locked {
          opacity: .52;
          filter: grayscale(1);
          pointer-events: none;
        }

        .mapCurrentCharacter {
          position: absolute;
          left: 50%;
          top: -56px;
          width: 52px;
          height: 52px;
          object-fit: cover;
          transform: translateX(-50%);
          border-radius: 50%;
          border: 3px solid #ff4f93;
          background: #fff;
          z-index: 20;
          animation: mapCharacterBounce 1.2s ease-in-out infinite;
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

        @keyframes mapCharacterBounce {
          0%, 100% {
            transform: translateX(-50%) translateY(0);
          }
          50% {
            transform: translateX(-50%) translateY(-8px);
          }
        }

        @keyframes mapStagePulse {
          0%, 100% {
            box-shadow: 0 0 0 0 rgba(255,79,147,.65), 0 8px 18px rgba(0,0,0,.35);
          }
          50% {
            box-shadow: 0 0 0 12px rgba(255,79,147,0), 0 8px 18px rgba(0,0,0,.35);
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
        <strong>CLEAR率 {clearRate}%</strong>
      </section>

      <section className="beginnerGameMap">
        <img
          src="/bsc/91BF36BB-4E29-45F4-A933-0F8803425BD1.png"
          alt="初心者ロード"
          className="beginnerGameMapBg"
        />

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
              {isCurrent && (
                <img
                  src="/bsc/status-ichika.png"
                  alt="一果"
                  className="mapCurrentCharacter"
                />
              )}

              <div className="mapStageOrb">
  {isLocked ? "🔒" : isClear ? "✓" : isCurrent ? index + 1 : index + 1}
</div>

              {isCurrent && (
  <div className="mapStageCard">
    <span>NOW</span>
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
