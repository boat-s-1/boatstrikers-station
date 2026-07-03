"use client";

import BscStatus from "./components/BscStatus";
import HomeCharacter from "./components/HomeCharacter";
import LoginBonus from "./components/LoginBonus";
import DailyMission from "./components/DailyMission";
import DailyVote from "./components/DailyVote";

export default function BSC2HomePage() {
  return (
    <main className="bscPage">
      <header className="bscHeader">
        <div>
          <span>BSC Version3</span>
          <h1>BOAT STRIKERS</h1>
        </div>
        <a href="/" className="bscBtn bscBtnGold">HOME</a>
      </header>

      <HomeCharacter />

      <BscStatus />

      <LoginBonus />

      <DailyMission />

      <section className="bscSection">
        <div className="bscSectionTitle">
          <h3>🌍 BSC WORLD</h3>
        </div>

        <div className="bscGrid bscGrid2">
          <a href="/bsc2/beginner" className="bscCard">
            <span className="bscBadge">BEGINNER</span>
            <h2 className="bscTitle">🌸 初級島</h2>
            <p className="bscSub">一果と基礎を学ぼう</p>
          </a>

          <a href="/bsc2/intermediate" className="bscCard">
            <span className="bscBadge">INTERMEDIATE</span>
            <h2 className="bscTitle">⚡ 中級島</h2>
            <p className="bscSub">キイナと展示を攻略</p>
          </a>

          <a href="/bsc2/advanced" className="bscCard">
            <span className="bscBadge">ADVANCED</span>
            <h2 className="bscTitle">💜 上級島</h2>
            <p className="bscSub">初音と回収率を学ぶ</p>
          </a>

          <a href="/bsc2/practice" className="bscCard">
            <span className="bscBadge">ENDLESS</span>
            <h2 className="bscTitle">🏝 実践本部</h2>
            <p className="bscSub">3人と毎日チャレンジ</p>
          </a>
        </div>
      </section>

      <DailyVote />

      <section className="bscSection">
        <div className="bscSectionTitle">
          <h3>📚 LIBRARY / COLLECTION</h3>
        </div>

        <div className="bscGrid bscGrid2">
          <a href="/library" className="bscCard">
            <h2 className="bscTitle">📚 一果図書館</h2>
            <p className="bscSub">攻略本・新聞を読む</p>
          </a>

          <a href="/bsc2/collection" className="bscCard">
            <h2 className="bscTitle">🏅 バッジコレクション</h2>
            <p className="bscSub">集めた認定バッジを見る</p>
          </a>
        </div>
      </section>
    </main>
  );
}
