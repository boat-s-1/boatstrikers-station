"use client";

import Link from "next/link";
import { useCallback } from "react";
import styles from "../phase2.module.css";

function getJstClock() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    date: `${values.year}-${values.month}-${values.day}`,
    minutes: Number(values.hour) * 60 + Number(values.minute),
  };
}

function timeToMinutes(value) {
  const match = String(value || "").match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function normalizeRace(race) {
  return {
    ...race,
    raceNo: Number(race?.raceNo ?? race?.race_no),
    closingTime: race?.closingTime ?? race?.closing_time ?? null,
  };
}

export default function CourseQuickNav({ courseCode, raceDate, races = [] }) {
  const code = String(courseCode).padStart(2, "0");

  const scrollToNextRace = useCallback(() => {
    const clock = getJstClock();
    const sorted = (Array.isArray(races) ? races : [])
      .map(normalizeRace)
      .filter((race) => Number.isFinite(race.raceNo) && race.raceNo > 0)
      .sort((a, b) => a.raceNo - b.raceNo);

    if (!sorted.length) return;

    const timed = sorted
      .map((race) => ({ ...race, minutes: timeToMinutes(race.closingTime) }))
      .filter((race) => race.minutes !== null);

    let targetRace;

    // 当日なら「まだ締切前の最も近いレース」。別日なら1Rへ。
    if (clock.date === raceDate && timed.length) {
      targetRace = timed.find((race) => clock.minutes < race.minutes) || timed.at(-1);
    } else {
      targetRace = timed[0] || sorted[0];
    }

    const target = document.getElementById(`race-card-${targetRace?.raceNo}`);
    if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [raceDate, races]);

  return (
    <nav className={styles.courseQuickNav} aria-label="開催場メニュー">
      <Link href={`/races?date=${raceDate}`} className={styles.courseQuickNavItem}>
        <span>‹</span>
        <b>開催場一覧</b>
      </Link>

      <button type="button" onClick={scrollToNextRace} className={styles.courseQuickNavItem}>
        <span>◎</span>
        <b>直近のレース</b>
      </button>

      <Link href={`/races/${code}/info?date=${raceDate}`} className={styles.courseQuickNavItem}>
        <span>i</span>
        <b>場基本情報</b>
      </Link>

      <Link href={`/races/${code}/newspaper?date=${raceDate}`} className={styles.courseQuickNavItem}>
        <span>▤</span>
        <b>今日の予想新聞</b>
      </Link>
    </nav>
  );
}
