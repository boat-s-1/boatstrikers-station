"use client";

import { useState } from "react";

export default function LessonClient({ lesson }) {
  const [answers, setAnswers] = useState({});
  const [finished, setFinished] = useState(false);

  const correctCount = lesson.questions.filter(
    (q, index) => answers[index] === q.answer
  ).length;

  const allAnswered = Object.keys(answers).length === lesson.questions.length;
  const passed = allAnswered && correctCount === lesson.questions.length;

  const handleClear = () => {

  // ポイント
  const point = Number(localStorage.getItem("bscPoint") || 0);
  localStorage.setItem("bscPoint", point + 20);

  // Missionクリア
  const missions = JSON.parse(
    localStorage.getItem("bscMission") || "[]"
  );

  if (!missions.includes(lesson.id)) {
    missions.push(lesson.id);

    localStorage.setItem(
      "bscMission",
      JSON.stringify(missions)
    );
  }

  // バッジ
  const badges = JSON.parse(
    localStorage.getItem("bscBadge") || "[]"
  );

  if (!badges.includes(lesson.badge)) {

    badges.push(lesson.badge);

    localStorage.setItem(
      "bscBadge",
      JSON.stringify(badges)
    );

  }

  setFinished(true);

};

    setFinished(true);
  };

  return (
    <main className="libraryPage">
      <header className="header">
        <div className="logo">
          BOAT<br />
          <span>STRIKERS</span>
        </div>
        <a className="lineMini" href="https://lin.ee/Pf3FEEQ">
          LINE登録
        </a>
      </header>

      <section className="bscLessonHero">
        <span>Mission {lesson.id}</span>
        <h1>{lesson.title}</h1>
        <p>{lesson.character} からの挑戦！</p>
      </section>

      <section className="librarySection">
        <h2>📖 まずは学ぼう</h2>
        <p className="bscLessonText">{lesson.text}</p>
      </section>

      <section className="librarySection">
        <h2>📝 BSCチャレンジ</h2>

        <div className="bscQuizList">
          {lesson.questions.map((q, qIndex) => (
            <div className="bscQuizBox" key={q.question}>
              <h3>Q{qIndex + 1}. {q.question}</h3>

              <div className="bscChoices">
                {q.choices.map((choice, cIndex) => (
                  <button
                    type="button"
                    key={choice}
                    onClick={() =>
                      setAnswers({
                        ...answers,
                        [qIndex]: cIndex,
                      })
                    }
                    className={
                      answers[qIndex] === cIndex ? "selectedChoice" : ""
                    }
                  >
                    {choice}
                  </button>
                ))}
              </div>

              {answers[qIndex] !== undefined && (
                <p className="bscResultText">
                  {answers[qIndex] === q.answer ? "正解！" : "もう一度考えてみよう"}
                </p>
              )}
            </div>
          ))}
        </div>

        {allAnswered && !passed && (
          <div className="bscFailed">
            <h3>惜しい！</h3>
            <p>もう一度読み直して挑戦してみよう。</p>
          </div>
        )}

        {passed && !finished && (
          <button className="bscClearBtn" onClick={handleClear}>
            MISSION CLEAR！
          </button>
        )}

        {finished && (
          <div className="bscClearBox">
            <h2>🎉 CLEAR!</h2>
            <p>+20pt 獲得！</p>
            <strong>🏅 {lesson.badge} GET!</strong>
            <a href="/bsc">次のミッションへ ›</a>
          </div>
        )}
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
