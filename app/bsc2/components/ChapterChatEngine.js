"use client";

import { useEffect, useRef, useState } from "react";
import { doc, updateDoc, arrayUnion, increment } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";

const characters = {
  ichika: { name: "一果", icon: "🌸", image: "/bsc/characters/IMG_5965.png", color: "#ff4f93" },
  kiina: { name: "キイナ", icon: "⚡", image: "/bsc/status-kiina.png", color: "#f6a800" },
  hatsune: { name: "初音", icon: "💜", image: "/bsc/status-hatsune.png", color: "#9b5cff" },
};

export default function ChapterChatEngine({ chapterData }) {
  const { user, player } = useAuth();
  const bottomRef = useRef(null);

  const steps = chapterData?.steps || [];

  const [index, setIndex] = useState(0);
  const [messages, setMessages] = useState([]);
  const [selected, setSelected] = useState(null);
  const [answeredQuizId, setAnsweredQuizId] = useState(null);
  const [reaction, setReaction] = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [rewarded, setRewarded] = useState(false);

  const [localData, setLocalData] = useState({
    point: 0,
    badges: [],
    bonds: {},
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    setLocalData({
      point: Number(localStorage.getItem("bscPoint") || 0),
      badges: JSON.parse(localStorage.getItem("bscBadge") || "[]"),
      bonds: {
        ichika: Number(localStorage.getItem("bscBond_ichika") || 0),
        kiina: Number(localStorage.getItem("bscBond_kiina") || 0),
        hatsune: Number(localStorage.getItem("bscBond_hatsune") || 0),
      },
    });
  }, []);

  const current = steps[index];
  const currentKey = current?.character || chapterData?.teacher || "ichika";
  const currentChar = characters[currentKey] || characters.ichika;

  const point = player?.point ?? localData.point;
  const badges = player?.badges ?? localData.badges;
  const bonds = player?.bonds ?? localData.bonds;

  const level = Math.floor(point / 100) + 1;
  const exp = point % 100;
  const bondValue = bonds?.[chapterData?.teacher] || 0;

  const progress = steps.length
    ? Math.round(((index + 1) / steps.length) * 100)
    : 0;

  useEffect(() => {
    if (!current || showResult) return;

    const timer = setTimeout(() => {
      setMessages((prev) => [...prev, current]);

      if (current.type === "talk") {
        setReaction("talk");
        setTimeout(goNext, current.delay || 1200);
      }

      if (current.type === "quiz") {
        setReaction("question");
      }

      if (current.type === "clear") {
        setReaction("clear");
        setTimeout(() => setShowResult(true), 1500);
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [index, showResult]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, selected, showResult]);

  const goNext = () => {
    setAnsweredQuizId(null);
    setSelected(null);

    if (index + 1 >= steps.length) {
      setShowResult(true);
      return;
    }

    setIndex((prev) => prev + 1);
  };

  const answerQuiz = (choiceIndex, quizStep, quizKey) => {
    if (answeredQuizId === quizKey) return;

    const isCorrect = choiceIndex === quizStep.answer;

    setSelected(choiceIndex);
    setAnsweredQuizId(quizKey);
    setReaction(isCorrect ? "correct" : "wrong");

    setMessages((prev) => [
      ...prev,
      { type: "userAnswer", text: quizStep.choices[choiceIndex] },
      {
        type: "result",
        character: quizStep.character,
        text: isCorrect ? quizStep.correctText : quizStep.wrongText,
        isCorrect,
      },
    ]);

    setTimeout(() => {
      setReaction(null);
      goNext();
    }, 1700);
  };

  const receiveReward = async () => {
    if (rewarded) return;

    const reward = chapterData.reward || {};
    const pointReward = reward.point || 0;
    const badgeName = reward.badge?.name;
    const bond = reward.bond || {};

    if (typeof window !== "undefined") {
      const localPoint = Number(localStorage.getItem("bscPoint") || 0);
      localStorage.setItem("bscPoint", String(localPoint + pointReward));

      const clearedList = JSON.parse(localStorage.getItem("bscCleared") || "[]");
      if (!clearedList.includes(chapterData.id)) {
        localStorage.setItem(
          "bscCleared",
          JSON.stringify([...clearedList, chapterData.id])
        );
      }

      if (badgeName) {
        const localBadges = JSON.parse(localStorage.getItem("bscBadge") || "[]");
        if (!localBadges.includes(badgeName)) {
          localStorage.setItem("bscBadge", JSON.stringify([...localBadges, badgeName]));
        }
      }

      Object.keys(bond).forEach((key) => {
        const now = Number(localStorage.getItem(`bscBond_${key}`) || 0);
        localStorage.setItem(`bscBond_${key}`, String(Math.min(now + bond[key], 100)));
      });
    }

    if (user) {
      const ref = doc(db, "bsc_users", user.uid);

      const updateData = {
        point: increment(pointReward),
        cleared: arrayUnion(chapterData.id),
        updatedAt: new Date(),
      };

      if (badgeName) updateData.badges = arrayUnion(badgeName);

      Object.keys(bond).forEach((key) => {
        updateData[`bonds.${key}`] = increment(bond[key]);
      });

      await updateDoc(ref, updateData);
    }

    setRewarded(true);
    setReaction("reward");
  };

  return (
    <main className="chapterGamePage">
      <style>{`
        .chapterGamePage {
          min-height: 100vh;
          padding: 8px 10px 100px;
          background:
            radial-gradient(circle at top, rgba(255,215,104,.35), transparent 35%),
            linear-gradient(180deg, #eaf8ff 0%, #fff7df 70%, #fff1c8 100%);
          overflow-x: clip;
        }

        .fixedGameTop {
  position: sticky;
  top: 0;
  z-index: 999;
  max-width: 640px;
  margin: 0 auto 12px;
  padding: 6px 0 8px;
  background: linear-gradient(180deg, #eaf8ff 0%, rgba(234,248,255,.96) 75%, rgba(234,248,255,0) 100%);
  }

        .statusFrame {
          position: relative;
          width: 100%;
          height: 72px;
          overflow: hidden;
          border-radius: 12px;
        }

        .statusFrame img {
          width: 100%;
          height: 100%;
          object-fit: fill;
          display: block;
        }

        .statusOverlay {
          position: absolute;
          inset: 0;
          display: grid;
          grid-template-columns: 1fr 1.1fr 1fr;
          align-items: center;
          gap: 6px;
          padding: 8px 18px;
          color: #fff;
          font-weight: 900;
          text-shadow: 0 2px 4px rgba(0,0,0,.75);
        }

        .statusLogo {
          font-size: 12px;
          line-height: 1.1;
          color: #ffd768;
        }

        .statusCenter {
          text-align: center;
        }

        .statusLevel {
          font-size: 18px;
          color: #fff;
        }

        .expBar {
          height: 10px;
          margin-top: 5px;
          border-radius: 999px;
          background: rgba(0,0,0,.55);
          border: 1px solid rgba(255,255,255,.45);
          overflow: hidden;
        }

        .expFill {
          height: 100%;
          background: linear-gradient(90deg, #06c755, #ffd768);
        }

        .statusRight {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 4px;
          font-size: 12px;
          text-align: center;
        }

        .miniStatus {
          padding: 4px 6px;
          border-radius: 999px;
          background: rgba(0,0,0,.35);
          border: 1px solid rgba(255,215,104,.55);
        }

        .chapterInfo {
          margin-top: 6px;
          padding: 8px 10px;
          border-radius: 16px;
          background: rgba(255,255,255,.92);
          border: 2px solid #ffd768;
          box-shadow: 0 8px 18px rgba(0,0,0,.18);
        }

        .chapterInfoTop {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .backBtn {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          background: #17345c;
          color: #fff;
          display: grid;
          place-items: center;
          text-decoration: none;
          font-weight: 900;
        }

        .chapterText {
          flex: 1;
          text-align: center;
          color: #17345c;
          font-weight: 900;
        }

        .chapterText span {
          display: block;
          font-size: 11px;
          color: #ff4f93;
        }

        .chapterText h1 {
          margin: 1px 0 0;
          font-size: 15px;
        }

        .progressText {
          color: #17345c;
          font-size: 12px;
          font-weight: 900;
        }

        .gameProgress {
          margin-top: 6px;
          height: 8px;
          border-radius: 999px;
          background: #d8e5f6;
          overflow: hidden;
        }

        .gameProgress span {
          display: block;
          height: 100%;
          background: linear-gradient(90deg,#06c755,#ffd768);
        }

        .heroArea {
  margin-top: 6px;
  padding: 12px;
  border-radius: 22px;

  background:
    linear-gradient(
      rgba(0,0,0,.15),
      rgba(0,0,0,.15)
    ),
    url("/bsc/084A6245-60BC-43B8-9CA2-CF700D7FC24E.png");

  background-size: cover;
  background-position: center;

  border: 2px solid #ffd768;
  box-shadow: 0 10px 24px rgba(0,0,0,.18);

  position: relative;
  overflow: hidden;

  min-height: 230px;

  display: flex;
  align-items: flex-end;
}

.heroCharacter {
  position: absolute;
  left: -18px;
  bottom: -10px;
  width: 165px;
  height: 165px;
  object-fit: contain;
  border: none;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  z-index: 2;
  animation: charFloat 2.2s ease-in-out infinite;
}

.heroName {
  position: absolute;
  left: 118px;
  top: 34px;
  z-index: 3;
  display: inline-block;
  padding: 7px 18px;
  border-radius: 999px;
  background: #17345c;
  color: #fff;
  font-weight: 900;
  box-shadow: 0 8px 16px rgba(0,0,0,.2);
}

.heroReaction {
  margin-left: 130px;
  width: calc(100% - 130px);
  padding: 18px 16px;
  border-radius: 22px;
  background: rgba(255,255,255,.96);
  color: #17345c;
  font-weight: 900;
  font-size: 16px;
  line-height: 1.7;
  min-height: 70px;
  display: grid;
  place-items: center;
  text-align: center;
  box-shadow: 0 8px 20px rgba(0,0,0,.12);
}

        .chatArea {
  max-width: 640px;
  margin: 0 auto;
  display: grid;
  gap: 14px;
  padding-top: 8px;
}

        .chatRow {
          display: flex;
          align-items: flex-end;
          gap: 8px;
          animation: chatIn .25s ease-out;
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

        .quizFrame {
          position: relative;
          margin: 0 auto;
          width: 100%;
          max-width: 640px;
          min-height: 330px;
          animation: questionIn .28s ease-out;
        }

        .quizFrameBg {
          width: 100%;
          height: 100%;
          min-height: 330px;
          object-fit: fill;
          display: block;
        }

        .quizContent {
          position: absolute;
          inset: 70px 26px 26px;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        .quizQuestion {
          color: #17345c;
          font-size: 18px;
          font-weight: 900;
          text-align: center;
          line-height: 1.55;
          margin-bottom: 18px;
        }

        .quizChoices {
          display: grid;
          gap: 10px;
        }

        .quizChoices button {
          border: 0;
          border-radius: 18px;
          padding: 13px;
          background: linear-gradient(135deg, #ff4f93, #f6a800);
          color: #fff;
          font-size: 15px;
          font-weight: 900;
          box-shadow: 0 5px 0 rgba(120,80,0,.55);
        }

        .quizChoices button.correct {
          background: #06c755;
          box-shadow: 0 5px 0 #038b3d;
        }

        .quizChoices button.wrong {
          background: #ff5252;
          box-shadow: 0 5px 0 #b52222;
        }

        .reactionOverlay {
          position: fixed;
          inset: 0;
          z-index: 90;
          display: grid;
          place-items: center;
          pointer-events: none;
          animation: overlayPop .75s ease-out forwards;
        }

        .reactionText {
          padding: 22px 30px;
          border-radius: 28px;
          background: rgba(255,255,255,.96);
          border: 4px solid #ffd768;
          color: #ff4f93;
          font-size: 32px;
          font-weight: 900;
          box-shadow: 0 20px 50px rgba(0,0,0,.28);
        }

        .resultScreen {
          max-width: 640px;
          margin: 18px auto 0;
          padding: 24px 18px;
          border-radius: 34px;
          background: rgba(255,255,255,.98);
          border: 4px solid #ffd768;
          box-shadow: 0 20px 50px rgba(0,0,0,.28);
          text-align: center;
          animation: resultIn .45s ease-out;
        }

        .resultScreen h2 {
          margin: 0;
          color: #ff4f93;
          font-size: 34px;
          font-weight: 900;
        }

        .resultStars {
          font-size: 32px;
          margin: 12px 0;
          animation: starPulse 1.2s infinite;
        }

        .resultChapter {
          color: #17345c;
          font-size: 20px;
          font-weight: 900;
        }

        .rewardBox {
          margin: 16px 0;
          padding: 16px;
          border-radius: 24px;
          background: #fff7df;
          border: 2px solid #ffd768;
          color: #17345c;
          font-weight: 900;
          text-align: left;
        }

        .resultActions {
          display: grid;
          gap: 10px;
        }

        .resultActions button,
        .resultActions a {
          display: block;
          border: 0;
          border-radius: 18px;
          padding: 14px;
          text-decoration: none;
          color: #fff;
          font-weight: 900;
          background: linear-gradient(135deg, #ff4f93, #f6a800);
        }

        .resultActions a {
          background: #17345c;
        }

        @keyframes charFloat {
          0%,100% { transform: translateY(0) rotate(-1deg); }
          50% { transform: translateY(-7px) rotate(1deg); }
        }

        @keyframes chatIn {
          from { opacity: 0; transform: translateY(10px) scale(.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        @keyframes questionIn {
          from { opacity: 0; transform: scale(.94); }
          to { opacity: 1; transform: scale(1); }
        }

        @keyframes overlayPop {
          0% { opacity: 0; transform: scale(.7); }
          20% { opacity: 1; transform: scale(1); }
          80% { opacity: 1; transform: scale(1.05); }
          100% { opacity: 0; transform: scale(1.2); }
        }

        @keyframes resultIn {
          from { opacity: 0; transform: translateY(20px) scale(.94); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        @keyframes starPulse {
          0%,100% { transform: scale(1); }
          50% { transform: scale(1.12); }
        }
      `}</style>

      {reaction === "correct" && (
        <div className="reactionOverlay">
          <div className="reactionText">CORRECT!! ✨</div>
        </div>
      )}

      {reaction === "wrong" && (
        <div className="reactionOverlay">
          <div className="reactionText">惜しい!!</div>
        </div>
      )}

      {reaction === "reward" && (
        <div className="reactionOverlay">
          <div className="reactionText">REWARD GET!! 🎁</div>
        </div>
      )}

      <section className="fixedGameTop">
        <div className="statusFrame">
          <img src="/bsc/IMG_6252.jpeg" alt="" />

          <div className="statusOverlay">
            <div className="statusLogo">
              BOAT<br />STRIKERS
            </div>

            <div className="statusCenter">
              <div className="statusLevel">Lv.{level}</div>
              <div className="expBar">
                <div className="expFill" style={{ width: `${exp}%` }} />
              </div>
            </div>

            <div className="statusRight">
              <div className="miniStatus">❤️ {bondValue}%</div>
              <div className="miniStatus">⭐ {point}</div>
              <div className="miniStatus">🏅 {badges.length}</div>
              <div className="miniStatus">{showResult ? "CLEAR" : `${progress}%`}</div>
            </div>
          </div>
        </div>

        <div className="chapterInfo">
          <div className="chapterInfoTop">
            <a className="backBtn" href={`/bsc2/${chapterData.area || "beginner"}`}>
              ←
            </a>

            <div className="chapterText">
              <span>{chapterData.title}</span>
              <h1>{chapterData.subtitle}</h1>
            </div>

            <b className="progressText">{showResult ? "CLEAR" : `${progress}%`}</b>
          </div>

          <div className="gameProgress">
            <span style={{ width: showResult ? "100%" : `${progress}%` }} />
          </div>
        </div>

        <div className="heroArea">
          <img className="heroCharacter" src={currentChar.image} alt={currentChar.name} />
          <div className="heroName">
            {currentChar.icon} {currentChar.name}
          </div>

          <div className="heroReaction">
            {reaction === "correct"
              ? "すごーーい！大正解✨"
              : reaction === "wrong"
              ? "惜しい！でも大丈夫😊"
              : reaction === "clear"
              ? "クリアおめでとう🎉"
              : "一緒に進めていこう♪"}
          </div>
        </div>
      </section>

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

        {showResult && (
          <div className="resultScreen">
            <h2>MISSION CLEAR!</h2>
            <div className="resultStars">★★★★★</div>
            <p className="resultChapter">{chapterData.title} Complete!</p>

            <div className="rewardBox">
              <p>⭐ ポイント +{chapterData.reward?.point || 0}</p>
              <p>
                {chapterData.reward?.badge?.icon || "🏅"} バッジ：
                {chapterData.reward?.badge?.name || "クリアバッジ"}
              </p>
              <p>
                ❤️ 親密度 +{chapterData.reward?.bond?.[chapterData.teacher] || 0}
              </p>
              <p>🔓 次のチャプター解放！</p>
            </div>

            <div className="resultActions">
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

function QuizMessage({ message, quizKey, selected, answeredQuizId, onAnswer }) {
  const isAnswered = answeredQuizId === quizKey;

  return (
    <div className="quizFrame">
      <img src="/bsc/IMG_6254.jpeg" alt="" className="quizFrameBg" />

      <div className="quizContent">
        <div className="quizQuestion">{message.question}</div>

        <div className="quizChoices">
          {message.choices.map((choice, index) => {
            let className = "";

            if (isAnswered && index === message.answer) className = "correct";
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
      </div>
    </div>
  );
}
