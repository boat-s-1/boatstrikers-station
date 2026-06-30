"use client";

import { useEffect, useRef, useState } from "react";

export default function LessonClient({ lesson }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [messages, setMessages] = useState([]);
  const [selected, setSelected] = useState(null);
  const [finished, setFinished] = useState(false);
  const [alreadyCleared, setAlreadyCleared] = useState(false);
  const bottomRef = useRef(null);

  const currentStep = lesson.steps[stepIndex];

  useEffect(() => {
    const missions = JSON.parse(localStorage.getItem("bscMission") || "[]");
    setAlreadyCleared(missions.includes(lesson.id));

    setMessages([
      {
        from: "character",
        text: lesson.steps[0].text,
      },
    ]);
  }, [lesson]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, selected, finished]);

  const goNext = () => {
    const nextIndex = stepIndex + 1;

    if (nextIndex >= lesson.steps.length) {
      clearMission();
      return;
    }

    setStepIndex(nextIndex);
    setSelected(null);

    const nextStep = lesson.steps[nextIndex];

    if (nextStep.type === "talk") {
      setMessages((prev) => [
        ...prev,
        {
          from: "character",
          text: nextStep.text,
        },
      ]);
    } else {
      setMessages((prev) => [
        ...prev,
        {
          from: "character",
          text: "じゃあ確認問題だよ♪",
        },
      ]);
    }
  };

  const answerQuiz = (choiceIndex) => {
    if (selected !== null) return;

    setSelected(choiceIndex);

    const isCorrect = choiceIndex === currentStep.answer;

    setMessages((prev) => [
      ...prev,
      {
        from: "user",
        text: currentStep.choices[choiceIndex],
      },
      {
        from: "character",
        text: isCorrect ? currentStep.correct : currentStep.wrong,
      },
    ]);
  };

  const clearMission = () => {
    const missions = JSON.parse(localStorage.getItem("bscMission") || "[]");

    if (!missions.includes(lesson.id)) {
      const point = Number(localStorage.getItem("bscPoint") || 0);
      localStorage.setItem("bscPoint", point + 20);

      missions.push(lesson.id);
      localStorage.setItem("bscMission", JSON.stringify(missions));

      const badges = JSON.parse(localStorage.getItem("bscBadge") || "[]");

      if (!badges.includes(lesson.badge)) {
        badges.push(lesson.badge);
        localStorage.setItem("bscBadge", JSON.stringify(badges));
      }
    }

    setAlreadyCleared(true);
    setFinished(true);
  };

  return (
    <main className="libraryPage">
      <header className="header">
        <div className="logo">
          BOAT
          <br />
          <span>STRIKERS</span>
        </div>

        <a className="lineMini" href="https://lin.ee/Pf3FEEQ">
          LINE登録
        </a>
      </header>

      <section className="bscChatHero">
        <span>Mission {lesson.id}</span>
        <h1>{lesson.title}</h1>
        <p>{lesson.characterName}と一緒に学ぼう♪</p>
        {alreadyCleared && <b>✅ CLEAR済み</b>}
      </section>

      <section className="bscChatBox">
        {messages.map((msg, index) => (
          <div
            className={`bscMessage ${
              msg.from === "user" ? "userMessage" : "characterMessage"
            }`}
            key={index}
          >
            {msg.from === "character" && (
              <img
                src={lesson.characterImage}
                alt={lesson.characterName}
                className="bscCharacterIcon"
              />
            )}

            <div className="bscBubble">{msg.text}</div>
          </div>
        ))}

        {currentStep?.type === "quiz" && !finished && (
          <div className="bscQuizChat">
            <h2>{currentStep.question}</h2>

            <div className="bscChatChoices">
              {currentStep.choices.map((choice, index) => (
                <button
                  type="button"
                  key={choice}
                  onClick={() => answerQuiz(index)}
                  className={selected === index ? "selectedChoice" : ""}
                >
                  {choice}
                </button>
              ))}
            </div>
          </div>
        )}

        {!finished && (
          <button
            type="button"
            className="bscNextBtn"
            onClick={goNext}
            disabled={currentStep?.type === "quiz" && selected === null}
          >
            {currentStep?.type === "quiz" ? "次へ進む ▶" : "わかった！ ▶"}
          </button>
        )}

        {finished && (
          <div className="bscClearBox">
            <h2>🎉 MISSION CLEAR!</h2>
            <p>
              {alreadyCleared
                ? "復習完了！ポイントは初回クリア時のみ加算されます。"
                : "+20pt 獲得！"}
            </p>
            <strong>🏅 {lesson.badge} GET!</strong>
            <a href="/bsc">ミッション一覧へ戻る ›</a>
          </div>
        )}

        <div ref={bottomRef} />
      </section>

      <nav className="bottomNav">
        <a href="/">ホーム</a>
        <a href="/ichika">一果</a>
        <a href="/hatsune">初音</a>
        <a href="/kiina">キイナ</a>
        <a href="/library">図書館</a>
      </nav>
    </main>
  );
}
