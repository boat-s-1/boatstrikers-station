"use client";

import { useEffect, useState } from "react";

const chapters = [
  {
    id: "chapter1-lesson1",
    title: "Chapter 1",
    subtitle: "競艇入門編",
    href: "/bsc2/play/chapter1",
    top: "80%",
    left: "50%",
  },
  {
    id: "chapter2-start-tenji",
    title: "Chapter 2",
    subtitle: "スタート展示",
    href: "/bsc2/play/chapter2",
    top: "66%",
    left: "50%",
  },
  {
    id: "chapter3-tenji-time",
    title: "Chapter 3",
    subtitle: "展示タイム",
    href: "/bsc2/play/chapter3",
    top: "52%",
    left: "50%",
    locked: true,
  },
  {
    id: "chapter4-ichigoutei",
    title: "Chapter 4",
    subtitle: "1号艇の基本",
    href: "/bsc2/play/chapter4",
    top: "38%",
    left: "50%",
    locked: true,
  },
  {
    id: "chapter5-kaime",
    title: "Chapter 5",
    subtitle: "買い目作成",
    href: "/bsc2/play/chapter5",
    top: "24%",
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
                {isLocked ? "🔒" : isClear ? "✓" : index + 1}
              </div>

              <div className="mapStageCard">
                <span>{isLocked ? "LOCK" : isClear ? "CLEAR" : "NOW"}</span>
                <strong>{chapter.title}</strong>
                <p>{chapter.subtitle}</p>
              </div>
            </a>
          );
        })}
      </section>
    </main>
  );
}
