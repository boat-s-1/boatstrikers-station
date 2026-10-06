"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { AI_PARTNERS } from "../../lib/aiPartners";
import MonthlyPerformanceSlider from "./MonthlyPerformanceSlider";
import styles from "./HomeAiPerformance.module.css";

function dateLabel(value) {
  if (!value) return "—";
  return value.split("-").map(Number).join("/");
}

function timeLabel(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "numeric", day: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(new Date(value)) + " JST";
}

export default function HomeAiPerformance() {
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    setData(null);
    fetch("/api/home-performance", { cache: "no-store" })
      .then(async response => {
        if (!response.ok) throw new Error("performance unavailable");
        const result = await response.json();
        if (!result.scope || !result.modes?.equal?.stats) throw new Error("invalid performance");
        if (!cancelled) setData(result);
      })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [attempt]);

  return (
    <div className={styles.wrapper}>
      <header className={styles.heading}>
        <span>AI PERFORMANCE</span>
        <h2>今月のAI公開買い目成績</h2>
        <p>公開買い目を、各点100円で購入した場合の成績です。</p>
      </header>
      <nav className={styles.partners} aria-label="AI別の成績・買い目を見る">
        {Object.entries(AI_PARTNERS).map(([key, partner]) => (
          <a key={key} href={`/${key}`} style={{ "--ai-color": partner.color }}>
            <Image src={partner.image} alt="" width={56} height={56} />
            <strong>{partner.ai}</strong><span>{partner.specialty}</span>
          </a>
        ))}
      </nav>
      <p className={styles.history}>従来のキャラ名義の公開買い目を含みます。相棒AIの診断精度とは別の集計です。</p>
      {!data ? (
        <div className={styles.status} role="status">
          {failed ? <><p>成績を取得できませんでした。</p><button type="button" onClick={() => setAttempt(value => value + 1)}>再読み込み</button></> : <p>AI公開買い目の成績を読み込んでいます…</p>}
        </div>
      ) : (
        <>
          <dl className={styles.scope}>
            <div><dt>集計期間</dt><dd>{dateLabel(data.scope.startDate)}〜{dateLabel(data.scope.endDate)}</dd></div>
            <div><dt>集計対象</dt><dd>前日版・結果確定済み</dd></div>
            <div><dt>結果更新</dt><dd>{timeLabel(data.scope.latestResultAt)}</dd></div>
          </dl>
          {data.scope.predictionCount === 0 ? <p className={styles.status}>今月の結果確定済みの買い目はまだありません。</p> : (
            <>
              <MonthlyPerformanceSlider detailData={data} overview showBets={false} />
              <p className={styles.countNote}>対象は{data.scope.uniqueRaceCount}レース。同じレースの担当別買い目はそれぞれ1件として集計します。</p>
              <details className={styles.comparison}>
                <summary>購入配分を変えて比較する</summary>
                <p>同じ公開買い目で購入額を変えた試算です。買い目順位は的中確率を示すものではありません。オッズ配分は保存オッズのある買い目のみが対象です。</p>
                <MonthlyPerformanceSlider detailData={data} showBets={false} />
              </details>
            </>
          )}
          <p className={styles.linkNote}>AI別の成績・公開買い目は、上の各AIからご覧いただけます。</p>
        </>
      )}
    </div>
  );
}
