"use client";

import { useEffect, useState } from "react";

const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

export default function LoginBonus() {
  const [received, setReceived] = useState(false);
  const [streak, setStreak] = useState(1);

  useEffect(() => {
    const today = todayKey();
    const lastLogin = localStorage.getItem("bscLastLoginBonus");
    const savedStreak = Number(localStorage.getItem("bscLoginStreak") || 1);

    setReceived(lastLogin === today);
    setStreak(savedStreak);
  }, []);

  const receiveBonus = () => {
    if (received) return;

    const today = todayKey();
    const point = Number(localStorage.getItem("bscPoint") || 0);
    const bonus = 20 + Math.min(streak - 1, 4) * 10;

    localStorage.setItem("bscPoint", String(point + bonus));
    localStorage.setItem("bscLastLoginBonus", today);
    localStorage.setItem("bscLoginStreak", String(streak + 1));

    setReceived(true);
    alert(`ログインボーナス！ +${bonus}pt GET！`);
  };

  const bonusPoint = 20 + Math.min(streak - 1, 4) * 10;

  return (
    <section className="loginBonusBox">
      <div>
        <span>🎁 LOGIN BONUS</span>
        <h2>今日のログインボーナス</h2>
        <p>連続ログイン {streak}日目</p>
      </div>

      <button type="button" onClick={receiveBonus} disabled={received}>
        {received ? "受取済み" : `⭐ +${bonusPoint}pt 受け取る`}
      </button>
    </section>
  );
}
