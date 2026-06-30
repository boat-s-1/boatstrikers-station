"use client";

import { useEffect, useRef, useState } from "react";
import GameLayout from "./GameLayout";
import characters from "../data/characters";

export default function ChatEngine({
  story = [],
  storyId,
  title,
  chapter,
  rewardPoint = 20,
  badge = "BSC認定",
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const [messages, setMessages] = useState([]);
  const [choices, setChoices] = useState([]);
  const [effect, setEffect] = useState("");
  const [showNext, setShowNext] = useState(false);
  const [finished, setFinished] = useState(false);
  const [alreadyCleared, setAlreadyCleared] = useState(false);
  const [mainCharacter, setMainCharacter] = useState({
    ...characters.ichika,
    image: characters.ichika.images.normal,
  });

  const timerRef = useRef(null);

  useEffect(() => {
    const cleared = JSON.parse(localStorage.getItem("bscCleared") || "[]");
    setAlreadyCleared(cleared.includes(storyId));

    runStep(0);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const getCharacter = (key = "ichika", face = "normal") => {
    const chara = characters[key] || characters.ichika;

    return {
      ...chara,
      image: chara.images[face] || chara.images.normal,
    };
  };

  const addCharacterMessage = (step) => {
    const chara = getCharacter(step.character, step.face);
    setMainCharacter(chara);

    setMessages((prev) => [
      ...prev,
      {
        from: "character",
        name: chara.name,
        image: chara.image,
        text: step.text || step.question || "",
        typing: step.typing !== false,
        speed: step.speed || 35,
      },
    ]);
  };

  const runStep = (index) => {
    const step = story[index];

    setChoices([]);
    setShowNext(false);

    if (!step) {
      finishStory();
      return;
    }

    setStepIndex(index);

    if (step.type === "talk") {
      timerRef.current = setTimeout(() => {
        addCharacterMessage(step);

        if (step.autoNext) {
          timerRef.current = setTimeout(() => {
            runStep(index + 1);
          }, step.nextDelay || 900);
        } else {
          setShowNext(true);
        }
      }, step.delay || 500);

      return;
    }

    if (step.type === "quiz") {
      timerRef.current = setTimeout(() => {
        addCharacterMessage(step);
        setChoices(step.choices || []);
      }, step.delay || 500);

      return;
    }

    if (step.type === "effect") {
      setEffect(step.effect || "GOOD!!");

      timerRef.current = setTimeout(() => {
        setEffect("");
        runStep(index + 1);
      }, step.time || 900);

      return;
    }

    if (step.type === "clear") {
      timerRef.current = setTimeout(() => {
        addCharacterMessage(step);

        timerRef.current = setTimeout(() => {
          finishStory();
        }, step.nextDelay || 900);
      }, step.delay || 500);

      return;
    }

    runStep(index + 1);
  };

  const onNext = () => {
    runStep(stepIndex + 1);
  };

  const onChoice = (choiceIndex) => {
    const step = story[stepIndex];
    if (!step || step.type !== "quiz") return;

    const choiceText = step.choices[choiceIndex];
    const isCorrect = choiceIndex === step.answer;

    setChoices([]);
    setShowNext(false);

    setMessages((prev) => [
      ...prev,
      {
        from: "user",
        text: choiceText,
        typing: false,
      },
    ]);

    const reaction = {
      type: "talk",
      character: step.character || "ichika",
      face: isCorrect ? "happy" : "thinking",
      text: isCorrect
        ? step.correctText || "正解！すごい✨"
        : step.wrongText || "惜しい！もう一度考えてみよう♪",
      typing: true,
      speed: step.speed || 35,
    };

    timerRef.current = setTimeout(() => {
      addCharacterMessage(reaction);

      if (isCorrect) {
        timerRef.current = setTimeout(() => {
          setEffect(step.correctEffect || "GOOD!!");

          timerRef.current = setTimeout(() => {
            setEffect("");
            runStep(stepIndex + 1);
          }, step.effectTime || 900);
        }, step.reactionDelay || 700);
      } else {
        timerRef.current = setTimeout(() => {
          setChoices(step.choices || []);
        }, step.retryDelay || 900);
      }
    }, 400);
  };

  const finishStory = () => {
    const cleared = JSON.parse(localStorage.getItem("bscCleared") || "[]");
    const isAlreadyCleared = cleared.includes(storyId);

    if (!isAlreadyCleared) {
      cleared.push(storyId);
      localStorage.setItem("bscCleared", JSON.stringify(cleared));

      const point = Number(localStorage.getItem("bscPoint") || 0);
      localStorage.setItem("bscPoint", point + rewardPoint);

      const badges = JSON.parse(localStorage.getItem("bscBadge") || "[]");

      if (!badges.includes(badge)) {
        badges.push(badge);
        localStorage.setItem("bscBadge", JSON.stringify(badges));
      }

      setEffect(`+${rewardPoint}pt`);
      timerRef.current = setTimeout(() => setEffect(""), 900);
    }

    setAlreadyCleared(true);
    setFinished(true);
    setChoices([]);
    setShowNext(false);
  };

  return (
    <GameLayout
      title={title}
      chapter={chapter}
      character={mainCharacter}
      messages={messages}
      choices={choices}
      onChoice={onChoice}
      onNext={onNext}
      showNext={showNext}
      effect={effect}
      finished={finished}
      rewardPoint={rewardPoint}
      badge={badge}
      alreadyCleared={alreadyCleared}
    />
  );
}
