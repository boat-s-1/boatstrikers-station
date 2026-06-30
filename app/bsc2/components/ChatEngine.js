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

  const saveKey = `bscSave_${storyId}`;

  useEffect(() => {
    const cleared = JSON.parse(localStorage.getItem("bscCleared") || "[]");
    setAlreadyCleared(cleared.includes(storyId));

    const saved = JSON.parse(localStorage.getItem(saveKey) || "null");

    if (saved && !cleared.includes(storyId)) {
      setStepIndex(saved.stepIndex || 0);
      setMessages(saved.messages || []);
      setShowNext(true);
    } else {
      runStep(0);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const saveProgress = (nextStepIndex, nextMessages) => {
    localStorage.setItem(
      saveKey,
      JSON.stringify({
        storyId,
        stepIndex: nextStepIndex,
        messages: nextMessages,
        updatedAt: new Date().toISOString(),
      })
    );

    localStorage.setItem(
      "bscContinue",
      JSON.stringify({
        storyId,
        title,
        chapter,
        url: "/bsc2/play/chapter1",
        updatedAt: new Date().toISOString(),
      })
    );
  };

  const getCharacter = (key = "ichika", face = "normal") => {
    const chara = characters[key] || characters.ichika;
    return {
      ...chara,
      image: chara.images[face] || chara.images.normal,
    };
  };

  const addCharacterMessage = (step, indexForSave = stepIndex) => {
    const chara = getCharacter(step.character, step.face);
    setMainCharacter(chara);

    setMessages((prev) => {
      const next = [
        ...prev,
        {
          from: "character",
          name: chara.name,
          image: chara.image,
          text: step.text || step.question || "",
          typing: step.typing !== false,
          speed: step.speed || 35,
        },
      ];

      saveProgress(indexForSave, next);
      return next;
    });
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
        addCharacterMessage(step, index);

        if (step.autoNext) {
          timerRef.current = setTimeout(() => {
            runStep(index + 1);
          }, step.nextDelay || 900);
        } else {
          setShowNext(true);
          saveProgress(index, messages);
        }
      }, step.delay || 500);

      return;
    }

    if (step.type === "quiz") {
      timerRef.current = setTimeout(() => {
        addCharacterMessage(step, index);
        setChoices(step.choices || []);
      }, step.delay || 500);

      return;
    }

    if (step.type === "clear") {
      timerRef.current = setTimeout(() => {
        addCharacterMessage(step, index);
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

    setMessages((prev) => {
      const next = [
        ...prev,
        {
          from: "user",
          text: choiceText,
          typing: false,
        },
      ];
      saveProgress(stepIndex, next);
      return next;
    });

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
      addCharacterMessage(reaction, stepIndex);

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
      const beforePoint = Number(localStorage.getItem("bscPoint") || 0);
      const beforeLevel = Math.floor(beforePoint / 100) + 1;
      localStorage.setItem("bscLastLevel", String(beforeLevel));

      cleared.push(storyId);
      localStorage.setItem("bscCleared", JSON.stringify(cleared));

      localStorage.setItem("bscPoint", beforePoint + rewardPoint);

      const badges = JSON.parse(localStorage.getItem("bscBadge") || "[]");
      if (!badges.includes(badge)) {
        badges.push(badge);
        localStorage.setItem("bscBadge", JSON.stringify(badges));
      }

      const characterKey = story[0]?.character || "ichika";
      const bondKey = `bscBond_${characterKey}`;
      const currentBond = Number(localStorage.getItem(bondKey) || 0);
      localStorage.setItem(bondKey, Math.min(currentBond + 5, 100));

      setEffect(`+${rewardPoint}pt`);
      timerRef.current = setTimeout(() => setEffect(""), 900);
    }

    localStorage.removeItem(saveKey);
    localStorage.removeItem("bscContinue");

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
