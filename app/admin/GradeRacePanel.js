"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import styles from "./GradeRacePanel.module.css";

function todayJst() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export default function GradeRacePanel({ mode = "ai" }) {
  const params = useSearchParams();
  const date = params.get("date") || todayJst();
  const [data, setData] = useState(null);

  useEffect(() => {
    let active = true;
    fetch(`/api/admin/grade-races?date=${encodeURIComponent(date)}&mode=${encodeURIComponent(mode)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => { if (active) setData(json); })
      .catch(() => { if (active) setData({ events: [], error: "グレード戦データを取得できませんでした。" }); });
    return () => { active = false; };
  }, [date, mode]);

  if (!data) return <section className={styles.panel}><strong>GRADE RACE</strong><span> 読み込み中…</span></section>;
  if (!data.events?.length) return null;

  return (
    <section className={styles.panel}>
      <div className={styles.header}>
        <div><span className={styles.eyebrow}>GRADE RACE</span><h2>{mode === "data" ? "グレード戦 DATA LAB" : "今日のグレード戦 AI候補"}</h2></div>
        <span className={styles.date}>{date}</span>
      </div>
      <div className={styles.grid}>
        {data.events.map((event) => (
          <article className={styles.card} key={`${event.course_code}-${event.grade}-${event.start_date}`}>
            <div className={styles.cardTop}><b className={styles.grade}>{event.grade}</b><span>{event.course_name}</span><span>{event.day_no ? `${event.day_no}日目` : ""}</span></div>
            <h3>{event.title}</h3>
            {mode === "ai" ? (
              <div className={styles.metrics}>
                <span>AI候補 <b>{event.ai_candidate_count ?? 0}件</b></span>
                <span>最高期待度 <b>{event.best_probability == null ? "—" : `${(event.best_probability * 100).toFixed(1)}%`}</b></span>
              </div>
            ) : (
              <div className={styles.metrics}>
                <span>確定 <b>{event.result_count ?? 0}R</b></span>
                <span>イン1着 <b>{event.boat1_win_rate == null ? "—" : `${event.boat1_win_rate.toFixed(1)}%`}</b></span>
                <span>万舟 <b>{event.manshu_count ?? 0}本</b></span>
                <span>平均配当 <b>{event.avg_payout == null ? "—" : `${Math.round(event.avg_payout).toLocaleString("ja-JP")}円`}</b></span>
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
