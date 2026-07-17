"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useParams } from "next/navigation";

import { racecourses } from "../../data/racecourses";
import { getCourseRaces } from "../../data/raceSchedule";

import "./course.css";

const BOAT_COLORS = {
  1: "boat1",
  2: "boat2",
  3: "boat3",
  4: "boat4",
  5: "boat5",
  6: "boat6",
};

function getRaceTypeLabel(type) {
  if (type === "night") return "ナイター";
  if (type === "morning") return "モーニング";
  return "デイ";
}

function getGradeClass(grade) {
  if (grade === "SG") return "gradeBadge sg";
  if (grade === "G1") return "gradeBadge g1";
  if (grade === "G2") return "gradeBadge g2";
  if (grade === "G3") return "gradeBadge g3";

  return "gradeBadge general";
}

function getStatusInfo(status) {
  if (status === "closed") {
    return {
      label: "締切",
      className: "closed",
    };
  }

  if (status === "soon") {
    return {
      label: "まもなく締切",
      className: "soon",
    };
  }

  return {
    label: "発売中",
    className: "before",
  };
}

function RaceCard({ race, courseCode }) {
  const statusInfo = getStatusInfo(race.status);

  const mainRacer = race.racers[0];

  return (
    <article
      className={`raceCard ${statusInfo.className}`}
      id={`race-${race.raceNo}`}
    >
      <div className="raceCardHeader">
        <div className="raceNumberBox">
          <strong>{race.raceNo}</strong>
          <span>R</span>
        </div>

        <div className="raceTitleArea">
          <h2>{race.raceName}</h2>

          <div className="raceDeadline">
            <span>締切予定</span>
            <strong>{race.deadline}</strong>
          </div>
        </div>

        <span className={`raceStatus ${statusInfo.className}`}>
          {statusInfo.label}
        </span>
      </div>

      <div className="racerMiniList">
        {race.racers.map((racer) => (
          <div className="racerMiniRow" key={racer.boatNo}>
            <span
              className={`boatNumber ${BOAT_COLORS[racer.boatNo]}`}
            >
              {racer.boatNo}
            </span>

            <div className="racerMiniMain">
              <div className="racerNameRow">
                <strong>{racer.name}</strong>
                <span className={`classBadge ${racer.className.toLowerCase()}`}>
                  {racer.className}
                </span>
              </div>

              <div className="racerStats">
                <span>
                  全国
                  <b>{racer.nationalRate.toFixed(2)}</b>
                </span>

                <span>
                  当地
                  <b>{racer.localRate.toFixed(2)}</b>
                </span>

                <span>
                  ST
                  <b>{racer.averageStart.toFixed(2)}</b>
                </span>
              </div>
            </div>

            {racer.boatNo === 1 && race.predictions.ichika && (
              <span className="ichikaMark">一果◎</span>
            )}
          </div>
        ))}
      </div>

      <div className="predictionArea">
        <div className="predictionHeader">
          <span>BOAT STRIKERS AI</span>
          <strong>注目情報</strong>
        </div>

        <div className="predictionTags">
          {race.predictions.ichika && (
            <span className="predictionTag ichika">
              🍊 一果
              {race.ichikaScore && (
                <b>イン逃げ {race.ichikaScore}%</b>
              )}
            </span>
          )}

          {race.predictions.hatsune && (
            <span className="predictionTag hatsune">
              🌸 初音
              <b>女子戦注目</b>
            </span>
          )}

          {race.predictions.kiina && (
            <span className="predictionTag kiina">
              ⭐ キイナ
              {race.kiinaScore && (
                <b>穴期待 {race.kiinaScore}%</b>
              )}
            </span>
          )}

          {!race.predictions.ichika &&
            !race.predictions.hatsune &&
            !race.predictions.kiina && (
              <span className="noPrediction">
                AI注目情報はありません
              </span>
            )}
        </div>
      </div>

      <div className="raceActionGrid">
       <Link
  href={`/races/${courseCode}/${race.raceNo}?tab=basic`}
  className="raceActionButton entry"
>
  <span className="actionIcon">📋</span>

  <span>
    <small>基本情報</small>
    出走表
  </span>
</Link>

<Link
  href={`/races/${courseCode}/${race.raceNo}?tab=previous`}
  className="raceActionButton previous"
>
  <span className="actionIcon">📰</span>

  <span>
    <small>AI予想</small>
    前日版
  </span>
</Link>

<Link
  href={`/races/${courseCode}/${race.raceNo}?tab=live`}
  className="raceActionButton live"
>
  <span className="actionIcon">⚡</span>

  <span>
    <small>展示後更新</small>
    直前版
  </span>
</Link>
      </div>

      <div className="raceCardFooter">
        <span>
          1号艇
          <strong>{mainRacer.name}</strong>
        </span>

        <Link href={`/races/${courseCode}/${race.raceNo}`}>
          レース詳細を見る →
        </Link>
      </div>
    </article>
  );
}

