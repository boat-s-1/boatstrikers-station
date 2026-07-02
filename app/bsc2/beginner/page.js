"use client";

import { useEffect, useState } from "react";

const chapters = [
  {
    id: "chapter1-lesson1",
    title: "Chapter 1",
    subtitle: "競艇入門編",
    href: "/bsc2/play/chapter1",
    top: "78%",
    left: "50%",
  },
  {
    id: "chapter2-start-tenji",
    title: "Chapter 2",
    subtitle: "スタート展示",
    href: "/bsc2/play/chapter2",
    top: "63%",
    left: "48%",
  },
  {
    id: "chapter3-tenji-time",
    title: "Chapter 3",
    subtitle: "展示タイム",
    href: "/bsc2/play/chapter3",
    top: "50%",
    left: "49%",
    locked: true,
  },
  {
    id: "chapter4-ichigoutei",
    title: "Chapter 4",
    subtitle: "1号艇の基本",
    href: "/bsc2/play/chapter4",
    top: "36%",
    left: "52%",
    locked: true,
  },
  {
    id: "chapter5-kaime",
    title: "Chapter 5",
    subtitle: "買い目作成",
    href: "/bsc2/play/chapter5",
    top: "22%",
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

  return (
    <main className="beginnerMapPage">
      <header className="areaTopBar mapTopBar">
        <a href="/bsc2" className="gameHomeBack">←</a>
        <div>
          <span>BSC AREA</span>
          <h1>初心者ロード</h1>
        </div>
        <b>🌸</b>
      </header>

      <section className="beginnerMapWrap">
        <img
          src="/bsc/91BF36BB-4E29-45F4-A933-0F8803425BD1.png"
          alt="初心者ロード"
          className="beginnerMapBg"
        />

        <div className="mapStart">START</div>

        {chapters.map((chapter, index) => {
          const isClear = cleared.includes(chapter.id);
          const isCurrent = index === currentIndex && !chapter.locked;

          return (
            <a
              key={chapter.id}
              href={chapter.locked ? "#" : chapter.href}
              className={`mapChapterPoint ${isClear ? "clear" : ""} ${
                isCurrent ? "current" : ""
              } ${chapter.locked ? "locked" : ""}`}
              style={{
                top: chapter.top,
                left: chapter.left,
              }}
            >
              {isCurrent && (
                <img
                  src="/bsc/.png"
                  alt="一果"
                  className="mapIchika"
                />
              )}

              <div className="mapChapterBadge">
                <span>{chapter.locked ? "🔒" : isClear ? "CLEAR" : "NEW"}</span>
                <strong>{chapter.title}</strong>
                <p>{chapter.subtitle}</p>
              </div>
            </a>
          );
        })}

        <div className="mapGoal">🏆 GOAL</div>
      </section>
    </main>
  );
}
