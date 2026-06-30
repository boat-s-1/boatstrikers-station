"use client";

import { useEffect, useState } from "react";

function getRank(level) {
  if (level >= 20) return "👑 BOAT STRIKERS LEGEND";
  if (level >= 15) return "🏆 一流ストライカー";
  if (level >= 10) return "⚡ BOAT STRIKERS";
  if (level >= 7) return "🎯 的中ハンター";
  if (level >= 5) return "📖 データ分析員";
  if (level >= 3) return "🚤 新人レーサー";
  if (level >= 2) return "🌸 一果の教え子";
  return "🌱 見習いクルー";
}

export default function BscStatus() {
  const [point, setPoint] = useState(0);
  const [badges, setBadges] = useState([]);
  const [cleared, setCleared] = useState([]);
  const [ichikaBond, setIchikaBond] = useState(0);
  const [levelUp, setLevelUp] = useState(null);

  useEffect(() => {
    const currentPoint = Number(localStorage.getItem("bscPoint") || 0);
    const currentLevel = Math.floor(currentPoint / 100) + 1;

    const oldLevel = Number(localStorage.getItem("bscLastLevel") || currentLevel);

    if (currentLevel > oldLevel) {
      setLevelUp({
        level: currentLevel,
        rank: getRank(currentLevel),
      });

      setTimeout(() => {
        setLevelUp(null);
      }, 1800);
    }

    localStorage.setItem("bscLastLevel", String(currentLevel));

    setPoint(currentPoint);
    setBadges(JSON.parse(localStorage.getItem("bscBadge") || "[]"));
    setCleared(JSON.parse(localStorage.getItem("bscCleared") || "[]"));
    setIchikaBond(Number(localStorage.getItem("bscBond_ichika") || 0));
  }, []);

  const level = Math.floor(point / 100) + 1;
  const progress = point % 100;
  const rank = getRank(level);

  return (
    <>
      {levelUp && (
        <div className="bscLevelUpEffect">
          <span>✨ LEVEL UP!! ✨</span>
          <strong>Lv.{levelUp.level}</strong>
          <p>{levelUp.rank}</p>
        </div>
      )}

      <section className="bscGameStatus">
        <div>
          <span>BSC STATUS</span>
          <h2>LEVEL {level}</h2>
          <p>{rank}</p>
        </div>

        <div className="bscGameStatusBar">
          <span style={{ width: `${progress}%` }} />
        </div>

        <div className="bscGameStatusGrid">
          <b>⭐ {point}pt</b>
          <b>🏅 {badges.length}個</b>
          <b>🎮 {cleared.length}CLEAR</b>
        </div>

        <div className="bscBondBox">
          <span>🌸 一果との親密度</span>
          <strong>{ichikaBond}%</strong>
          <div className="bscBondBar">
            <i style={{ width: `${ichikaBond}%` }} />
          </div>
        </div>
      </section>
    </>
  );
}
