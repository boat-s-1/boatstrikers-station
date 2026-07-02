"use client";

import { useEffect, useState } from "react";

const chapters = [
  {
    title: "Chapter 1：スタート展示の基本",
    href: "/bsc2/intermediate/chapter1",
    id: "intermediate-1",
    desc: "展示で何を見るかを覚えよう",
  },
  {
    title: "Chapter 2：展示タイム",
    href: "/bsc2/intermediate/chapter2",
    id: "intermediate-2",
    desc: "展示タイムの見方",
    locked: true,
  },
  {
    title: "Chapter 3：モーター評価",
    href: "/bsc2/intermediate/chapter3",
    id: "intermediate-3",
    desc: "モーター勝率を学ぼう",
    locked: true,
  },
  {
    title: "Chapter 4：ST分析",
    href: "/bsc2/intermediate/chapter4",
    id: "intermediate-4",
    desc: "スタート力を見る",
    locked: true,
  },
  {
    title: "Chapter 5：展示総合判断",
    href: "/bsc2/intermediate/chapter5",
    id: "intermediate-5",
    desc: "展示から買い目を考える",
    locked: true,
  },
];

export default function IntermediatePage() {
  const [cleared, setCleared] = useState([]);

  useEffect(() => {
    setCleared(JSON.parse(localStorage.getItem("bscCleared") || "[]"));
  }, []);

  const clearCount = chapters.filter(c => cleared.includes(c.id)).length;
  const clearRate = Math.round((clearCount / chapters.length) * 100);

  return (
    <main className="bscAreaPage intermediateArea">

      <header className="areaTopBar">
        <a href="/bsc2" className="gameHomeBack">←</a>

        <div>
          <span>BSC AREA</span>
          <h1>中級者エリア</h1>
        </div>

        <b>⚡</b>
      </header>

      <section className="areaHero areaHeroBlue">

        <div className="areaHeroText">

          <span>⚡⚡⚡ INTERMEDIATE ⚡⚡⚡</span>

          <h2>中級者エリア</h2>

          <p>
            キイナ
            <br />
            「展示から勝負できるようになろう！」
          </p>

        </div>

        <img
          src="/bsc/status-kiina.png"
          alt="キイナ"
        />

      </section>

      <section className="areaProgress">

        <div>

          <span>CLEAR率</span>

          <strong>{clearRate}%</strong>

        </div>

        <div className="areaStars">
          {chapters.map(c=>(
            <span key={c.id}>
              {cleared.includes(c.id) ? "★":"☆"}
            </span>
          ))}
        </div>

      </section>

      <section className="areaChapterList">

        {chapters.map((chapter,index)=>{

          const clear=cleared.includes(chapter.id);

          return(

            <a
              key={chapter.id}
              href={chapter.locked ? "#" : chapter.href}
              className={`areaChapterCard ${
                clear ? "clear":""
              } ${chapter.locked ? "locked":""}`}
            >

              <div className="chapterNumber">

                {chapter.locked ? "🔒" : String(index+1).padStart(2,"0")}

              </div>

              <div>

                <span>

                  {clear
                    ? "CLEAR"
                    : chapter.locked
                    ? "COMING SOON"
                    : "START"}

                </span>

                <strong>{chapter.title}</strong>

                <p>{chapter.desc}</p>

              </div>

            </a>

          )

        })}

      </section>

    </main>
  );
}
