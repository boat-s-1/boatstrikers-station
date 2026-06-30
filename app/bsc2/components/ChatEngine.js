"use client";

import { useEffect, useState } from "react";
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
  const [mainCharacter, setMainCharacter] = useState(characters.ichika);
　const [alreadyCleared, setAlreadyCleared] = useState(false);
  
  useEffect(() => {
    runStep(0);
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
        text: step.text || step.question,
        typing: true,
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
      setTimeout(() => {
        addCharacterMessage(step);

        if (step.autoNext) {
          setTimeout(() => {
            runStep(index + 1);
          }, step.delay || 900);
        } else {
          setShowNext(true);
        }
      }, step.delay || 500);

      return;
    }

    if (step.type === "quiz") {
      setTimeout(() => {
        addCharacterMessage(step);
        setChoices(step.choices || []);
      }, step.delay || 500);

      return;
    }

    if (step.type === "clear") {
      setTimeout(() => {
        addCharacterMessage(step);
        finishStory();
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
    const choiceText = step.choices[choiceIndex];
    const isCorrect = choiceIndex === step.answer;

    setChoices([]);

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
      character: step.character,
      face: isCorrect ? "happy" : "thinking",
      text: isCorrect ? step.correctText : step.wrongText,
    };

    setTimeout(() => {
      addCharacterMessage(reaction);

      if (isCorrect) {
        setEffect("GOOD!!");

        setTimeout(() => {
          setEffect("");
          runStep(stepIndex + 1);
        }, 900);
      } else {
        setTimeout(() => {
          setChoices(step.choices || []);
        }, 900);
      }
    }, 500);
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
    setTimeout(() => setEffect(""), 900);
  }

  setAlreadyCleared(true);
  setFinished(true);
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
