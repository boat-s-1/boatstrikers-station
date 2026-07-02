"use client";

import { useMemo, useState } from "react";
import TypeWriter from "./TypeWriter";
import CharacterStage from "./CharacterStage";

export default function TalkGame({ characterData }) {
  const questions = characterData?.questions || [];

  const [index, setIndex] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [selected, setSelected] = useState(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [earnedPoint, setEarnedPoint] = useState(0);
  const [finished, setFinished] = useState(false);
  const [combo, setCombo] = useState(0);

  const current = questions[index];

  const characterKey = useMemo(() => {
    if (!characterData?.bondKey) return "ichika";
    return characterData.bondKey.replace("bscBond_", "");
  }, [characterData]);

  const characterImage = `/bsc/status-${characterKey}.png`;

  const isCorrect = answered && selected === current?.answer;
  const isWrong = answered && selected !== current?.answer;

  const mood = finished
    ? "happy"
    : isCorrect
    ? "happy"
    : isWrong
    ? "sad"
    : "idle";

  const answer = (choiceIndex) => {
    if (answered) return;

    const correct = choiceIndex === current.answer;
    const addPoint = correct ? current.point || 5 : 0;

    setSelected(choiceIndex);
    setAnswered(true);

    if (correct) {
      setCorrectCount((prev) => prev + 1);
      setEarnedPoint((prev) => prev + addPoint);
      setCombo((prev) => prev + 1);

      const point = Number(localStorage.getItem("bscPoint") || 0);
      localStorage.setItem("bscPoint", String(point + addPoint));

      const bond = Number(localStorage.getItem(characterData.bondKey) || 0);
      localStorage.setItem(
        characterData.bondKey,
        String(Math.min(bond + 3, 100))
      );
    } else {
      setCombo(0);
    }
  };

  const next = () => {
    if (index + 1 >= questions.length) {
      setFinished(true);
      return;
    }

    setIndex((prev) => prev + 1);
    setAnswered(false);
    setSelected(null);
  };

  if (!characterData || questions.length === 0) {
    return (
      <section className="talkGameBox">
        <h2>問題がありません</h2>
        <a href="/bsc2/practice">実践編へ戻る</a>
      </section>
    );
  }

  if (finished) {
    const perfect = correctCount === questions.length;

    return (
      <section className="talkResult v2">
        <div className="resultConfetti">🎉 ✨ 🎊 ✨ 🎉</div>

        <span>RESULT</span>
        <h2>{perfect ? "PERFECT!!" : "CLEAR!!"}</h2>

        <CharacterStage
          characterData={characterData}
          characterImage={characterImage}
          mood="happy"
        />

        <div className="talkResultScore">
          <strong>
            {correctCount} / {questions.length}
          </strong>
          <p>正解数</p>
        </div>

        <div className="talkResultReward">
          <div>
            <b>⭐ +{earnedPoint}pt</b>
            <p>獲得ポイント</p>
          </div>

          <div>
            <b>{characterData.icon} +{correctCount * 3}</b>
            <p>親密度UP</p>
          </div>
        </div>

        <p className="talkResultMessage">
          {characterData.icon} {characterData.name}
          「お疲れ様！また一緒に挑戦しよう♪」
        </p>

        <div className="talkResultButtons">
          <button type="button" onClick={() => location.reload()}>
            もう一回
          </button>
          <a href="/bsc2/practice">実践編へ戻る</a>
          <a href="/bsc2">ホームへ戻る</a>
        </div>
      </section>
    );
  }

  return (
    <section className="talkGameBox v2">
      <CharacterStage
        characterData={characterData}
        characterImage={characterImage}
        mood={mood}
      />

      <div className="talkProgress">
        <span>
          Question {index + 1} / {questions.length}
        </span>
        <b>{combo > 1 ? `🔥 ${combo} COMBO` : characterData.theme}</b>
      </div>

      <div className="talkBubble v2">
        <strong>{characterData.name}</strong>
        <p>
          <TypeWriter text={current.talk} />
        </p>
      </div>

      <div className="talkQuestion v2">
        <span>QUESTION</span>
        <h3>
          <TypeWriter text={current.question} speed={18} />
        </h3>
      </div>

      <div className="talkChoices">
        {current.choices.map((choice, choiceIndex) => {
          const correctChoice = choiceIndex === current.answer;
          const chosen = selected === choiceIndex;

          let className = "";

          if (answered && correctChoice) className = "correct";
          if (answered && chosen && !correctChoice) className = "wrong";

          return (
            <button
              type="button"
              key={choice}
              className={className}
              onClick={() => answer(choiceIndex)}
              disabled={answered}
            >
              <span>{choiceIndex + 1}</span>
              {choice}
            </button>
          );
        })}
      </div>

      {answered && (
        <div className={`talkAnswerBox ${isCorrect ? "correct" : "wrong"}`}>
          <h3>{isCorrect ? "🎉 正解！" : "💡 解説"}</h3>

          <p>{isCorrect ? current.correct : current.wrong}</p>

          {isCorrect && (
            <div className="talkRewardMini">
              ⭐ +{current.point || 5}pt　{characterData.icon} 親密度 +3
            </div>
          )}

          <button type="button" onClick={next}>
            {index + 1 >= questions.length ? "リザルトへ ▶" : "次の問題へ ▶"}
          </button>
        </div>
      )}
    </section>
  );
}
