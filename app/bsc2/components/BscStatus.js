"use client";

import { useEffect, useState } from "react";

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
  const expPercent = Math.min(exp, 100);
  const bondPercent = Math.min(bond, 100);

  return (
    <section className="bscStatusPro">
      <div className="bscStatusTop">
        <div className="bscAvatar">
          <img src="/bsc/status-ichika.png" alt="一果" />
        </div>

        <div className="bscStatusMain">
          <span>BSC STATUS</span>
          <h2>LEVEL {level}</h2>
          <p>🌱 見習いクルー</p>
        </div>
      </div>

      <div className="bscExpBox">
        <div className="bscExpText">
          <span>EXP</span>
          <b>{exp}/100</b>
        </div>
        <div className="bscExpBar">
          <i style={{ width: `${expPercent}%` }} />
        </div>
      </div>

      <div className="bscStatusGrid">
        <div>
          <span>⭐</span>
          <strong>{point}pt</strong>
          <p>ポイント</p>
        </div>

        <div>
          <span>🏅</span>
          <strong>{badges.length}個</strong>
          <p>バッジ</p>
        </div>

        <div>
          <span>🎮</span>
          <strong>{cleared.length}CLEAR</strong>
          <p>クリア数</p>
        </div>
      </div>

      <div className="bscBondBox">
        <div className="bscBondTitle">
          <span>🌸 一果との親密度</span>
          <b>{bondPercent}%</b>
        </div>

        <div className="bscBondBar">
          <i style={{ width: `${bondPercent}%` }} />
        </div>
      </div>
    </section>
  );
}
