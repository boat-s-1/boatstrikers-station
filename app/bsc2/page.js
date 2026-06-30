"use client";

import { useState } from "react";
import GameLayout from "./components/GameLayout";

export default function BSC2Page() {
  const story = [
    {
      type: "talk",
      text: "こんにちは😊",
    },
    {
      type: "talk",
      text: "BOAT STRIKERSへようこそ♪",
    },
    {
      type: "talk",
      text: "今日は競艇の基本を一緒に覚えよう✨",
    },
    {
      type: "quiz",
      question: "競艇は何艇で走る？",
      choices: ["4艇", "6艇", "8艇"],
      answer: 1,
    },
    {
      type: "talk",
      text: "正解！！\n競艇は6艇で走るよ😊",
    },
    {
      type: "talk",
      text: "今日はここまで♪",
    },
  ];

  const [step, setStep] = useState(0);

  const current = story[step];

  const [messages, setMessages] = useState([
  {
    from: "character",
    name: "一果",
    text: story[0].text,
    typing: true,
    speed: 35,
  },
]);
  {
  from: "character",
  name: "一果",
  text: data.text,
  typing: true,
  speed: 35,
},
  ]);

  const next = () => {
    const nextStep = step + 1;

    if (nextStep >= story.length) return;

    const data = story[nextStep];

    setStep(nextStep);

    if (data.type === "talk") {
      setMessages((prev) => [
        ...prev,
        {
          from: "character",
          name: "一果",
          text: data.text,
        },
      ]);
    }
  };

  const selectChoice = (index) => {
    const correct = index === current.answer;

    setMessages((prev) => [
      ...prev,
      {
        from: "user",
        text: current.choices[index],
      },
      {
        from: "character",
        name: "一果",
        text: correct
          ? "🎉正解！！"
          : "惜しい😊競艇は6艇だよ♪",
      },
    ]);

    setTimeout(() => {
      next();
    }, 800);
  };

  return (
    <GameLayout
      title="BOAT STRIKERS CHALLENGE"
      chapter="Chapter 1"
      characterName="一果"
      characterImage="/characters/ichika-talk.png"
      messages={messages}
      choices={current.type === "quiz" ? current.choices : []}
      onChoice={selectChoice}
      onNext={next}
      showNext={current.type !== "quiz"}
      effect=""
      status={{
        level: 1,
      }}
    />
  );
}
