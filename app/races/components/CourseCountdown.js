"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "../phase2.module.css";

function formatClosingTime(value) {
  if (!value) {
    return "--:--";
  }

  return String(value).slice(0, 5);
}

function formatRemaining(totalSeconds) {
  const safeSeconds = Math.max(
    0,
    Math.floor(totalSeconds)
  );

  const hours = Math.floor(
    safeSeconds / 3600
  );

  const minutes = Math.floor(
    (safeSeconds % 3600) / 60
  );

  const seconds =
    safeSeconds % 60;

  const hourText = String(hours).padStart(
    2,
    "0"
  );

  const minuteText = String(minutes).padStart(
    2,
    "0"
  );

  const secondText = String(seconds).padStart(
    2,
    "0"
  );

  if (hours > 0) {
    return `${hourText}:${minuteText}:${secondText}`;
  }

  return `${minuteText}:${secondText}`;
}

export default function CourseCountdown({
  liveStatus = "scheduled",
  raceCount = 0,
  resultCount = 0,
  nextRaceNo = null,
  nextClosingTime = null,
  nextClosingAt = null,
  liveRaceNo = null,
}) {
  const router = useRouter();
  const refreshDoneRef = useRef(false);

  const initialRemainingSeconds = useMemo(() => {
    if (!nextClosingAt) {
      return null;
    }

    return Math.max(
      0,
      Math.floor(
        (Number(nextClosingAt) - Date.now()) /
          1000
      )
    );
  }, [nextClosingAt]);

  const [
    remainingSeconds,
    setRemainingSeconds,
  ] = useState(initialRemainingSeconds);

  useEffect(() => {
    refreshDoneRef.current = false;

    if (!nextClosingAt) {
      setRemainingSeconds(null);
      return undefined;
    }

    const updateCountdown = () => {
      const seconds = Math.max(
        0,
        Math.floor(
          (
            Number(nextClosingAt) -
            Date.now()
          ) / 1000
        )
      );

      setRemainingSeconds(seconds);

      /*
       * 締切時刻になったら、
       * Server Componentを再取得します。
       */
      if (
        seconds <= 0 &&
        !refreshDoneRef.current
      ) {
        refreshDoneRef.current = true;
        router.refresh();
      }
    };

    updateCountdown();

    const timerId = window.setInterval(
      updateCountdown,
      1000
    );

    return () => {
      window.clearInterval(timerId);
    };
  }, [nextClosingAt, router]);

  /*
   * 🔵 全レース結果確定
   */
  if (liveStatus === "finished") {
    return (
      <div className={styles.courseCountdown}>
        <strong
          className={`${styles.courseCountdownStatus} ${styles.courseCountdownFinished}`}
        >
          🔵 結果確定
        </strong>

        <small>
          {resultCount}/{raceCount}R 結果公開
        </small>
      </div>
    );
  }

  /*
   * 🔴 締切済み・結果待ち
   */
  if (liveStatus === "live") {
    return (
      <div className={styles.courseCountdown}>
        <strong
          className={`${styles.courseCountdownStatus} ${styles.courseCountdownLive}`}
        >
          🔴 レース中
        </strong>

        <small>
          {liveRaceNo
            ? `${liveRaceNo}R 結果待ち`
            : "結果を取得中"}
        </small>
      </div>
    );
  }

  /*
   * 🟢開催前 / 🟡展示中
   */
  if (
    nextRaceNo &&
    nextClosingAt &&
    remainingSeconds !== null
  ) {
    const isExhibition =
      liveStatus === "exhibition";

    return (
      <div className={styles.courseCountdown}>
        <strong
          className={`${styles.courseCountdownStatus} ${
            isExhibition
              ? styles.courseCountdownExhibition
              : styles.courseCountdownScheduled
          }`}
        >
          {isExhibition
            ? "🟡 展示中"
            : "🟢 開催前"}
        </strong>

        <small>
          {nextRaceNo}R 締切{" "}
          {formatClosingTime(
            nextClosingTime
          )}
        </small>

        <div
          className={
            styles.courseCountdownRemaining
          }
        >
          <span>あと</span>

          <b>
            {formatRemaining(
              remainingSeconds
            )}
          </b>
        </div>
      </div>
    );
  }

  /*
   * 締切情報がない場合
   */
  return (
    <div className={styles.courseCountdown}>
      <strong
        className={`${styles.courseCountdownStatus} ${styles.courseCountdownScheduled}`}
      >
        🟢 開催前
      </strong>

      <small>締切情報を取得中</small>
    </div>
  );
}
