import Link from "next/link";
import { dataLabArticles } from "./articles";
import styles from "./data-lab.module.css";

export const metadata = {
  title: "BoatStrikers DATA LAB｜実レースデータで検証するボートレース研究",
  description:
    "BoatStrikers DATA LABは、実レースデータをもとに買い方、イン逃げ、5号艇、女子戦などを検証する研究コンテンツです。集計条件と結果を明示し、的中率だけでなく回収率まで確認します。",
  alternates: { canonical: "/data-lab" },
  openGraph: {
    title: "BoatStrikers DATA LAB",
    description: "実レースデータからボートレースを検証するBoatStrikersの研究室。",
    url: "/data-lab",
    type: "website",
  },
};

export default function DataLabPage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.logo} aria-label="BoatStrikers ホーム">
          BOAT<br /><span>STRIKERS</span>
        </Link>
        <Link href="/about" className={styles.aboutLink}>このサイトについて</Link>
      </header>

      <section className={styles.hero}>
        <span className={styles.eyebrow}>BOATSTRIKERS RESEARCH</span>
        <h1>DATA LAB</h1>
        <p>
          実レースデータで、買い方やレース傾向を検証。
          <br />
          「当たった」だけで終わらず、条件・件数・的中率・回収率まで見ます。
        </p>
      </section>

      <section className={styles.policy}>
        <h2>DATA LABの検証方針</h2>
        <div className={styles.policyGrid}>
          <div><strong>01</strong><h3>条件を明示</h3><p>対象期間、買い目、集計対象を記事ごとに示します。</p></div>
          <div><strong>02</strong><h3>都合のよい例だけにしない</h3><p>高配当例だけではなく、対象条件に当てはまるレース全体で考えます。</p></div>
          <div><strong>03</strong><h3>的中率と回収率を分ける</h3><p>当たりやすさと収支は別物として確認します。</p></div>
        </div>
      </section>

      <section className={styles.articlesSection}>
        <div className={styles.sectionHeading}>
          <span>ARTICLES</span>
          <h2>研究記事</h2>
        </div>

        <div className={styles.articleGrid}>
          {dataLabArticles.map((article, index) => (
            <Link key={article.slug} href={`/data-lab/${article.slug}`} className={styles.articleCard}>
              <div className={styles.cardTop}>
                <span className={styles.number}>{String(index + 1).padStart(2, "0")}</span>
                <span className={styles.category}>{article.category}</span>
              </div>
              <h3>{article.title}</h3>
              <p>{article.description}</p>
              <div className={styles.cardMeta}>
                <span>更新 {article.updatedAt.replaceAll("-", ".")}</span>
                <b>読む →</b>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className={styles.note}>
        <h2>データの読み方について</h2>
        <p>
          過去データは将来の結果を保証するものではありません。BoatStrikersでは、数値を「当たる根拠」と断定するのではなく、
          条件ごとの傾向を比較するための材料として扱います。記事内の集計条件を確認したうえでお読みください。
        </p>
      </section>
    </main>
  );
}
