import Link from "next/link";
import Image from "next/image";
import styles from "./guide.module.css";
import { CHARACTERS, GUIDE_ARTICLES, GUIDE_UPDATED_AT } from "./guideData";

export const metadata = {
  title: "ボートレースガイド｜これから始める人に基本から3人が解説",
  description: "ボートレースをこれから始める方へ。一果・初音・キイナの3人が、基本ルール、舟券、出走表、展示航走、イン逃げを文章で分かりやすく解説します。",
  alternates: { canonical: "/guide" },
  openGraph: {
    title: "ボートレースガイド｜BoatStrikers",
    description: "これから始める人に、ボートレースの基本から3人が解説。",
    url: "/guide",
    type: "website",
  },
};

export default function GuidePage() {
  return (
    <main className={styles.page}>
      <nav className={styles.breadcrumb} aria-label="パンくずリスト">
        <Link href="/">ホーム</Link><span>›</span><span>ボートレースガイド</span>
      </nav>

      <header className={styles.hero}>
        <div className={styles.heroCopy}>
          <span>BOAT RACE BEGINNER&apos;S GUIDE</span>
          <h1>ボートレースガイド</h1>
          <p className={styles.subtitle}>〜これから始める人に基本から3人が解説〜</p>
          <p>専門用語をできるだけ使わず、レースを見るための基礎を順番に紹介します。</p>
        </div>
        <div className={styles.heroCharacters}>
          {Object.values(CHARACTERS).map((character) => (
            <div key={character.name}>
              <Image src={character.image} alt={character.name} width={82} height={82} />
              <strong>{character.name}</strong>
              <small>{character.role}</small>
            </div>
          ))}
        </div>
      </header>

      <section className={styles.firstSteps} aria-labelledby="guide-first-title">
        <span>FIRST STEPS</span>
        <h2 id="guide-first-title">初めての方は、01から順番に</h2>
        <p>基本ルールから展示航走まで、1記事ずつ読める構成です。気になる記事だけ選んでも問題ありません。</p>
      </section>

      <section className={styles.articleGrid} aria-label="初心者ガイド記事一覧">
        {GUIDE_ARTICLES.map((article) => {
          const character = CHARACTERS[article.character];
          return (
            <Link href={`/guide/${article.slug}`} className={styles.articleCard} key={article.slug}>
              <span className={styles.articleNumber}>{article.number}</span>
              <div className={styles.articleCharacter}>
                <Image src={character.image} alt="" width={48} height={48} />
                <small>{character.name}が解説</small>
              </div>
              <h2>{article.title}</h2>
              <p>{article.description}</p>
              <b>この記事を読む <i>›</i></b>
            </Link>
          );
        })}
      </section>

      <section className={styles.howToUse}>
        <h2>BoatStrikersで実際のレースを見る</h2>
        <p>基本が分かったら、本日の出走表で選手・モーター・展示情報を確認してみましょう。</p>
        <div>
          <Link href="/races">本日の出走表を見る</Link>
          <Link href="/ichika-sensei">動画・画像で学ぶ</Link>
          <Link href="/library/stadiums">全国24場攻略を見る</Link>
        </div>
      </section>

      <aside className={styles.notice}>
        <strong>安心して楽しむために</strong>
        <p>舟券の購入は20歳になってから。予想や情報は的中・利益を保証するものではありません。無理のない範囲でお楽しみください。</p>
      </aside>

      <footer className={styles.editorial}>
        <span>編集：BoatStrikers編集部</span>
        <time dateTime={GUIDE_UPDATED_AT}>更新日：2026年9月2日</time>
      </footer>
    </main>
  );
}
