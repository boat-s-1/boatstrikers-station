"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import styles from "./HomeRaceStrip.module.css";

const NIGHT_COURSE_CODES = new Set([1, 7, 12, 15, 19, 20, 24]);
const MORNING_COURSE_CODES = new Set([10, 14, 18, 21, 23]);

function courseType(courseCode) {
  const code = Number(courseCode);
  if (NIGHT_COURSE_CODES.has(code)) return { label: "ナイター", icon: "🌙", key: "night" };
  if (MORNING_COURSE_CODES.has(code)) return { label: "モーニング", icon: "☀️", key: "morning" };
  return { label: "デイ", icon: "☀️", key: "day" };
}

function getJstClock(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    date: `${values.year}-${values.month}-${values.day}`,
    minutes: Number(values.hour) * 60 + Number(values.minute),
  };
}

function timeToMinutes(value) {
  const match = String(value || "").match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;

  return hour * 60 + minute;
}

function statusInfo(course, clock, raceDate) {
  const races = Array.isArray(course.races)
    ? [...course.races].sort((a, b) => Number(a.raceNo) - Number(b.raceNo))
    : [];

  // トップページは当日開催を表示する。万一別日を表示した場合は最初の締切を案内する。
  const currentMinutes = clock.date === raceDate ? clock.minutes : -1;

  const racesWithClosingTime = races
    .map((race) => ({
      ...race,
      closingMinutes: timeToMinutes(race.closingTime),
    }))
    .filter((race) => race.closingMinutes !== null);

  if (racesWithClosingTime.length > 0) {
    const nextRace = racesWithClosingTime.find(
      (race) => currentMinutes < race.closingMinutes
    );

    if (nextRace) {
      const remaining = nextRace.closingMinutes - currentMinutes;
      return {
        label: `${nextRace.raceNo}R ${nextRace.closingTime}`,
        key: remaining >= 0 && remaining <= 5 ? "soon" : "scheduled",
      };
    }

    // 最終レースの締切予定時刻を過ぎたら発売終了。
    return { label: "発売終了", key: "finished" };
  }

  // 締切予定時刻がまだDBに入っていない場合の安全なフォールバック。
  const raceCount = Number(course.raceCount || 0);
  const resultCount = Number(course.resultCount || 0);

  if (raceCount > 0 && resultCount >= raceCount) {
    return { label: "発売終了", key: "finished" };
  }

  const firstUnfinished = races.find((race) => !race.resultAvailable);
  if (firstUnfinished?.raceNo) {
    return { label: `${firstUnfinished.raceNo}Rから`, key: "scheduled" };
  }

  return { label: "出走表公開", key: "scheduled" };
}

export default function HomeRaceStrip({ courses = [], raceDate = "" }) {
  const [clock, setClock] = useState(() => getJstClock());

  useEffect(() => {
    // 締切時刻をまたいだとき、ページ更新なしで次レースへ切り替える。
    const timer = window.setInterval(() => {
      setClock(getJstClock());
    }, 15 * 1000);

    return () => window.clearInterval(timer);
  }, []);

  const visibleCourses = useMemo(
    () => (Array.isArray(courses) ? courses : []),
    [courses]
  );

  if (visibleCourses.length === 0) return null;

  return (
    <section className={styles.section} aria-labelledby="home-race-title">
      <div className={styles.header}>
        <div>
          <p>TODAY&apos;S RACES</p>
          <h2 id="home-race-title">本日の開催場</h2>
        </div>
        <Link href={`/races?date=${raceDate}`} className={styles.allLink}>
          全場を見る <span aria-hidden="true">›</span>
        </Link>
      </div>

      <div className={styles.rail}>
        {visibleCourses.map((course) => {
          const code = String(course.courseCode).padStart(2, "0");
          const type = courseType(course.courseCode);
          const status = statusInfo(course, clock, raceDate);
          const href = `/races/${code}?date=${raceDate}`;

          return (
            <Link
              href={href}
              className={`${styles.card} ${styles[type.key]} ${status.key === "finished" ? styles.finished : ""}`}
              key={course.courseCode}
            >
              <div className={styles.cardTop}>
                <span className={styles.courseNo}>#{code}</span>
                <span className={styles.type}>{type.icon} {type.label}</span>
              </div>
              <strong>{course.courseName}</strong>
              <span className={`${styles.status} ${styles[`status_${status.key}`]}`}>
                {status.label}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
