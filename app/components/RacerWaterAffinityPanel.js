"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import styles from "./RacerWaterAffinityPanel.module.css";

function pct(value) {
  return value == null ? "--" : `${Number(value).toFixed(1)}%`;
}

function AffinityBadge({ affinity }) {
  const tone = affinity?.tone || "neutral";
  return <span className={`${styles.badge} ${styles[tone]}`}>{affinity?.label || "--"}</span>;
}

function VenueCard({ item, rank, compact = false }) {
  return (
    <article className={`${styles.card} ${compact ? styles.compact : ""}`}>
      <div className={styles.cardTop}>
        <div>
          {rank ? <span className={styles.rank}>#{rank}</span> : null}
          <strong>{item.courseName}</strong>
        </div>
        <AffinityBadge affinity={item.affinity} />
      </div>
      <div className={styles.metrics}>
        <div><span>出走</span><b>{item.starts}走</b></div>
        <div><span>1着率</span><b>{pct(item.winRate)}</b></div>
        <div><span>2連対</span><b>{pct(item.top2Rate)}</b></div>
        <div><span>3連対</span><b>{pct(item.top3Rate)}</b></div>
      </div>
      {item.sample === "reference" ? <small>※ 5〜9走のため参考値</small> : null}
    </article>
  );
}

export default function RacerWaterAffinityPanel() {
  const pathname = usePathname() || "";
  const registrationNo = useMemo(() => pathname.match(/^\/racers\/(\d{1,5})\/?$/)?.[1] || null, [pathname]);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!registrationNo) {
      setData(null);
      setError("");
      return;
    }
    let cancelled = false;
    setError("");
    fetch(`/api/racers/${registrationNo}/water-affinity`, { cache: "no-store" })
      .then(async (response) => {
        const json = await response.json();
        if (!response.ok) throw new Error(json?.error || "取得に失敗しました");
        return json;
      })
      .then((json) => { if (!cancelled) setData(json); })
      .catch((e) => { if (!cancelled) setError(e?.message || "取得に失敗しました"); });
    return () => { cancelled = true; };
  }, [registrationNo]);

  if (!registrationNo) return null;

  return (
    <section className={styles.wrap} aria-label="水面相性">
      <div className={styles.inner}>
        <div className={styles.heading}>
          <div><span>WATER AFFINITY</span><h2>水面相性</h2></div>
          <p>BoatStrikers保有結果から場別の傾向を集計</p>
        </div>

        {!data && !error ? <div className={styles.loading}>水面相性を集計しています…</div> : null}
        {error ? <div className={styles.error}>{error}</div> : null}

        {data ? (
          <>
            {data.todayAffinity?.length ? (
              <div className={styles.todayBox}>
                <div className={styles.subhead}><span>🔥</span><div><b>今日走る場との相性</b><small>本日の出走場を自動チェック</small></div></div>
                <div className={styles.todayGrid}>
                  {data.todayAffinity.map((item) => <VenueCard key={item.courseCode} item={item} compact />)}
                </div>
              </div>
            ) : null}

            <div className={styles.block}>
              <div className={styles.blockHead}><h3>得意な場 TOP3</h3><small>10走以上を優先、5〜9走は参考表示</small></div>
              {data.best?.length ? (
                <div className={styles.slider}>
                  {data.best.map((item, index) => <VenueCard key={item.courseCode} item={item} rank={index + 1} />)}
                </div>
              ) : <p className={styles.empty}>判定できる場別データを蓄積中です。</p>}
            </div>

            <div className={styles.block}>
              <div className={styles.blockHead}><h3>苦手傾向の場</h3><small>選手自身の全体成績より低い場を抽出</small></div>
              {data.weak?.length ? (
                <div className={styles.slider}>
                  {data.weak.map((item) => <VenueCard key={item.courseCode} item={item} />)}
                </div>
              ) : <p className={styles.empty}>現時点で明確な苦手傾向は抽出されていません。</p>}
            </div>

            <p className={styles.note}>※ 1着率・2連対率・3連対率を総合して表示しています。10走未満は参考扱いです。</p>
          </>
        ) : null}
      </div>
    </section>
  );
}
