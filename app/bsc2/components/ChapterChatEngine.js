"use client";

import { useEffect, useRef, useState } from "react";
import { doc, updateDoc, arrayUnion, increment } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";

const characters = {
  ichika: {
    name: "一果",
    icon: "🌸",
    image: "/bsc/status-ichika.png",
    color: "#ff4f93",
  },
  kiina: {
    name: "キイナ",
    icon: "⚡",
    image: "/bsc/status-kiina.png",
    color: "#f6a800",
  },
  hatsune: {
    name: "初音",
    icon: "💜",
    image: "/bsc/status-hatsune.png",
    color: "#9b5cff",
  },
};

export default function ChapterChatEngine({ chapterData }) {
  const { user } = useAuth();
  const bottomRef = useRef(null);

  const steps = chapterData?.steps || [];

  const [index, setIndex] = useState(0);
  const [messages, setMessages] = useState([]);
  const [answeredQuizId, setAnsweredQuizId] = useState(null);
  const [selected, setSelected] = useState(null);
  const [cleared, setCleared] = useState(false);
  const [rewarded, setRewarded] = useState(false);

  const current = steps[index];
  const progress = steps.length
    ? Math.round(((index + 1) / steps.length) * 100)
    : 0;

  useEffect(() => {
    if (!current || cleared) return;

    const timer = setTimeout(() => {
      setMessages((prev) => [...prev, current]);

      if (current.type === "talk" && current.autoNext) {
        setTimeout(() => {
          nextStep();
        }, current.delay || 900);
      }
    }, current.type === "talk" ? current.delay || 500 : 300);

    return () => clearTimeout(timer);
  }, [index]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, selected, cleared]);

  const nextStep = () => {
    setAnsweredQuizId(null);
    setSelected(null);

    if (index + 1 >= steps.length) {
      setCleared(true);
      return;
    }

    setIndex((prev) => prev + 1);
  };

  const answerQuiz = (choiceIndex, quizStep, quizKey) => {
    if (answeredQuizId === quizKey) return;

    const isCorrect = choiceIndex === quizStep.answer;

    setSelected(choiceIndex);
    setAnsweredQuizId(quizKey);

    setMessages((prev) => [
      ...prev,
      {
        type: "userAnswer",
        text: quizStep.choices[choiceIndex],
      },
      {
        type: "result",
        character: quizStep.character,
        text: isCorrect ? quizStep.correctText : quizStep.wrongText,
      },
    ]);
  };

  const receiveReward = async () => {
    if (rewarded) return;

    const reward = chapterData.reward || {};
    const point = reward.point || 0;
    const badgeName = reward.badge?.name;
    const bond = reward.bond || {};

    const localPoint = Number(localStorage.getItem("bscPoint") || 0);
    localStorage.setItem("bscPoint", String(localPoint + point));

    const clearedList = JSON.parse(localStorage.getItem("bscCleared") || "[]");
    if (!clearedList.includes(chapterData.id)) {
      localStorage.setItem(
        "bscCleared",
        JSON.stringify([...clearedList, chapterData.id])
      );
    }

    if (badgeName) {
      const badges = JSON.parse(localStorage.getItem("bscBadge") || "[]");
      if (!badges.includes(badgeName)) {
        localStorage.setItem("bscBadge", JSON.stringify([...badges, badgeName]));
      }
    }

    Object.keys(bond).forEach((key) => {
      const now = Number(localStorage.getItem(`bscBond_${key}`) || 0);
      localStorage.setItem(
        `bscBond_${key}`,
        String(Math.min(now + bond[key], 100))
      );
    });

    if (user) {
      const ref = doc(db, "bsc_users", user.uid);

      const updateData = {
        point: increment(point),
        cleared: arrayUnion(chapterData.id),
        updatedAt: new Date(),
      };

      if (badgeName) {
        updateData.badges = arrayUnion(badgeName);
      }

      await updateDoc(ref, updateData);
    }

    setRewarded(true);
    alert(`報酬GET！ +${point}pt`);
  };

  return (
    <main className="chapterChatPage">
      <style>{`
        .chapterChatPage {
          min-height: 100vh;
          padding: 10px 10px 90px;
          background: linear-gradient(180deg, #eaf8ff, #fff7df);
        }

        .chapterChatHeader {
          position: sticky;
          top: 8px;
          z-index: 20;
          max-width: 640px;
          margin: 0 auto 12px;
          padding: 10px 12px;
          border-radius: 24px;
          background: rgba(255,255,255,.96);
          border: 3px solid #ffd768;
          box-shadow: 0 10px 24px rgba(0,0,0,.18);
        }

        .chapterChatHeaderTop {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .chapterBack {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          background: #17345c;
          color: #fff;
          text-decoration: none;
          font-weight: 900;
        }

        .chapterTitle {
          flex: 1;
          text-align: center;
        }

        .chapterTitle span {
          display: block;
          font-size: 11px;
          font-weight: 900;
          color: #ff4f93;
        }

        .chapterTitle h1 {
          margin: 2px 0 0;
          font-size: 17px;
          color: #17345c;
          font-weight: 900;
        }

        .chapterPercent {
          color: #17345c;
          font-size: 12px;
          font-weight: 900;
        }

        .chapterProgress {
          height: 10px;
          margin-top: 8px;
          border-radius: 999px;
          background: #d8e5f6;
          overflow: hidden;
        }

        .chapterProgress span {
          display: block;
          height: 100%;
          background: linear-gradient(90deg, #06c755, #ffd768);
        }

        .chatArea {
          max-width: 640px;
          margin: 0 auto;
          display: grid;
          gap: 14px;
        }

        .chatRow {
          display: flex;
          align-items: flex-end;
          gap: 8px;
          animation: chatIn .22s ease-out;
        }

        .chatRow.user {
          justify-content: flex-end;
        }

        .chatAvatarWrap {
          width: 54px;
          display: grid;
          place-items: center;
        }

        .chatAvatar {
          width: 48px;
          height: 48px;
          object-fit: cover;
          border-radius: 50%;
          border: 3px solid #ff7ab6;
          background: #fff;
          box-shadow: 0 6px 14px rgba(0,0,0,.18);
        }

        .chatBubble {
          max-width: 76%;
          padding: 13px 15px;
          border-radius: 22px 22px 22px 6px;
          background: #fff;
          color: #3a2517;
          font-size: 16px;
          font-weight: 900;
          line-height: 1.75;
          white-space: pre-line;
          box-shadow: 0 8px 20px rgba(0,0,0,.12);
        }

        .chatName {
          display: block;
          margin-bottom: 4px;
          color: #ff4f93;
          font-size: 12px;
          font-weight: 900;
        }

        .chatRow.user .chatBubble {
          border-radius: 22px 22px 6px 22px;
          background: #06c755;
          color: #fff;
        }

        .quizBox {
          margin-left: 62px;
          padding: 16px;
          border-radius: 24px;
          background: #17345c;
          border: 3px solid #ffd768;
          box-shadow: 0 10px 26px rgba(0,0,0,.22);
          animation: chatIn .22s ease-out;
        }

        .quizBoxTitle {
          margin: 0 0 12px;
          text-align: center;
          color: #ffd768;
          font-weight: 900;
        }

        .quizChoices {
          display: grid;
          gap: 10px;
        }

        .quizChoices button {
          border: 0;
          border-radius: 18px;
          padding: 15px;
          background: linear-gradient(135deg, #ff4f93, #f6a800);
          color: #fff;
          font-size: 16px;
          font-weight: 900;
          box-shadow: 0 6px 0 rgba(120,80,0,.55);
        }

        .quizChoices button.correct {
          background: #06c755;
        }

        .quizChoices button.wrong {
          background: #ff5252;
        }

        .nextButton {
          width: 100%;
          margin-top: 12px;
          border: 0;
          border-radius: 18px;
          padding: 14px;
          background: #ffd768;
          color: #17345c;
          font-weight: 900;
        }

        .clearBox {
          max-width: 640px;
          margin: 16px auto 0;
          padding: 18px;
          border-radius: 28px;
          background: rgba(255,255,255,.97);
          border: 3px solid #ffd768;
          text-align: center;
          box-shadow: 0 16px 34px rgba(0,0,0,.22);
        }

        .clearBox h2 {
          margin: 0 0 10px;
          font-size: 30px;
          color: #ff4f93;
        }

        .rewardBox {
          margin: 14px 0;
          padding: 14px;
          border-radius: 22px;
          background: #fff7df;
          border: 2px solid #ffd768;
          color: #17345c;
          font-weight: 900;
        }

        .clearActions {
          display: grid;
          gap: 10px;
        }

        .clearActions button,
        .clearActions a {
          display: block;
          border: 0;
          border-radius: 18px;
          padding: 14px;
          text-decoration: none;
          color: #fff;
          font-weight: 900;
          background: linear-gradient(135deg, #ff4f93, #f6a800);
        }

        .clearActions a {
          background: #17345c;
        }

        @keyframes chatIn {
          from {
            opacity: 0;
            transform: translateY(10px) scale(.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>

      <header className="chapterChatHeader">
        <div className="chapterChatHeaderTop">
          <a className="chapterBack" href={`/bsc2/${chapterData.area || "beginner"}`}>
            ←
          </a>

          <div className="chapterTitle">
            <span>{chapterData.title}</span>
            <h1>{chapterData.subtitle}</h1>
          </div>

          <b className="chapterPercent">{progress}%</b>
        </div>

        <div className="chapterProgress">
          <span style={{ width: `${progress}%` }} />
        </div>
      </header>

      <section className="chatArea">
        {messages.map((message, i) => {
          if (message.type === "quiz") {
            return (
              <QuizMessage
                key={`quiz-${i}`}
                message={message}
                quizKey={`quiz-${i}`}
                selected={selected}
                answeredQuizId={answeredQuizId}
                onAnswer={answerQuiz}
                onNext={nextStep}
              />
            );
          }

          if (message.type === "userAnswer") {
            return (
              <div className="chatRow user" key={`user-${i}`}>
                <div className="chatBubble">{message.text}</div>
              </div>
            );
          }

          const char = characters[message.character] || characters.ichika;

          return (
            <div className="chatRow" key={`msg-${i}`}>
              <div className="chatAvatarWrap">
                <img className="chatAvatar" src={char.image} alt={char.name} />
              </div>

              <div className="chatBubble">
                <span className="chatName">
                  {char.icon} {char.name}
                </span>
                {message.text}
              </div>
            </div>
          );
        })}

        {cleared && (
          <div className="clearBox">
            <h2>🎉 MISSION CLEAR!</h2>
            <p>{chapterData.subtitle}</p>

            <div className="rewardBox">
              <p>⭐ +{chapterData.reward?.point || 0}pt</p>
              <p>
                {chapterData.reward?.badge?.icon || "🏅"}{" "}
                {chapterData.reward?.badge?.name || "クリアバッジ"}
              </p>
              <p>❤️ 親密度UP</p>
            </div>

            <div className="clearActions">
              <button type="button" onClick={receiveReward} disabled={rewarded}>
                {rewarded ? "受取済み" : "報酬を受け取る"}
              </button>

              <a href={`/bsc2/${chapterData.area || "beginner"}`}>
                マップへ戻る
              </a>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </section>
    </main>
  );
}

function QuizMessage({
  message,
  quizKey,
  selected,
  answeredQuizId,
  onAnswer,
  onNext,
}) {
  const isAnswered = answeredQuizId === quizKey;

  return (
    <>
      <div className="quizBox">
        <p className="quizBoxTitle">答えを選んでね</p>

        <div className="quizChoices">
          {message.choices.map((choice, index) => {
            let className = "";

            if (isAnswered && index === message.answer) {
              className = "correct";
            }

            if (isAnswered && selected === index && index !== message.answer) {
              className = "wrong";
            }

            return (
              <button
                key={choice}
                type="button"
                className={className}
                disabled={isAnswered}
                onClick={() => onAnswer(index, message, quizKey)}
              >
                {choice}
              </button>
            );
          })}
        </div>

        {isAnswered && (
          <button type="button" className="nextButton" onClick={onNext}>
            次へ ▶
          </button>
        )}
      </div>
    </>
  );
}
