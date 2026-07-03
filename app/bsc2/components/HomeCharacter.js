"use client";

import { useEffect, useMemo, useState } from "react";

const characters = [
  {
    key: "ichika",
    name: "一果",
    icon: "🌸",
    image: "/bsc/status-ichika.png",
    color: "#ff4f93",
    lines: [
      "おかえり♪ 今日も一緒に強くなろう！",
      "まずは1問だけでも挑戦してみよっか♪",
      "イン逃げの基本、忘れてないかな？",
      "今日もBSCでレベルアップだよ！",
    ],
  },
  {
    key: "kiina",
    name: "キイナ",
    icon: "⚡",
    image: "/bsc/status-kiina.png",
    color: "#f6a800",
    lines: [
      "展示を見る力、今日も鍛えていこう！",
      "穴を狙うなら、まず気配チェックだよ！",
      "データと展示、両方見れば精度が上がるよ！",
      "今日はどの艇が伸びてるかな？",
    ],
  },
  {
    key: "hatsune",
    name: "初音",
    icon: "💜",
    image: "/bsc/status-hatsune.png",
    color: "#9b5cff",
    lines: [
      "回収率を意識して、冷静にいこう。",
      "買わない判断も、大事な戦略だよ。",
      "今日の実践問題、挑戦してみる？",
      "期待値を見つける目を育てよう。",
    ],
  },
];

export default function HomeCharacter() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [lineIndex, setLineIndex] = useState(0);

  useEffect(() => {
    const savedIndex = Number(localStorage.getItem("bscHomeCharacter") || 0);
    const safeIndex = Number.isNaN(savedIndex)
      ? 0
      : savedIndex % characters.length;

    setActiveIndex(safeIndex);
    setLineIndex(
      Math.floor(Math.random() * characters[safeIndex].lines.length)
    );
  }, []);

  const character = characters[activeIndex];

  const line = useMemo(() => {
    return character.lines[lineIndex] || character.lines[0];
  }, [character, lineIndex]);

  const changeCharacter = () => {
    const nextIndex = (activeIndex + 1) % characters.length;
    localStorage.setItem("bscHomeCharacter", String(nextIndex));
    setActiveIndex(nextIndex);
    setLineIndex(Math.floor(Math.random() * characters[nextIndex].lines.length));
  };

  const changeLine = () => {
    setLineIndex((prev) => (prev + 1) % character.lines.length);
  };

  return (
    <>
      <style>{`
        .homeCharacterBox {
          margin: 16px 0;
          padding: 14px;
          border-radius: 28px;
          background: rgba(255,255,255,.94);
          border: 3px solid var(--homeCharColor);
          box-shadow: 0 14px 32px rgba(0,0,0,.24);
        }

        .homeCharacterStage {
          position: relative;
          height: 170px;
          border-radius: 24px;
          background:
            radial-gradient(circle at center, rgba(255,255,255,.9), transparent 45%),
            linear-gradient(135deg, rgba(255,247,223,.95), rgba(232,244,255,.95));
          display: grid;
          place-items: center;
          overflow: hidden;
        }

        .homeCharacterAura {
          position: absolute;
          width: 150px;
          height: 150px;
          border-radius: 50%;
          background: radial-gradient(circle, var(--homeCharColor), transparent 70%);
          opacity: .35;
          animation: homeAuraPulse 2.2s infinite;
        }

        .homeCharacterImageButton {
          position: relative;
          border: 0;
          background: transparent;
          padding: 0;
          z-index: 2;
          animation: homeCharacterFloat 2.2s ease-in-out infinite;
        }

        .homeCharacterImageButton img {
          width: 112px;
          height: 112px;
          object-fit: cover;
          border-radius: 30px;
          background: #fff;
          border: 4px solid var(--homeCharColor);
          box-shadow: 0 10px 24px rgba(0,0,0,.24);
        }

        .homeCharacterBlink {
          position: absolute;
          left: 18%;
          right: 18%;
          top: 42%;
          height: 4px;
          border-radius: 999px;
          background: rgba(23,52,92,.75);
          opacity: 0;
          animation: homeBlink 4s infinite;
        }

        .homeCharacterSparkle {
          position: absolute;
          right: -10px;
          top: -12px;
          font-size: 24px;
          animation: homeSparkle 2.6s infinite;
        }

        .homeCharacterName {
          position: absolute;
          bottom: 12px;
          z-index: 3;
          padding: 7px 18px;
          border-radius: 999px;
          background: rgba(23,52,92,.92);
          color: #fff;
          font-weight: 900;
        }

        .homeCharacterTalk {
          margin-top: 12px;
          padding: 14px;
          border-radius: 20px;
          background: #fff7df;
          border: 2px solid #ffd768;
        }

        .homeCharacterTalk span {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 999px;
          background: var(--homeCharColor);
          color: #fff;
          font-size: 11px;
          font-weight: 900;
        }

        .homeCharacterTalk p {
          margin: 8px 0 0;
          color: #17345c;
          font-weight: 900;
          line-height: 1.7;
        }

        .homeCharacterActions {
          display: grid;
          grid-template-columns: 1fr 1fr auto;
          gap: 8px;
          margin-top: 12px;
        }

        .homeCharacterActions a,
        .homeCharacterActions button {
          border: 0;
          border-radius: 16px;
          padding: 12px 8px;
          background: #17345c;
          color: #fff;
          text-decoration: none;
          text-align: center;
          font-weight: 900;
          font-size: 12px;
        }

        .homeCharacterActions button {
          background: var(--homeCharColor);
        }

        @keyframes homeCharacterFloat {
          0%, 100% { transform: translateY(0) rotate(-1deg); }
          50% { transform: translateY(-7px) rotate(1deg); }
        }

        @keyframes homeAuraPulse {
          0%, 100% { transform: scale(.9); opacity: .25; }
          50% { transform: scale(1.18); opacity: .48; }
        }

        @keyframes homeBlink {
          0%, 92%, 100% { opacity: 0; }
          94%, 96% { opacity: 1; }
        }

        @keyframes homeSparkle {
          0%, 70%, 100% {
            opacity: 0;
            transform: scale(.6) rotate(0deg);
          }
          78%, 88% {
            opacity: 1;
            transform: scale(1.2) rotate(14deg);
          }
        }
      `}</style>

      <section
        className="homeCharacterBox"
        style={{ "--homeCharColor": character.color }}
      >
        <div className="homeCharacterStage">
          <div className="homeCharacterAura" />

          <button
            type="button"
            className="homeCharacterImageButton"
            onClick={changeLine}
          >
            <img src={character.image} alt={character.name} />
            <span className="homeCharacterBlink" />
            <span className="homeCharacterSparkle">✨</span>
          </button>

          <div className="homeCharacterName">
            {character.icon} {character.name}
          </div>
        </div>

        <div className="homeCharacterTalk">
          <span>BSC HOME</span>
          <p>「{line}」</p>
        </div>

        <div className="homeCharacterActions">
          <a href={`/bsc2/practice/talk?character=${character.key}`}>
            💬 会話問題
          </a>
          <a href="/bsc2/practice">🏝 実践本部</a>
          <button type="button" onClick={changeCharacter}>
            🔄 交代
          </button>
        </div>
      </section>
    </>
  );
}
