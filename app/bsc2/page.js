"use client";

import { useEffect, useState } from "react";
import BscStatus from "./components/BscStatus";
import DailyVote from "./components/DailyVote";

export default function BSC2MenuPage() {
  const [cleared, setCleared] = useState([]);
  const [continueData, setContinueData] = useState(null);

  useEffect(() => {
    setCleared(JSON.parse(localStorage.getItem("bscCleared") || "[]"));
    setContinueData(JSON.parse(localStorage.getItem("bscContinue") || "null"));
  }, []);

  const chapter1Cleared = cleared.includes("chapter1-lesson1");
  const chapter2Cleared = cleared.includes("chapter2-start-tenji");

  return (
    <main className="gameHome">
      <header className="gameHomeTop">
        <a href="/" className="gameHomeBack">←</a>
        <div>
          <span>BSC</span>
          <h1>BOAT STRIKERS</h1>
        </div>
        <b>MENU</b>
      </header>

      <section className="gameHomeHero">
        <img src="/bsc/7F8A183E-9648-4BB8-BA99-273EB637EC39.png" alt="BSC" className="gameHomeTitleImage" />

        <div className="gameHomeCatch">
          <span>🎮 DAILY CHALLENGE</span>
          <p>一果たちと競艇を楽しく学ぼう！</p>
        </div>
      </section>

      <BscStatus />

      <DailyVote />

      <section className="gameHomeMenu">
        {continueData && (
          <a href={continueData.url} className="gameStageCard continue">
            <span>▶ CONTINUE</span>
            <strong>{continueData.chapter}</strong>
            <p>{continueData.title}</p>
          </a>
        )}

        <a href="/bsc2/play/chapter1" className="gameStageCard story">
          <span>{chapter1Cleared ? "CLEAR" : "STORY"}</span>
          <strong>Chapter 1：競艇入門編</strong>
          <p>{chapter1Cleared ? "復習する" : "まずはここから！"}</p>
        </a>

        <a href="/bsc2/play/chapter2" className="gameStageCard story">
          <span>{chapter2Cleared ? "CLEAR" : "NEW"}</span>
          <strong>Chapter 2：スタート展示って何？</strong>
          <p>{chapter2Cleared ? "復習する" : "展示の基本を学ぼう！"}</p>
        </a>

        <a href="/bsc2/collection" className="gameStageCard collection">
          <span>COLLECTION</span>
          <strong>🏅 バッジコレクション</strong>
          <p>集めた認定バッジを見る</p>
        </a>

        <a href="/library" className="gameStageCard library">
          <span>LIBRARY</span>
          <strong>📚 一果図書館</strong>
          <p>攻略本・新聞で復習する</p>
        </a>
      </section>
    </main>
  );
}
