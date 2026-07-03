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
    const safeIndex = Number.isNaN(savedIndex) ? 0 : savedIndex % characters.length;

    setActiveIndex(safeIndex);
    setLineIndex(Math.floor(Math.random() * characters[safeIndex].lines.length));
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
    <section className="homeCharacterBox" style={{ "--homeCharColor": character.color }}>
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
        <a href="/bsc2/practice/talk">💬 会話問題</a>
        <a href="/bsc2/practice">🏝 実践本部</a>
        <button type="button" onClick={changeCharacter}>
          🔄 交代
        </button>
      </div>
    </section>
  );
}
