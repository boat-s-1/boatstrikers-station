"use client";

import { useEffect, useMemo, useState } from "react";
import { doc, updateDoc, arrayUnion, increment } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";

const characterInfo = {
  ichika: { name: "一果", icon: "🌸", img: "/bsc/status-ichika.png" },
  kiina: { name: "キイナ", icon: "⚡", img: "/bsc/status-kiina.png" },
  hatsune: { name: "初音", icon: "💜", img: "/bsc/status-hatsune.png" },
};

export default function ChapterRpgEngine({ chapterData }) {
  const { user } = useAuth();
  const steps = chapterData.steps || [];

  const [stepIndex, setStepIndex] = useState(0);
  const [selected, setSelected] = useState(null);
  const [answered, setAnswered] = useState(false);
  const [clear, setClear] = useState(false);
  const [rewarded, setRewarded] = useState(false);

  const step = steps[stepIndex];
  const char = characterInfo[step?.character] || characterInfo.ichika;

  const progress = Math.round(((stepIndex + 1) / steps.length) * 100);

  const isCorrect =
    step?.type === "quiz" && answered && selected === step.answer;

  useEffect(() => {
    if (!step) return;

    if (step.type === "talk" && step.autoNext) {
      const timer = setTimeout(() => {
        nextStep();
      }, step.delay || 1000);

      return () => clearTimeout(timer);
    }
  }, [stepIndex]);

  const nextStep = () => {
    setSelected(null);
    setAnswered(false);

    if (stepIndex + 1 >= steps.length) {
      setClear(true);
      return;
    }

    setStepIndex((prev) => prev + 1);
  };

  const answerQuiz = (index) => {
    if (answered) return;
    setSelected(index);
    setAnswered(true);
  };

  const receiveReward = async () => {
    if (rewarded) return;

    const reward = chapterData.reward || {};
    const point = reward.point || 0;
    const badgeName = reward.badge?.name;
    const badgeId = reward.badge?.id;

    const localPoint = Number(localStorage.getItem("bscPoint") || 0);
    localStorage.setItem("bscPoint", String(localPoint + point));

    const cleared = JSON.parse(localStorage.getItem("bscCleared") || "[]");
    if (!cleared.includes(chapterData.id)) {
      localStorage.setItem(
        "bscCleared",
        JSON.stringify([...cleared, chapterData.id])
      );
    }

    if (badgeName) {
      const badges = JSON.parse(localStorage.getItem("bscBadge") || "[]");
      if (!badges.includes(badgeName)) {
        localStorage.setItem("bscBadge", JSON.stringify([...badges, badgeName]));
      }
    }

    const bond = reward.bond || {};
    Object.keys(bond).forEach((key) => {
      const now = Number(localStorage.getItem(`bscBond_${key}`) || 0);
      localStorage.setItem(`bscBond_${key}`, String(Math.min(now + bond[key], 100)));
    });

    if (user) {
      const ref = doc(db, "bsc_users", user.uid);

      await updateDoc(ref, {
        point: increment(point),
        cleared: arrayUnion(chapterData.id),
        badges: badgeName ? arrayUnion(badgeName) : arrayUnion(),
        updatedAt: new Date(),
      });
    }

    setRewarded(true);
    alert(`報酬GET！ +${point}pt`);
  };

  if (!step) {
    return (
      <main className="bscPage">
        <section className="bscCard">
          <h1 className="bscTitle">チャプターがありません</h1>
        </section>
      </main>
    );
  }

  if (clear) {
    return (
      <main className="bscPage">
        <section className="bscCard chapterClearBox">
          <h1 className="bscTitle">🎉 MISSION CLEAR!</h1>
          <p className="bscSub">{chapterData.subtitle}</p>

          <div className="clearReward">
            <p>⭐ +{chapterData.reward?.point || 0}pt</p>
            <p>
              {chapterData.reward?.badge?.icon || "🏅"}{" "}
              {chapterData.reward?.badge?.name || "クリアバッジ"}
            </p>
          </div>

          <button
            type="button"
            className="bscBtn bscBtnPrimary"
            onClick={receiveReward}
            disabled={rewarded}
          >
            {rewarded ? "受取済み" : "報酬を受け取る"}
          </button>

          <a href="/bsc2/beginner" className="bscBtn bscBtnGold">
            マップへ戻る
          </a>
        </section>
      </main>
    );
  }

  return (
    <main className="bscPage">
      <style>{`
        .chapterHeader {
          text-align: center;
          margin-bottom: 14px;
          color: white;
        }

        .chapterHeader span {
          font-weight: 900;
          color: #ffd768;
        }

        .chapterProgress {
          height: 12px;
          border-radius: 999px;
          background: rgba(255,255,255,.35);
          overflow: hidden;
          margin-top: 10px;
        }

        .chapterProgress span {
          display: block;
          height: 100%;
          background: linear-gradient(90deg,#06c755,#ffd768);
        }

        .rpgStage {
          position: relative;
          min-height: 260px;
          border-radius: 28px;
          background:
            linear-gradient(180deg,rgba(255,255,255,.92),rgba(232,244,255,.96)),
            radial-gradient(circle at top,#ffd768,transparent 55%);
          border: 3px solid #ffd768;
          box-shadow: 0 16px 34px rgba(0,0,0,.25);
          padding: 18px;
          overflow: hidden;
        }

        .rpgCharacter {
          text-align: center;
          animation: rpgFloat 2s ease-in-out infinite;
        }

        .rpgCharacter img {
          width: 120px;
          height: 120px;
          border-radius: 34px;
          object-fit: cover;
          border: 5px solid #ffd768;
          background: white;
        }

        .rpgName {
          display: inline-block;
          margin-top: 8px;
          padding: 7px 16px;
          border-radius: 999px;
          background: #17345c;
          color: white;
          font-weight: 900;
        }

        .rpgWindow {
          margin-top: 16px;
          padding: 16px;
          border-radius: 22px;
          background: rgba(255,255,255,.96);
          border: 3px solid #17345c;
          color: #17345c;
          font-weight: 900;
          white-space: pre-line;
          line-height: 1.8;
        }

        .quizChoices {
          display: grid;
          gap: 10px;
          margin-top: 14px;
        }

        .quizChoices button {
          border: 0;
          border-radius: 18px;
          padding: 14px;
          background: #17345c;
          color: white;
          font-weight: 900;
        }

        .quizChoices button.correct {
          background: #06c755;
        }

        .quizChoices button.wrong {
          background: #ff5252;
        }

        .answerBox {
          margin-top: 14px;
          padding: 14px;
          border-radius: 20px;
          background: #fff7df;
          border: 2px solid #ffd768;
          color: #17345c;
          font-weight: 900;
          white-space: pre-line;
        }

        .chapterClearBox {
          text-align: center;
        }

        .clearReward {
          margin: 18px 0;
          padding: 16px;
          border-radius: 22px;
          background: #fff7df;
          border: 2px solid #ffd768;
          font-weight: 900;
          color: #17345c;
        }

        @keyframes rpgFloat {
          0%,100% { transform: translateY(0); }
          50% { transform: translateY(-7px); }
        }
      `}</style>

      <header className="chapterHeader">
        <span>{chapterData.title}</span>
        <h1>{chapterData.subtitle}</h1>
        <div className="chapterProgress">
          <span style={{ width: `${progress}%` }} />
        </div>
      </header>

      <section className="rpgStage">
        <div className="rpgCharacter">
          <img src={char.img} alt={char.name} />
          <div className="rpgName">
            {char.icon} {char.name}
          </div>
        </div>

        {step.type === "talk" && (
          <>
            <div className="rpgWindow">{step.text}</div>

            {!step.autoNext && (
              <button
                type="button"
                className="bscBtn bscBtnPrimary"
                onClick={nextStep}
                style={{ marginTop: 14, width: "100%" }}
              >
                次へ ▶
              </button>
            )}
          </>
        )}

        {step.type === "quiz" && (
          <>
            <div className="rpgWindow">{step.question}</div>

            <div className="quizChoices">
              {step.choices.map((choice, index) => {
                let className = "";

                if (answered && index === step.answer) className = "correct";
                if (answered && selected === index && index !== step.answer)
                  className = "wrong";

                return (
                  <button
                    key={choice}
                    type="button"
                    className={className}
                    onClick={() => answerQuiz(index)}
                    disabled={answered}
                  >
                    {choice}
                  </button>
                );
              })}
            </div>

            {answered && (
              <div className="answerBox">
                {isCorrect ? step.correctText : step.wrongText}

                <button
                  type="button"
                  className="bscBtn bscBtnPrimary"
                  onClick={nextStep}
                  style={{ marginTop: 14, width: "100%" }}
                >
                  次へ ▶
                </button>
              </div>
            )}
          </>
        )}

        {step.type === "clear" && (
          <>
            <div className="rpgWindow">{step.text}</div>
            <button
              type="button"
              className="bscBtn bscBtnPrimary"
              onClick={() => setClear(true)}
              style={{ marginTop: 14, width: "100%" }}
            >
              クリア画面へ ▶
            </button>
          </>
        )}
      </section>
    </main>
  );
}
