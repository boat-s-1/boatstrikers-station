import Link from "next/link";
import styles from "./scheduleSeo.module.css";

export default function ScheduleSeoIntro({ weekStart, weekEnd, itemCount = 0 }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "ボートレース番組表・今週の配信予定",
    description: "BoatStrikersの週間番組表。今週のボートレース関連動画、ラジオ、記事などの公開予定を確認できます。",
    url: "https://www.boat-strike.online/schedule",
    isPartOf: {
      "@type": "WebSite",
      name: "BoatStrikers",
      url: "https://www.boat-strike.online/",
    },
  };

  return (
    <section className={styles.wrap} aria-labelledby="schedule-seo-title">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className={styles.eyebrow}>WEEKLY BOAT RACE PROGRAM</div>
      <h1 id="schedule-seo-title">ボートレース番組表・今週の配信予定</h1>
      <p className={styles.lead}>
        {weekStart}〜{weekEnd}のBoatStrikers週間番組表です。
        ボートレース関連の動画・ラジオ・記事など、今週公開予定のコンテンツをまとめて確認できます。
        今週の掲載予定は{itemCount}件です。
      </p>

      <div className={styles.cards}>
        <article>
          <span>01</span>
          <h2>今週の公開予定をまとめて確認</h2>
          <p>曜日ごとの公開予定を一覧で確認できます。見逃したくない番組や記事を先にチェックできます。</p>
        </article>
        <article>
          <span>02</span>
          <h2>今日のレース情報へ移動</h2>
          <p>当日の開催場や出走表を確認したい場合は、本日のレースページから各開催場へ進めます。</p>
        </article>
        <article>
          <span>03</span>
          <h2>基本から学びたい方にも対応</h2>
          <p>初心者ガイドや24場攻略にもつながっているので、番組表から関連テーマを深掘りできます。</p>
        </article>
      </div>

      <div className={styles.links}>
        <Link href="/races">本日のボートレース出走表を見る</Link>
        <Link href="/guide">ボートレース初心者ガイドを見る</Link>
        <Link href="/library/stadiums">全国24場攻略を見る</Link>
        <Link href="/radio">ボート・ナイト・ニッポンを見る</Link>
      </div>
    </section>
  );
}
