"use client";

import { useEffect, useMemo, useState } from "react";

function formatRemaining(milliseconds) {
  if (!Number.isFinite(milliseconds) || milliseconds <= 0) {
    return "締切時刻";
  }

  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
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
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!nextClosingAt || liveStatus === "finished") return undefined;

    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, [nextClosingAt, liveStatus]);

  const remaining = useMemo(() => {
    if (!nextClosingAt) return null;

    const timestamp = new Date(nextClosingAt).getTime();
    return Number.isNaN(timestamp) ? null : timestamp - now;
  }, [nextClosingAt, now]);

  if (liveStatus === "finished") {
    return (
      <div>
        <span>レース状況</span>
        <strong>結果確定</strong>
        <small>
          {Number(resultCount) > 0
            ? `${resultCount}/${raceCount}R結果公開`
            : "結果を公開中"}
        </small>
      </div>
    );
  }

  if (liveStatus === "live") {
    return (
      <div>
        <span>レース状況</span>
        <strong>只今レース中</strong>
        <small>
          {liveRaceNo != null
            ? `${liveRaceNo}R進行中`
            : `${resultCount}/${raceCount}R終了`}
        </small>
      </div>
    );
  }

  if (liveStatus === "exhibition") {
    return (
      <div>
        <span>レース状況</span>
        <strong>展示中</strong>
        <small>
          {nextRaceNo != null
            ? `${nextRaceNo}R 締切 ${nextClosingTime ?? "-"}`
            : "展示情報を取得中"}
        </small>
      </div>
    );
  }

  return (
    <div>
      <span>次レース</span>
      <strong>
        {nextRaceNo != null ? `${nextRaceNo}R` : "開催前"}
      </strong>
      <small>
        {nextRaceNo != null
          ? `締切まで ${formatRemaining(remaining)}`
          : "出走表公開中"}
      </small>
    </div>
  );
}