export default function CourseRacePage() {
  const params = useParams();

  const courseCode = String(params?.courseCode || "").padStart(2, "0");

  const [displayMode, setDisplayMode] = useState("card");
  const [raceFilter, setRaceFilter] = useState("all");

  const course = useMemo(() => {
    return racecourses.find((item) => item.code === courseCode);
  }, [courseCode]);

  const races = useMemo(() => {
    return getCourseRaces(courseCode);
  }, [courseCode]);

  const displayedRaces = useMemo(() => {
    if (raceFilter === "pickup") {
      return races.filter(
        (race) =>
          race.predictions.ichika ||
          race.predictions.hatsune ||
          race.predictions.kiina
      );
    }

    if (raceFilter === "available") {
      return races.filter((race) => race.status !== "closed");
    }

    return races;
  }, [races, raceFilter]);

  if (!course) {
    return (
      <main className="coursePage">
        <section className="courseNotFound">
          <div className="notFoundIcon">🚤</div>
          <h1>開催場が見つかりません</h1>
          <p>開催場コードを確認してください。</p>

          <Link href="/races">
            開催場一覧へ戻る
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="coursePage">
      <header className={`courseHero ${course.raceType}`}>
        <div className="courseHeroInner">
          <Link href="/races" className="backLink">
            ← 開催場一覧
          </Link>

          <div className="courseHeroMain">
            <div>
              <p className="heroEnglish">
                BOAT RACE {course.code}
              </p>

              <div className="courseTitleRow">
                <h1>{course.name}</h1>

                <span className={getGradeClass(course.grade)}>
                  {course.grade || "一般"}
                </span>
              </div>

              <div className="courseMeta">
                <span>{course.dayText}</span>
                <span>{getRaceTypeLabel(course.raceType)}</span>
                <span>全12レース</span>
              </div>
            </div>

            <div className="courseHeroIcon">
              {course.raceType === "night" ? "🌙" : "🚤"}
            </div>
          </div>

          <div className="courseTimeBar">
            <div>
              <span>1R</span>
              <strong>{course.firstRaceTime}</strong>
            </div>

            <span className="timeArrow">→</span>

            <div>
              <span>12R</span>
              <strong>{course.lastRaceTime}</strong>
            </div>
          </div>
        </div>
      </header>

      <nav className="raceNumberNavigation">
        <div className="raceNumberNavigationInner">
          {races.map((race) => (
            <a
              href={`#race-${race.raceNo}`}
              className={`raceNumberLink ${race.status}`}
              key={race.raceNo}
            >
              <strong>{race.raceNo}</strong>
              <span>R</span>
            </a>
          ))}
        </div>
      </nav>

      <section className="courseContent">
        <div className="courseIntro">
          <div>
            <p className="sectionEnglish">TODAY&apos;S RACES</p>
            <h2>本日のレース一覧</h2>
            <p>
              出走表・前日版・展示後の直前版を確認できます。
            </p>
          </div>

          <span className="raceCount">
            {displayedRaces.length}レース
          </span>
        </div>

        <div className="raceControls">
          <div className="filterTabs">
            <button
              type="button"
              className={raceFilter === "all" ? "active" : ""}
              onClick={() => setRaceFilter("all")}
            >
              全レース
            </button>

            <button
              type="button"
              className={raceFilter === "available" ? "active" : ""}
              onClick={() => setRaceFilter("available")}
            >
              発売中
            </button>

            <button
              type="button"
              className={raceFilter === "pickup" ? "active" : ""}
              onClick={() => setRaceFilter("pickup")}
            >
              AI注目
            </button>
          </div>

          <div className="displayButtons">
            <button
              type="button"
              className={displayMode === "card" ? "active" : ""}
              onClick={() => setDisplayMode("card")}
              aria-label="カード表示"
            >
              ▦
            </button>

            <button
              type="button"
              className={displayMode === "compact" ? "active" : ""}
              onClick={() => setDisplayMode("compact")}
              aria-label="コンパクト表示"
            >
              ☰
            </button>
          </div>
        </div>

        {displayedRaces.length > 0 ? (
          <div className={`raceList ${displayMode}`}>
            {displayedRaces.map((race) => (
              <RaceCard
                race={race}
                courseCode={courseCode}
                key={race.raceNo}
              />
            ))}
          </div>
        ) : (
          <div className="emptyRaceBox">
            <span>🔍</span>
            <h3>該当するレースがありません</h3>
            <p>別の絞り込み条件を選択してください。</p>
          </div>
        )}
      </section>

      <div className="courseBottomNav">
        <Link href="/races">
          <span>🚩</span>
          <small>開催場</small>
        </Link>

        <a href="#race-1">
          <span>📋</span>
          <small>レース一覧</small>
        </a>

        <Link href="/">
          <span>🏠</span>
          <small>ホーム</small>
        </Link>
      </div>
    </main>
  );
}
