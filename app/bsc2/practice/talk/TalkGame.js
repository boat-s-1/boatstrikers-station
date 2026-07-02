"use client";

import { useMemo, useState } from "react";

export default function TalkGame({ characterData }) {
  const questions = characterData?.questions || [];

  const [index, setIndex] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [selected, setSelected] = useState(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [earnedPoint, setEarnedPoint] = useState(0);
  const [finished, setFinished] = useState(false);

  const current = questions[index];

  const characterKey = useMemo(() => {
    if (!characterData?.bondKey) return "";
    return characterData.bondKey.replace("bscBond_", "");
  }, [characterData]);

  const characterImage = `/bsc/status-${characterKey}.png`;

  const answer = (choiceIndex) => {
    if (answered) return;

    const isCorrect = choiceIndex === current.answer;
    const addPoint = isCorrect ? current.point || 5 : 0;

    setSelected(choiceIndex);
    setAnswered(true);

    if (isCorrect) {
      setCorrectCount((prev) => prev + 1);
      setEarnedPoint((prev) => prev + addPoint);

      const point = Number(localStorage.getItem("bscPoint") || 0);
      localStorage.setItem("bscPoint", String(point + addPoint));

      const bond = Number(localStorage.getItem(characterData.bondKey) || 0);
      localStorage.setItem(
        characterData.bondKey,
        String(Math.min(bond + 3, 100))
      );
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
      <section className="talkResult">
        <span>RESULT</span>
        <h2>{perfect ? "PERFECT!!" : "CLEAR!!"}</h2>

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
    <section className="talkGameBox">
      <div className="talkGameHeader">
        <div className={`talkCharacterFace ${answered ? (selected === current.answer ? "happy" : "sad") : "idle"}`}>
  <img src={characterImage} alt={characterData.name} />
  <span className="talkBlink" />
  <span className="talkSparkle">✨</span>
</div>

        <div>
          <span>
            {characterData.icon} {characterData.name}
          </span>
          <h2>{characterData.theme}</h2>
          <p>
            Question {index + 1} / {questions.length}
          </p>
        </div>
      </div>

      <div className="talkBubble">
        <strong>{characterData.name}</strong>
        <p>{current.talk}</p>
      </div>

      <div className="talkQuestion">
        <span>QUESTION</span>
        <h3>{current.question}</h3>
      </div>

      <div className="talkChoices">
        {current.choices.map((choice, choiceIndex) => {
          const isCorrectChoice = choiceIndex === current.answer;
          const isSelected = selected === choiceIndex;

          let className = "";

          if (answered && isCorrectChoice) className = "correct";
          if (answered && isSelected && !isCorrectChoice) className = "wrong";

          return (
            <button
              type="button"
              key={choice}
              className={className}
              onClick={() => answer(choiceIndex)}
              disabled={answered}
            >
              {choice}
            </button>
          );
        })}
      </div>

      {answered && (
        <div className="talkAnswerBox">
          <h3>
            {selected === current.answer ? "🎉 正解！" : "💡 解説"}
          </h3>

          <p>
            {selected === current.answer ? current.correct : current.wrong}
          </p>

          {selected === current.answer && (
            <div className="talkRewardMini">⭐ +{current.point || 5}pt</div>
          )}

          <button type="button" onClick={next}>
            {index + 1 >= questions.length ? "リザルトへ ▶" : "次の問題へ ▶"}
          </button>
        </div>
      )}
    </section>
  );
}
