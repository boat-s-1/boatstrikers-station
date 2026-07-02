"use client";

import { useEffect, useState } from "react";

const chapters = [
  {
    title: "Chapter 1：競艇入門編",
    href: "/bsc2/play/chapter1",
    id: "chapter1-lesson1",
    desc: "まずは6艇・水面・基本ルールから",
  },
  {
    title: "Chapter 2：スタート展示って何？",
    href: "/bsc2/play/chapter2",
    id: "chapter2-start-tenji",
    desc: "進入とスタート展示の見方を学ぼう",
  },
  {
    title: "Chapter 3：展示タイム入門",
    href: "/bsc2/play/chapter3",
    id: "chapter3-tenji-time",
    desc: "展示タイムの基本を覚えよう",
    locked: true,
  },
  {
    title: "Chapter 4：1号艇の基本",
    href: "/bsc2/play/chapter4",
    id: "chapter4-ichigoutei",
    desc: "イン逃げの考え方を学ぼう",
    locked: true,
  },
  {
    title: "Chapter 5：買い目の作り方",
    href: "/bsc2/play/chapter5",
    id: "chapter5-kaime",
    desc: "初心者向けの買い目作成",
    locked: true,
  },
];

export default function BeginnerPage() {
  const [cleared, setCleared] = useState([]);

  useEffect(() => {
    setCleared(JSON.parse(localStorage.getItem("bscCleared") || "[]"));
  }, []);

  const clearCount = chapters.filter((c) => cleared.includes(c.id)).length;
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
          <span>🌸🌸🌸 BEGINNER 🌸🌸🌸</span>
          <h2>初心者エリア</h2>
          <p>
            一果「まずはここから勉強しよう！」
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

      <section className="areaChapterList">
        {chapters.map((chapter, index) => {
          const isClear = cleared.includes(chapter.id);

          return (
            <a
              key={chapter.id}
              href={chapter.locked ? "#" : chapter.href}
              className={`areaChapterCard ${isClear ? "clear" : ""} ${
                chapter.locked ? "locked" : ""
              }`}
            >
              <div className="chapterNumber">
                {chapter.locked ? "🔒" : String(index + 1).padStart(2, "0")}
              </div>

              <div>
                <span>
                  {isClear ? "CLEAR" : chapter.locked ? "COMING SOON" : "START"}
                </span>
                <strong>{chapter.title}</strong>
                <p>{chapter.desc}</p>
              </div>
            </a>
          );
        })}
      </section>
    </main>
  );
}
