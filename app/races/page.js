"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { racecourses } from "../data/racecourses";
import "./races.css";

function getRaceTypeLabel(type) {
  switch (type) {
    case "night":
      return "ナイター";
    case "morning":
      return "モーニング";
    default:
      return "デイ";
  }
}

function getGradeClass(grade) {
  if (grade === "SG") return "grade sg";
  if (grade === "G1") return "grade g1";
  if (grade === "G2") return "grade g2";
  if (grade === "G3") return "grade g3";
  return "grade general";
}

export default function RacesPage() {
  const [filter, setFilter] = useState("open");
  const [showClosed, setShowClosed] = useState(false);

  const todayText = useMemo(() => {
    return new Intl.DateTimeFormat("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "short",
    }).format(new Date());
  }, []);

  const openCourses = useMemo(() => {
    return racecourses.filter((course) => {
      if (!course.isOpen) return false;

      if (filter === "night") {
        return course.raceType === "night";
      }

      if (filter === "morning") {
        return course.raceType === "morning";
      }

      return true;
    });
  }, [filter]);

  const closedCourses = racecourses.filter((course) => !course.isOpen);

  return (
    <main className="racesPage">
      <section className="racesHero">
        <div className="racesHeroInner">
          <div className="heroIcon">🚤</div>

          <div>
            <p className="heroSub">BOAT STRIKERS</p>
            <h1>本日のボートレース</h1>
            <p className="todayText">{todayText}</p>
          </div>
        </div>

        <p className="heroMessage">
          開催場を選んで、出走表やAI新聞をチェックしよう！
        </p>
      </section>

      <section className="filterSection">
        <div className="filterButtons">
          <button
            type="button"
            className={filter === "open" ? "filterButton active" : "filterButton"}
            onClick={() => setFilter("open")}
          >
            🔥 開催中
          </button>

          <button
            type="button"
            className={
              filter === "night" ? "filterButton active" : "filterButton"
            }
            onClick={() => setFilter("night")}
          >
            🌙 ナイター
          </button>

          <button
            type="button"
            className={
              filter === "morning" ? "filterButton active" : "filterButton"
            }
            onClick={() => setFilter("morning")}
          >
            ☀️ モーニング
          </button>
        </div>
      </section>

      <section className="courseSection">
        <div className="sectionTitleRow">
          <div>
            <p className="sectionMiniTitle">TODAY&apos;S RACE</p>
            <h2>本日の開催場</h2>
          </div>

          <span className="courseCount">{openCourses.length}場</span>
        </div>

        {openCourses.length > 0 ? (
          <div className="courseGrid">
            {openCourses.map((course) => (
              <article
                className={`courseCard ${course.raceType}`}
                key={course.code}
              >
                <div className="courseCardTop">
                  <div>
                    <div className="courseNameRow">
                      <span className="courseNumber">{course.code}</span>
                      <h3>{course.name}</h3>
                    </div>

                    <p className="courseArea">{course.area}</p>
                  </div>

                  <span className="favoriteButton" aria-label="お気に入り">
                    ☆
                  </span>
                </div>

                <div className="badgeRow">
                  <span className={getGradeClass(course.grade)}>
                    {course.grade || "一般"}
                  </span>

                  <span className="dayBadge">{course.dayText}</span>

                  <span className={`raceTypeBadge ${course.raceType}`}>
                    {getRaceTypeLabel(course.raceType)}
                  </span>
                </div>

                <div className="raceTimeBox">
                  <div>
                    <span>1R</span>
                    <strong>{course.firstRaceTime}</strong>
                  </div>

                  <div className="timeDivider" />

                  <div>
                    <span>12R</span>
                    <strong>{course.lastRaceTime}</strong>
                  </div>
                </div>

                <div className="aiPickupBox">
                  <p className="aiPickupTitle">AI注目レース</p>

                  <div className="characterTags">
                    {course.ichikaCount > 0 && (
                      <span className="characterTag ichika">
                        一果 {course.ichikaCount}R
                      </span>
                    )}

                    {course.hatsuneCount > 0 && (
                      <span className="characterTag hatsune">
                        初音 {course.hatsuneCount}R
                      </span>
                    )}

                    {course.kiinaCount > 0 && (
                      <span className="characterTag kiina">
                        キイナ {course.kiinaCount}R
                      </span>
                    )}

                    {course.ichikaCount === 0 &&
                      course.hatsuneCount === 0 &&
                      course.kiinaCount === 0 && (
                        <span className="noPickup">現在解析中</span>
                      )}
                  </div>
                </div>

                <Link
                  href={`/races/${course.code}`}
                  className="courseLinkButton"
                >
                  <span>出走表を見る</span>
                  <span aria-hidden="true">→</span>
                </Link>
              </article>
            ))}
          </div>
        ) : (
          <div className="emptyBox">
            <span>🚤</span>
            <p>該当する開催場はありません。</p>
          </div>
        )}
      </section>

      <section className="closedSection">
        <button
          type="button"
          className="closedToggle"
          onClick={() => setShowClosed((value) => !value)}
        >
          <span>本日非開催のレース場</span>
          <span>{showClosed ? "▲" : "▼"}</span>
        </button>

        {showClosed && (
          <div className="closedGrid">
            {closedCourses.map((course) => (
              <div className="closedCard" key={course.code}>
                <span className="closedNumber">{course.code}</span>

                <div>
                  <strong>{course.name}</strong>
                  <p>{course.status}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
