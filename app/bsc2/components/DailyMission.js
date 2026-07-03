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
            <div className={`dailyMissionItem ${isDone ? "done" : ""}`} key={mission.id}>
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
  );
}
