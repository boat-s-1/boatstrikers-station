"use client";

import { useEffect, useState } from "react";

const allBadges = [
  "競艇入門",
  "6艇理解",
  "コース理解",
  "イン逃げ初級",
  "展示入門",
  "住之江認定",
  "女子戦入門",
  "穴党入門",
  "24場制覇",
];

export default function BscCollectionPage() {
  const [badges, setBadges] = useState([]);

  useEffect(() => {
    setBadges(JSON.parse(localStorage.getItem("bscBadge") || "[]"));
  }, []);

  return (
    <main className="gamePage">
      <header className="gameTopBar">
        <a href="/bsc2" className="gameBack">←</a>
        <div>
          <span>BSC</span>
          <h1>バッジコレクション</h1>
        </div>
        <div className="gameStatusMini">{badges.length}</div>
      </header>

      <section className="bscCollectionHero">
        <h2>🏅 BADGE COLLECTION</h2>
        <p>集めた認定バッジを確認できます。</p>
      </section>

      <section className="bscBadgeGrid">
        {allBadges.map((badge) => {
          const got = badges.includes(badge);

          return (
            <div
              key={badge}
              className={`bscBadgeCard ${got ? "got" : "locked"}`}
            >
              <span>{got ? "🏅" : "🔒"}</span>
              <strong>{badge}</strong>
              <p>{got ? "GET!" : "未取得"}</p>
            </div>
          );
        })}
      </section>
    </main>
  );
}
