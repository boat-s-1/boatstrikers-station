"use client";

import { useEffect, useState } from "react";

const TODAY_EVENT = {
  id: "2026-07-01-gamagori-12",
  title: "蒲郡12R ドリーム戦",
  deadline: "20:35",
  candidates: [
    {
      key: "ichika",
      name: "一果",
      icon: "🌸",
      label: "一果の本命",
      main: "1-2-3",
      subLabel: "一果の押さえ",
      sub: "1-2-56",
      baseVotes: 238,
    },
    {
      key: "kiina",
      name: "キイナ",
      icon: "⚡",
      label: "キイナの穴",
      main: "5-1-4",
      subLabel: "",
      sub: "",
      baseVotes: 141,
    },
    {
      key: "hatsune",
      name: "初音",
      icon: "💜",
      label: "初音の狙い",
      main: "2-1-3",
      subLabel: "",
      sub: "",
      baseVotes: 82,
    },
  ],
};

export default function DailyVote() {
  const [voted, setVoted] = useState(false);
  const [choice, setChoice] = useState("");
  const [votes, setVotes] = useState({});

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    const voteKey = `dailyVote_${TODAY_EVENT.id}_${today}`;
    const countKey = `dailyVoteCount_${TODAY_EVENT.id}_${today}`;

    const savedVote = JSON.parse(localStorage.getItem(voteKey) || "null");
    const savedCounts = JSON.parse(localStorage.getItem(countKey) || "null");

    const initialVotes =
      savedCounts ||
      TODAY_EVENT.candidates.reduce((acc, item) => {
        acc[item.key] = item.baseVotes;
        return acc;
      }, {});

    setVotes(initialVotes);

    if (savedVote) {
      setVoted(true);
      setChoice(savedVote.choice);
    }
  }, []);

  const totalVotes = Object.values(votes).reduce((sum, n) => sum + n, 0);

  const getPercent = (key) => {
    if (!totalVotes) return 0;
    return Math.round((votes[key] / totalVotes) * 100);
  };

  const vote = (candidate) => {
    if (voted) return;

    const today = new Date().toISOString().slice(0, 10);
    const voteKey = `dailyVote_${TODAY_EVENT.id}_${today}`;
    const countKey = `dailyVoteCount_${TODAY_EVENT.id}_${today}`;

    const nextVotes = {
      ...votes,
      [candidate.key]: (votes[candidate.key] || 0) + 1,
    };

    localStorage.setItem(
      voteKey,
      JSON.stringify({
        date: today,
        eventId: TODAY_EVENT.id,
        choice: candidate.name,
        key: candidate.key,
      })
    );

    localStorage.setItem(countKey, JSON.stringify(nextVotes));

    const point = Number(localStorage.getItem("bscPoint") || 0);
    localStorage.setItem("bscPoint", point + 2);

    setVotes(nextVotes);
    setChoice(candidate.name);
    setVoted(true);
  };

  return (
    <section className="dailyVote">
      <div className="dailyVoteHeader">
        <span>🌸 TODAY&apos;S EVENT</span>
        <h2>{TODAY_EVENT.title}</h2>
        <p>投票締切 {TODAY_EVENT.deadline}</p>
      </div>

      <div className="dailyVoteCards">
        {TODAY_EVENT.candidates.map((item) => (
          <div className="voteCard" key={item.key}>
            <h3>
              {item.icon} {item.name}
            </h3>

            <p>
              {item.label}
              <br />
              <b>{item.main}</b>
            </p>

            {item.sub && (
              <p>
                {item.subLabel}
                <br />
                <b>{item.sub}</b>
              </p>
            )}
          </div>
        ))}
      </div>

      {!voted ? (
        <div className="voteButtons">
          <h3>どれが来ると思う？</h3>

          {TODAY_EVENT.candidates.map((item) => (
            <button type="button" key={item.key} onClick={() => vote(item)}>
              {item.icon} {item.name}に投票
            </button>
          ))}
        </div>
      ) : (
        <div className="voteFinish">
          <h3>投票ありがとう😊</h3>
          <p>+2pt GET!!</p>
          <p>
            あなたは <b>{choice}</b> に投票しました。
          </p>
        </div>
      )}

      <div className="voteResultBox">
        <h3>📊 現在の投票率</h3>
        <p className="voteTotal">現在 {totalVotes}人が参加中</p>

        {TODAY_EVENT.candidates.map((item) => {
          const percent = getPercent(item.key);

          return (
            <div className="voteResultRow" key={item.key}>
              <div className="voteResultTop">
                <strong>
                  {item.icon} {item.name}
                </strong>
                <span>
                  {percent}% / {votes[item.key] || 0}票
                </span>
              </div>

              <div className="voteBar">
                <i style={{ width: `${percent}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
