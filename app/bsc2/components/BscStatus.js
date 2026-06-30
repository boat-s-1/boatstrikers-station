"use client";

import { useEffect, useState } from "react";

export default function BscStatus() {
  const [point, setPoint] = useState(0);
  const [badges, setBadges] = useState([]);
  const [cleared, setCleared] = useState([]);
  const [ichikaBond, setIchikaBond] = useState(0);

  useEffect(() => {
    setPoint(Number(localStorage.getItem("bscPoint") || 0));
    setBadges(JSON.parse(localStorage.getItem("bscBadge") || "[]"));
    setCleared(JSON.parse(localStorage.getItem("bscCleared") || "[]"));
    setIchikaBond(Number(localStorage.getItem("bscBond_ichika") || 0));
  }, []);

  const level = Math.floor(point / 100) + 1;
  const progress = point % 100;

  let rank = "🌱 見習い";
  if (level >= 3) rank = "📖 研究員";
  if (level >= 5) rank = "🚤 アナリスト";
  if (level >= 10) rank = "🏆 マスター";
  if (level >= 20) rank = "👑 レジェンド";

  return (
    <section className="bscGameStatus">
      <div>
        <span>BSC STATUS</span>
        <h2>LEVEL {level}</h2>
        <p>{rank}</p>
      </div>

      <div className="bscGameStatusBar">
        <span style={{ width: `${progress}%` }} />
      </div>

<div className="bscBondBox">
  <span>🌸 一果との親密度</span>
  <strong>{ichikaBond}%</strong>
  <div className="bscBondBar">
    <i style={{ width: `${ichikaBond}%` }} />
  </div>
</div>
  
      <div className="bscGameStatusGrid">
        <b>⭐ {point}pt</b>
        <b>🏅 {badges.length}個</b>
        <b>🎮 {cleared.length}CLEAR</b>
      </div>
    </section>
  );
}
