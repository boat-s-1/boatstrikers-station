import Link from 'next/link';
import styles from './racesSeo.module.css';

export default function RacesSeoIntro({ raceDate, courseCount, courseNames = [], femaleRaceCount = 0 }) {
  const dateLabel = String(raceDate || '').replaceAll('-', '/');
  const visibleCourses = courseNames.slice(0, 8);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: '本日のボートレース出走表・開催日程・レース情報',
    description: '本日のボートレース開催場、出走表、締切時刻、展示・モーター情報、AI注目レースを確認できます。',
    url: 'https://www.boat-strike.online/races',
    isPartOf: {
      '@type': 'WebSite',
      name: 'BoatStrikers',
      url: 'https://www.boat-strike.online/',
    },
  };

  return (
    <section className={styles.wrap} aria-labelledby="races-seo-title">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className={styles.eyebrow}>TODAY&apos;S BOAT RACE</div>
      <h1 id="races-seo-title">本日のボートレース出走表・開催日程</h1>
      <p className={styles.lead}>
        {dateLabel}のボートレース開催情報をまとめています。本日の開催場は{courseCount}場です。
        各場の出走表、締切時刻、選手・モーター・展示情報を確認し、BoatStrikersのAI注目レースや理論アラートまで続けてチェックできます。
      </p>

      {visibleCourses.length > 0 && (
        <p className={styles.courses}>
          <strong>本日の主な開催場：</strong>{visibleCourses.join('・')}{courseNames.length > visibleCourses.length ? ' ほか' : ''}
        </p>
      )}

      <div className={styles.cards}>
        <article>
          <span>01</span>
          <h2>今日の開催場と出走表を確認</h2>
          <p>開催場を選ぶと、各レースの出走表や締切時刻へ進めます。まずは本日の開催場から確認してください。</p>
        </article>
        <article>
          <span>02</span>
          <h2>展示・モーター・選手情報を見る</h2>
          <p>出走表では艇番だけでなく、モーター成績や展示などの直前情報をあわせて確認できます。</p>
        </article>
        <article>
          <span>03</span>
          <h2>AI注目レースと理論アラート</h2>
          <p>BoatStrikersでは、AI評価とキャラクター別理論を分けて表示しています。同じレースで重なる場合も確認できます。</p>
        </article>
      </div>

      <div className={styles.links}>
        <Link href="/guide/race-card">出走表の見方を学ぶ</Link>
        <Link href="/guide/exhibition">展示航走の見方を学ぶ</Link>
        <Link href="/library/stadiums">全国24場の特徴を見る</Link>
        {femaleRaceCount > 0 && <Link href="/hatsune">女子戦攻略を見る</Link>}
      </div>
    </section>
  );
}
