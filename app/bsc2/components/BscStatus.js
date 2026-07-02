"use client";

import { useEffect, useState } from "react";

function getRank(level) {
  if (level >= 20) return "👑 レジェンド";
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
  const [bond, setBond] = useState(0);

  useEffect(() => {
    setPoint(Number(localStorage.getItem("bscPoint") || 0));
    setBadges(JSON.parse(localStorage.getItem("bscBadge") || "[]"));
    setCleared(JSON.parse(localStorage.getItem("bscCleared") || "[]"));
    setBond(Number(localStorage.getItem("bscBond_ichika") || 0));
  }, []);

  const level = Math.floor(point / 100) + 1;
  const exp = point % 100;
  const bondPercent = Math.min(bond, 100);
  const rank = getRank(level);

  return (
    <section className="bscStatusCompact">
      <div className="bscStatusCompactTop">
        <img src="/bsc/status-ichika.png" alt="一果" />

        <div className="bscStatusCompactInfo">
          <span>BSC STATUS</span>
          <h2>LEVEL {level}</h2>
          <p>{rank}</p>
        </div>

        <div className="bscStatusCompactBadge">LvUP</div>
      </div>

      <div className="bscStatusCompactExp">
        <div>
          <span>EXP</span>
          <b>{exp}/100</b>
        </div>
        <div className="bscStatusCompactBar">
          <i style={{ width: `${exp}%` }} />
        </div>
      </div>

      <div className="bscStatusCompactGrid">
        <div>
          <b>⭐ {point}</b>
          <span>POINT</span>
        </div>

        <div>
          <b>🏅 {badges.length}</b>
          <span>BADGE</span>
        </div>

        <div>
          <b>🎮 {cleared.length}</b>
          <span>CLEAR</span>
        </div>

        <div>
          <b>🌸 {bondPercent}%</b>
          <span>LOVE</span>
        </div>
      </div>
    </section>
  );
}
