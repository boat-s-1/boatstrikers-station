"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

function formatRemaining(milliseconds) {
  if (!Number.isFinite(milliseconds)) {
    return "-";
  }

  if (milliseconds <= 0) {
    return "締切時刻";
  }

  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  // 1時間以上を「480:10」のような総分表示にしない
  if (hours > 0) {
    return `${hours}時間${String(minutes).padStart(2, "0")}分${String(
      seconds
    ).padStart(2, "0")}秒`;
  }

  return `${minutes}分${String(seconds).padStart(2, "0")}秒`;
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
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    // Auto Sync が5分間隔なので、画面側も1分ごとにServer Componentを再取得
    const refreshTimer = window.setInterval(() => {
      router.refresh();
    }, 60 * 1000);

    return () => window.clearInterval(refreshTimer);
  }, [router]);

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
      <strong>{nextRaceNo != null ? `${nextRaceNo}R` : "開催前"}</strong>
      <small>
        {nextRaceNo != null
          ? `締切まで ${formatRemaining(remaining)}`
          : "出走表公開中"}
      </small>
    </div>
  );
}
