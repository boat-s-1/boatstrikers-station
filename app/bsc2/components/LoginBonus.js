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

  const bonusPoint = 20 + Math.min(streak - 1, 4) * 10;

  const receiveBonus = () => {
    if (received) return;

    const today = todayKey();
    const point = Number(localStorage.getItem("bscPoint") || 0);

    localStorage.setItem("bscPoint", String(point + bonusPoint));
    localStorage.setItem("bscLastLoginBonus", today);
    localStorage.setItem("bscLoginStreak", String(streak + 1));

    setReceived(true);
    alert(`ログインボーナス！ +${bonusPoint}pt GET！`);
  };

  return (
    <>
      <style>{`
        .loginBonusBox {
          margin: 16px 0;
          padding: 16px;
          border-radius: 26px;
          background: rgba(255,255,255,.94);
          border: 3px solid #ffd768;
          box-shadow: 0 12px 28px rgba(0,0,0,.22);
          color: #17345c;
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 12px;
          align-items: center;
        }

        .loginBonusBox span {
          display: inline-block;
          padding: 5px 12px;
          border-radius: 999px;
          background: linear-gradient(135deg, #ff4f93, #f6a800);
          color: #fff;
          font-size: 11px;
          font-weight: 900;
        }

        .loginBonusBox h2 {
          margin: 8px 0 4px;
          font-size: 20px;
        }

        .loginBonusBox p {
          margin: 0;
          font-weight: 900;
          color: #80603a;
        }

        .loginBonusBox button {
          border: 0;
          border-radius: 18px;
          padding: 14px;
          background: linear-gradient(135deg, #06c755, #00a7ff);
          color: #fff;
          font-weight: 900;
          box-shadow: 0 6px 0 #007aa8;
        }

        .loginBonusBox button:disabled {
          background: #999;
          box-shadow: none;
        }

        @media (max-width: 430px) {
          .loginBonusBox {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

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
    </>
  );
}
