"use client";

import { useEffect, useState } from "react";
import BscStatus from "./components/BscStatus";
import DailyVote from "./components/DailyVote";
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
    <main className="gamePage">
      <header className="gameTopBar">
        <a href="/" className="gameBack">←</a>
        <div>
          <span>BSC</span>
          <h1>GAME MENU</h1>
        </div>
        <div className="gameStatusMini">START</div>
      </header>

      <section className="bscMenuHero">
        <span>🎮 BSC</span>
        <h1>BOAT STRIKERS CHALLENGE</h1>
        <p>一果・初音・キイナと競艇を楽しく学ぼう！</p>
      </section>

      <BscStatus />
    　<DailyVote />
　　　　<DailyVote/>
      <section className="bscMenuList">
        {continueData && (
          <a href={continueData.url} className="bscMenuButton continue">
            <span>▶ 続きから</span>
            <strong>{continueData.chapter}</strong>
            <p>{continueData.title}</p>
          </a>
        )}

        <a href="/bsc2/play/chapter1" className="bscMenuButton main">
          <span>{chapter1Cleared ? "▶ 復習する" : "▶ START"}</span>
          <strong>Chapter 1：競艇入門編</strong>
          <p>{chapter1Cleared ? "CLEAR済み" : "まずはここから！"}</p>
        </a>

        <a href="/bsc2/play/chapter2" className="bscMenuButton main">
          <span>{chapter2Cleared ? "▶ 復習する" : "▶ START"}</span>
          <strong>Chapter 2：スタート展示って何？</strong>
          <p>{chapter2Cleared ? "CLEAR済み" : "スタート展示を学ぼう！"}</p>
        </a>

        <a href="/bsc2/collection" className="bscMenuButton">
          <span>🏅 COLLECTION</span>
          <strong>バッジコレクション</strong>
          <p>集めた認定バッジを見る</p>
        </a>

        <a href="/library" className="bscMenuButton">
          <span>📚 LIBRARY</span>
          <strong>一果図書館へ</strong>
          <p>攻略本・新聞を読む</p>
        </a>

        <a href="/" className="bscMenuButton">
          <span>🏠 HOME</span>
          <strong>トップへ戻る</strong>
          <p>BOAT STRIKERSトップ</p>
        </a>
      </section>
    </main>
  );
}
