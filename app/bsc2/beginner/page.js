"use client";

import { useEffect, useState } from "react";

const chapters = [
  {
    title: "Chapter 1",
    subtitle: "競艇入門編",
    href: "/bsc2/play/chapter1",
    id: "chapter1-lesson1",
    icon: "🚤",
  },
  {
    title: "Chapter 2",
    subtitle: "スタート展示って何？",
    href: "/bsc2/play/chapter2",
    id: "chapter2-start-tenji",
    icon: "🏁",
  },
  {
    title: "Chapter 3",
    subtitle: "展示タイム入門",
    href: "/bsc2/play/chapter3",
    id: "chapter3-tenji-time",
    icon: "⏱",
    locked: true,
  },
  {
    title: "Chapter 4",
    subtitle: "1号艇の基本",
    href: "/bsc2/play/chapter4",
    id: "chapter4-ichigoutei",
    icon: "1️⃣",
    locked: true,
  },
  {
    title: "Chapter 5",
    subtitle: "買い目の作り方",
    href: "/bsc2/play/chapter5",
    id: "chapter5-kaime",
    icon: "🎯",
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
    <main className="bscAreaPage beginnerArea">
      <header className="areaTopBar">
        <a href="/bsc2" className="gameHomeBack">←</a>
        <div>
          <span>BSC AREA</span>
          <h1>初心者エリア</h1>
        </div>
        <b>🌸</b>
      </header>

      <section className="areaHero">
        <div className="areaHeroText">
          <span>🌸 BEGINNER ROAD 🌸</span>
          <h2>初心者ロード</h2>
          <p>
            一果
            <br />
            「まずはここから勉強しよう！」
          </p>
        </div>

        <img src="/bsc/status-ichika.png" alt="一果" />
      </section>

      <section className="areaProgress">
        <div>
          <span>CLEAR率</span>
          <strong>{clearRate}%</strong>
        </div>

        <div className="areaStars">
          {chapters.map((c) => (
            <span key={c.id}>{cleared.includes(c.id) ? "★" : "☆"}</span>
          ))}
        </div>
      </section>

      <section className="bscRoadMap">
        <div className="roadStart">START</div>

        {chapters.map((chapter, index) => {
          const isClear = cleared.includes(chapter.id);
          const isCurrent = index === currentIndex && !chapter.locked;
          const isLocked = chapter.locked;

          return (
            <div
              key={chapter.id}
              className={`roadStep ${isClear ? "clear" : ""} ${
                isCurrent ? "current" : ""
              } ${isLocked ? "locked" : ""}`}
            >
              {isCurrent && (
                <img
                  src="/bsc/status-ichika.png"
                  alt="一果"
                  className="roadCharacter"
                />
              )}

              <a href={isLocked ? "#" : chapter.href}>
                <div className="roadCircle">
                  {isLocked ? "🔒" : isClear ? "✓" : chapter.icon}
                </div>

                <div className="roadCard">
                  <span>
                    {isClear ? "CLEAR" : isLocked ? "LOCKED" : "CHALLENGE"}
                  </span>
                  <strong>{chapter.title}</strong>
                  <p>{chapter.subtitle}</p>
                </div>
              </a>
            </div>
          );
        })}

        <div className="roadGoal">🏆 初級卒業</div>
      </section>
    </main>
  );
}
