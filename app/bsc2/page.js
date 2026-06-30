"use client";

import { useState } from "react";
import GameLayout from "./components/GameLayout";

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
    correct: "🎉正解！！\n競艇は6艇で走るよ😊",
    wrong: "惜しい😊\n競艇は6艇で走るよ♪",
  },
  {
    type: "talk",
    text: "すごい！その調子だよ✨",
  },
  {
    type: "talk",
    text: "今日はここまで♪\nまた一緒に勉強しようね😊",
  },
];

export default function BSC2Page() {
  const [step, setStep] = useState(0);
  const [effect, setEffect] = useState("");

  const [messages, setMessages] = useState([
    {
      from: "character",
      name: "一果",
      text: story[0].text,
      typing: true,
      speed: 35,
    },
  ]);

  const current = story[step];

  const next = () => {
    const nextStep = step + 1;

    if (nextStep >= story.length) {
      setEffect("CLEAR!!");
      setTimeout(() => setEffect(""), 900);
      return;
    }

    const data = story[nextStep];
    setStep(nextStep);

    if (data.type === "talk") {
      setMessages((prev) => [
        ...prev,
        {
          from: "character",
          name: "一果",
          text: data.text,
          typing: true,
          speed: 35,
        },
      ]);
    }

    if (data.type === "quiz") {
      setMessages((prev) => [
        ...prev,
        {
          from: "character",
          name: "一果",
          text: data.question,
          typing: true,
          speed: 35,
        },
      ]);
    }
  };

  const selectChoice = (index) => {
    if (current.type !== "quiz") return;

    const correct = index === current.answer;

    setMessages((prev) => [
      ...prev,
      {
        from: "user",
        text: current.choices[index],
        typing: false,
      },
      {
        from: "character",
        name: "一果",
        text: correct ? current.correct : current.wrong,
        typing: true,
        speed: 35,
      },
    ]);

    if (correct) {
      setEffect("GOOD!!");
      setTimeout(() => {
        setEffect("");
        next();
      }, 1000);
    }
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
      effect={effect}
      status={{ level: 1 }}
    />
  );
}
