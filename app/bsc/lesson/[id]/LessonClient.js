"use client";

import { useEffect, useState } from "react";

export default function LessonClient({ lesson }) {
  const [answers, setAnswers] = useState({});
  const [finished, setFinished] = useState(false);
  const [alreadyCleared, setAlreadyCleared] = useState(false);

  useEffect(() => {
    const missions = JSON.parse(localStorage.getItem("bscMission") || "[]");
    setAlreadyCleared(missions.includes(lesson.id));
  }, [lesson.id]);

  const correctCount = lesson.questions.filter(
    (q, index) => answers[index] === q.answer
  ).length;

  const allAnswered = Object.keys(answers).length === lesson.questions.length;
  const passed = allAnswered && correctCount === lesson.questions.length;

  const handleClear = () => {
    const missions = JSON.parse(localStorage.getItem("bscMission") || "[]");

    // すでにクリア済みならポイント加算しない
    if (missions.includes(lesson.id)) {
      setAlreadyCleared(true);
      setFinished(true);
      return;
    }

    const point = Number(localStorage.getItem("bscPoint") || 0);
    localStorage.setItem("bscPoint", point + 20);

    missions.push(lesson.id);
    localStorage.setItem("bscMission", JSON.stringify(missions));

    const badges = JSON.parse(localStorage.getItem("bscBadge") || "[]");

    if (!badges.includes(lesson.badge)) {
      badges.push(lesson.badge);
      localStorage.setItem("bscBadge", JSON.stringify(badges));
    }

    setAlreadyCleared(true);
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

        {alreadyCleared && <b className="bscClearedBadge">✅ CLEAR済み</b>}
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
              <h3>
                Q{qIndex + 1}. {q.question}
              </h3>

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
                  {answers[qIndex] === q.answer
                    ? "正解！"
                    : "もう一度考えてみよう"}
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
          <button type="button" className="bscClearBtn" onClick={handleClear}>
            {alreadyCleared ? "✅ CLEAR済み" : "MISSION CLEAR！"}
          </button>
        )}

        {finished && (
          <div className="bscClearBox">
            <h2>{alreadyCleared ? "✅ CLEAR済み" : "🎉 CLEAR!"}</h2>
            <p>
              {alreadyCleared
                ? "このMissionはすでにクリア済みです。復習ありがとう！"
                : "+20pt 獲得！"}
            </p>
            <strong>🏅 {lesson.badge}</strong>
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
