"use client";

import { useEffect, useRef, useState } from "react";

const characters = {
  ichika: {
    name: "一果",
    color: "#ff4f93",
    images: {
      normal: "/characters/ichika-talk.png",
      happy: "/characters/ichika-talk.png",
      thinking: "/characters/ichika-talk.png",
    },
  },
  hatsune: {
    name: "初音",
    color: "#8a55e6",
    images: {
      normal: "/characters/hatsune-talk.png",
      happy: "/characters/hatsune-talk.png",
      thinking: "/characters/hatsune-talk.png",
    },
  },
  kiina: {
    name: "キイナ",
    color: "#f6a800",
    images: {
      normal: "/characters/kiina-talk.png",
      happy: "/characters/kiina-talk.png",
      thinking: "/characters/kiina-talk.png",
    },
  },
};

export default function ChatEngine({
  story = [],
  storyId = "bsc-demo",
  rewardPoint = 20,
  badge = "BSC入門",
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const [messages, setMessages] = useState([]);
  const [waitingChoice, setWaitingChoice] = useState(null);
  const [effect, setEffect] = useState("");
  const [finished, setFinished] = useState(false);
  const [alreadyCleared, setAlreadyCleared] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    const cleared = JSON.parse(localStorage.getItem("bscCleared") || "[]");
    setAlreadyCleared(cleared.includes(storyId));

    const saved = localStorage.getItem(`bscSave_${storyId}`);

    if (saved) {
      const data = JSON.parse(saved);
      setStepIndex(data.stepIndex || 0);
      setMessages(data.messages || []);
    } else {
      runStep(0);
    }
  }, [storyId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, waitingChoice, effect, finished]);

  const saveProgress = (nextStepIndex, nextMessages) => {
    localStorage.setItem(
      `bscSave_${storyId}`,
      JSON.stringify({
        stepIndex: nextStepIndex,
        messages: nextMessages,
      })
    );
  };

  const addMessage = (message, nextStepIndex = stepIndex) => {
    setMessages((prev) => {
      const next = [...prev, message];
      saveProgress(nextStepIndex, next);
      return next;
    });
  };

  const runStep = (index) => {
    const step = story[index];

    if (!step) {
      clearStory();
      return;
    }

    setStepIndex(index);
    setWaitingChoice(null);

    if (step.type === "talk") {
      setTimeout(() => {
        addMessage(
          {
            type: "talk",
            character: step.character || "ichika",
            face: step.face || "normal",
            text: step.text,
          },
          index
        );
      }, step.delay || 500);
      return;
    }

    if (step.type === "quiz") {
      setTimeout(() => {
        addMessage(
          {
            type: "talk",
            character: step.character || "ichika",
            face: step.face || "thinking",
            text: step.question,
          },
          index
        );

        setWaitingChoice(step);
      }, step.delay || 500);
      return;
    }

    if (step.type === "effect") {
      setEffect(step.effect || "GOOD!!");

      setTimeout(() => {
        setEffect("");
        runStep(index + 1);
      }, step.time || 900);
      return;
    }

    if (step.type === "delay") {
      setTimeout(() => {
        runStep(index + 1);
      }, step.time || 800);
      return;
    }

    runStep(index + 1);
  };

  const nextStep = () => {
    runStep(stepIndex + 1);
  };

  const answerChoice = (choiceIndex) => {
    if (!waitingChoice) return;

    const isCorrect = choiceIndex === waitingChoice.answer;

    const userMessage = {
      type: "user",
      text: waitingChoice.choices[choiceIndex],
    };

    const reactionMessage = {
      type: "talk",
      character: waitingChoice.character || "ichika",
      face: isCorrect ? "happy" : "thinking",
      text: isCorrect
        ? waitingChoice.correct || "正解！すごい✨"
        : waitingChoice.wrong || "惜しい！もう一度考えてみよう♪",
    };

    setMessages((prev) => {
      const next = [...prev, userMessage, reactionMessage];
      saveProgress(stepIndex, next);
      return next;
    });

    setWaitingChoice(null);

    if (isCorrect) {
      setEffect("GOOD!!");
      setTimeout(() => {
        setEffect("");
        runStep(stepIndex + 1);
      }, 900);
    }
  };

  const clearStory = () => {
    const cleared = JSON.parse(localStorage.getItem("bscCleared") || "[]");

    if (!cleared.includes(storyId)) {
      cleared.push(storyId);
      localStorage.setItem("bscCleared", JSON.stringify(cleared));

      const point = Number(localStorage.getItem("bscPoint") || 0);
      localStorage.setItem("bscPoint", point + rewardPoint);

      const badges = JSON.parse(localStorage.getItem("bscBadge") || "[]");

      if (!badges.includes(badge)) {
        badges.push(badge);
        localStorage.setItem("bscBadge", JSON.stringify(badges));
      }
    }

    localStorage.removeItem(`bscSave_${storyId}`);
    setAlreadyCleared(true);
    setFinished(true);
  };

  return (
    <section className="bscGameScreen">
      {effect && <div className="bscEffect">{effect}</div>}

      <div className="bscChatArea">
        {messages.map((msg, index) => {
          if (msg.type === "user") {
            return (
              <div className="bscMsgRow user" key={index}>
                <div className="bscUserBubble">{msg.text}</div>
              </div>
            );
          }

          const chara = characters[msg.character] || characters.ichika;
          const img = chara.images[msg.face] || chara.images.normal;

          return (
            <div className="bscMsgRow character" key={index}>
              <img src={img} alt={chara.name} className="bscCharaIcon" />

              <div>
                <div
                  className="bscCharaName"
                  style={{ color: chara.color }}
                >
                  {chara.name}
                </div>
                <div className="bscBubble">{msg.text}</div>
              </div>
            </div>
          );
        })}

        {waitingChoice && (
          <div className="bscChoiceBox">
            {waitingChoice.choices.map((choice, index) => (
              <button
                type="button"
                key={choice}
                onClick={() => answerChoice(index)}
              >
                {choice}
              </button>
            ))}
          </div>
        )}

        {!waitingChoice && !finished && (
          <button type="button" className="bscNextButton" onClick={nextStep}>
            次へ ▶
          </button>
        )}

        {finished && (
          <div className="bscClearPanel">
            <h2>🎉 CLEAR!</h2>
            <p>
              {alreadyCleared
                ? "復習完了！ポイントは初回のみ加算されます。"
                : `+${rewardPoint}pt 獲得！`}
            </p>
            <strong>🏅 {badge} GET!</strong>
            <a href="/bsc">ミッション一覧へ戻る ›</a>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </section>
  );
}
