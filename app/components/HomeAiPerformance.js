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
  const [character, setCharacter] = useState("");
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    setData(null);
    fetch(`/api/home-performance${character ? `?character=${encodeURIComponent(character)}` : ""}`, { cache: "no-store" })
      .then(async response => {
        if (!response.ok) throw new Error("performance unavailable");
        const result = await response.json();
        if (!result.scope || !result.modes?.equal?.stats) throw new Error("invalid performance");
        if (!cancelled) setData(result);
      })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [attempt, character]);

  function selectCharacter(key) {
    if (key === character) return;
    setData(null);
    setCharacter(key);
  }

  return (
    <div className={styles.wrapper}>
      <header className={styles.heading}>
        <span>AI PERFORMANCE</span>
        <h2>今月のAI公開買い目成績</h2>
        <p>公開買い目を各点100円で購入した試算です。<br />AIの診断精度とは別の集計です。</p>
      </header>
      <nav className={styles.partners} aria-label="AI別の成績を切り替える">
        <button type="button" aria-pressed={character === ""} onClick={() => selectCharacter("")}>全AI</button>
        {Object.entries(AI_PARTNERS).map(([key, partner]) => (
          <button key={key} type="button" style={{ "--ai-color": partner.color }} aria-pressed={character === key} onClick={() => selectCharacter(key)}>
            <Image src={partner.image} alt="" width={28} height={28} />
            <span>{partner.ai}</span>
          </button>
        ))}
      </nav>
      <p className={styles.selection}>{character ? `${AI_PARTNERS[character].ai}の公開買い目` : "全AIの公開買い目"} · 各点100円</p>
      {!data ? (
        <div className={styles.status} role="status">
          {failed ? <><p>成績を取得できませんでした。</p><button type="button" onClick={() => setAttempt(value => value + 1)}>再読み込み</button></> : <p>AI公開買い目の成績を読み込んでいます…</p>}
        </div>
      ) : (
        <>
          {data.scope.predictionCount === 0 ? <p className={styles.status}>今月の結果確定済みの買い目はまだありません。</p> : (
            <>
              <MonthlyPerformanceSlider detailData={data} overview showBets={false} />

            </>
          )}
          <p className={styles.period}>{dateLabel(data.scope.startDate)}{data.scope.endDate ? `〜${dateLabel(data.scope.endDate)}` : "以降 · 対象なし"} · 前日版・結果確定済み</p>
          <p className={styles.updated}>結果更新 {timeLabel(data.scope.latestResultAt)}</p>
          <details className={styles.conditions}>
            <summary>集計条件・過去データについて</summary>
            <p className={styles.history}>従来のキャラ名義で保存された公開買い目を、担当する相棒AI別に表示しています。診断精度とは別の集計です。</p>
            <p className={styles.countNote}>対象は{data.scope.uniqueRaceCount}レース。同じレースの担当別買い目はそれぞれ1件として集計します。</p>
          </details>
          {data.scope.predictionCount > 0 && (
              <details className={styles.comparison}>
                <summary>購入配分を変えて比較する</summary>
                <p>同じ公開買い目で購入額を変えた試算です。買い目順位は的中確率を示すものではありません。オッズ配分は保存オッズのある買い目のみが対象です。</p>
                <MonthlyPerformanceSlider detailData={data} />
              </details>
          )}
        </>
      )}
      <a className={styles.predictionLink} href={character ? `/${character}` : "#ai-partners"}>{character ? `${AI_PARTNERS[character].ai}の診断・キャラ予想を見る` : "AI診断・キャラ予想を見る"}<span aria-hidden="true">›</span></a>
    </div>
  );
}
