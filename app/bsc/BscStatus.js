"use client";

import { useEffect, useState } from "react";

export default function BscStatus() {
  const [point, setPoint] = useState(0);
  const [badges, setBadges] = useState([]);
  const [missions, setMissions] = useState([]);

  useEffect(() => {
    setPoint(Number(localStorage.getItem("bscPoint") || 0));
    setBadges(JSON.parse(localStorage.getItem("bscBadge") || "[]"));
    setMissions(JSON.parse(localStorage.getItem("bscMission") || "[]"));
  }, []);

  const level = Math.floor(point / 100) + 1;
  const progress = point % 100;

  let rank = "🌱 見習い";
  if (level >= 3) rank = "📖 研究員";
  if (level >= 5) rank = "🚤 アナリスト";
  if (level >= 10) rank = "🏆 マスター";
  if (level >= 20) rank = "👑 レジェンド";

  return (
    <section className="bscStatus">
      <h2>🎮 BSC STATUS</h2>

      <strong>LEVEL {level}</strong>
      <h3>{rank}</h3>

      <div className="bscStatusBar">
        <span style={{ width: `${progress}%` }} />
      </div>

      <p>⭐ {point} pt</p>
      <p>🏅 バッジ {badges.length}個</p>
      <p>📚 Mission {missions.length}個クリア</p>
    </section>
  );
}
