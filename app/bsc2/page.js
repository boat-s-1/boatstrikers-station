"use client";

import { useEffect, useState } from "react";
import BscStatus from "./components/BscStatus";
import DailyVote from "./components/DailyVote";
import HomeCharacter from "./components/HomeCharacter";
import LoginBonus from "./components/LoginBonus";
import DailyMission from "./components/DailyMission";

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
　　　　<HomeCharacter />
<LoginBonus />
<DailyMission />
      <BscStatus />

      <DailyVote />

    <section className="bscCourseGrid">
  <a href="/bsc2/beginner" className="bscCourseCard">
    <img src="/B7049A8B-ED96-47BF-809F-382BB00416B0.png" alt="初心者編" />
    <div>
      <span>BEGINNER</span>
      <strong>初心者編</strong>
      <p>ボートレースの基礎を学ぼう</p>
    </div>
  </a>

  <a href="/bsc2/intermediate" className="bscCourseCard">
    <img src="/9A044E83-9FB1-401C-85FC-7C625977C6F3.png" alt="中級者編" />
    <div>
      <span>INTERMEDIATE</span>
      <strong>中級者編</strong>
      <p>展示・データ分析を学ぼう</p>
    </div>
  </a>

  <a href="/bsc2/advanced" className="bscCourseCard">
    <img src="/137BBD12-85F7-4496-A454-F7884D21BF41.png" alt="上級者編" />
    <div>
      <span>ADVANCED</span>
      <strong>上級者編</strong>
      <p>勝率・回収率を高めよう</p>
    </div>
  </a>

  <a href="/bsc2/practice" className="bscCourseCard">
    <img src="/9790A9E5-DBE8-4B73-9278-5690A49F93B5.png" alt="実践編" />
    <div>
      <span>PRACTICE</span>
      <strong>実践編</strong>
      <p>3人と実戦形式で挑戦</p>
    </div>
  </a>
</section>

        <section className="bscImageLinkGrid">
  <a href="/library" className="bscImageLinkCard">
    <img src="/bsc/A7311B2A-295A-4829-85BD-732FC3795C59.png" alt="一果図書館" />
    <div className="bscImageLinkOverlay">
  
    </div>
  </a>

  <a href="/bsc2/collection" className="bscImageLinkCard">
    <img src="/bsc/6A5C107D-6E92-4FCF-9F4A-C6D070855CC5.png" alt="バッジコレクション" />
    <div className="bscImageLinkOverlay">
    
    </div>
  </a>
</section>
      
    </main>
  );
}
