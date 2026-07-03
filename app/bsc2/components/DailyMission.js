"use client";

import { useEffect, useState } from "react";

const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

const missions = [
  {
    id: "talk",
    title: "会話問題に挑戦",
    desc: "3人の誰かと1回会話問題をする",
    href: "/bsc2/practice/talk",
  },
  {
    id: "practice",
    title: "実践本部へ行く",
    desc: "実践エリアをチェックする",
    href: "/bsc2/practice",
  },
  {
    id: "vote",
    title: "今日の投票を見る",
    desc: "リアルタイム投票を確認する",
    href: "/bsc2",
  },
];

export default function DailyMission() {
  const [done, setDone] = useState([]);

  useEffect(() => {
    const saved = JSON.parse(
      localStorage.getItem(`bscDailyMission_${todayKey()}`) || "[]"
    );
    setDone(saved);
  }, []);

  const completeMission = (id) => {
    if (done.includes(id)) return;

    const next = [...done, id];
    setDone(next);

    localStorage.setItem(`bscDailyMission_${todayKey()}`, JSON.stringify(next));

    const point = Number(localStorage.getItem("bscPoint") || 0);
    localStorage.setItem("bscPoint", String(point + 10));

    alert("ミッション達成！ +10pt GET！");
  };

  const completeAll = done.length >= missions.length;

  return (
    <>
      <style>{`
        .dailyMissionBox {
          margin: 16px 0;
          padding: 16px;
          border-radius: 26px;
          background: rgba(255,255,255,.94);
          border: 3px solid #ffd768;
          box-shadow: 0 12px 28px rgba(0,0,0,.22);
          color: #17345c;
        }

        .dailyMissionHead span {
          display: inline-block;
          padding: 5px 12px;
          border-radius: 999px;
          background: linear-gradient(135deg, #ff4f93, #f6a800);
          color: #fff;
          font-size: 11px;
          font-weight: 900;
        }

        .dailyMissionHead h2 {
          margin: 8px 0 4px;
          font-size: 20px;
        }

        .dailyMissionHead p {
          margin: 0;
          font-weight: 900;
          color: #80603a;
        }

        .dailyMissionList {
          display: grid;
          gap: 10px;
          margin-top: 14px;
        }

        .dailyMissionItem {
          display: grid;
          grid-template-columns: 1fr 82px;
          gap: 10px;
          align-items: center;
          padding: 12px;
          border-radius: 18px;
          background: #eef5ff;
        }

        .dailyMissionItem.done {
          background: #eaffef;
        }

        .dailyMissionItem strong {
          display: block;
          font-size: 14px;
        }

        .dailyMissionItem p {
          margin: 4px 0 0;
          font-size: 12px;
          font-weight: 900;
          color: #80603a;
        }

        .dailyMissionItem a {
          display: block;
          padding: 10px 8px;
          border-radius: 999px;
          background: #17345c;
          color: #fff;
          text-align: center;
          text-decoration: none;
          font-size: 12px;
          font-weight: 900;
        }

        .dailyMissionItem.done a {
          background: #06c755;
        }

        .dailyMissionComplete {
          margin-top: 14px;
          padding: 12px;
          border-radius: 18px;
          background: linear-gradient(135deg, #ffd768, #ff4f93);
          color: #fff;
          text-align: center;
          font-weight: 900;
        }

        @media (max-width: 430px) {
          .dailyMissionItem {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <section className="dailyMissionBox">
        <div className="dailyMissionHead">
          <span>📅 DAILY MISSION</span>
          <h2>今日のミッション</h2>
          <p>{done.length}/{missions.length} 達成</p>
        </div>

        <div className="dailyMissionList">
          {missions.map((mission) => {
            const isDone = done.includes(mission.id);

            return (
              <div
                className={`dailyMissionItem ${isDone ? "done" : ""}`}
                key={mission.id}
              >
                <div>
                  <strong>{isDone ? "✅" : "⬜"} {mission.title}</strong>
                  <p>{mission.desc}</p>
                </div>

                <a
                  href={mission.href}
                  onClick={() => completeMission(mission.id)}
                >
                  {isDone ? "達成済み" : "挑戦"}
                </a>
              </div>
            );
          })}
        </div>

        {completeAll && (
          <div className="dailyMissionComplete">
            🎉 COMPLETE！今日のミッション全達成！
          </div>
        )}
      </section>
    </>
  );
}
