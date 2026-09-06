import Link from "next/link";
import Image from "next/image";
import styles from "./guide.module.css";
import { CHARACTERS, GUIDE_ARTICLES, GUIDE_UPDATED_AT } from "./guideData";

export const metadata = {
  title: "ボートレース初心者ガイド｜基本・出走表・展示・進入をやさしく解説",
  description: "ボートレース初心者向けガイド。基本ルール、舟券、出走表、展示航走、イン逃げ、モーター、平均ST、風、水面、進入・前付け、級別、チルト、コース別特徴、当地勝率、今節成績などを分かりやすく解説します。",
  alternates: { canonical: "/guide" },
  openGraph: {
    title: "ボートレース初心者ガイド｜BoatStrikers",
    description: "これから始める人に、ボートレースの基本から実戦で見るポイントまで分かりやすく解説。",
    url: "/guide",
    type: "website",
  },
};

const DEEP_DIVE_ARTICLES = [
  { number: "11", title: "進入・前付けとは？", description: "艇番とコースが変わる理由、枠なり、前付け、深い進入を解説。", href: "/guide/course-entry", keyword: "進入・前付け" },
  { number: "12", title: "A1・A2・B1・B2とは？", description: "ボートレーサーの級別の意味と、出走表での見方を解説。", href: "/guide/racer-class", keyword: "選手の級別" },
  { number: "13", title: "チルトとは？", description: "チルト角度の意味と、展示・直線・ターンと合わせた見方を解説。", href: "/guide/tilt", keyword: "チルト" },
  { number: "14", title: "F・Lとは？", description: "フライングと出遅れ、スタート情報を見るときの基本を解説。", href: "/guide/flying-late-start", keyword: "F・L" },
  { number: "15", title: "1マークとは？", description: "第1ターンマークまでの攻防と、逃げ・差し・まくりの展開を解説。", href: "/guide/first-turn-mark", keyword: "1マーク" },
  { number: "16", title: "コース別の特徴とは？", description: "1〜6コースの基本的な役割と、展開を考えるときの見方を解説。", href: "/guide/course-characteristics", keyword: "コース別特徴" },
  { number: "17", title: "スタート展示とは？", description: "進入、展示ST、スリット後の伸びなど、直前に見るポイントを解説。", href: "/guide/start-exhibition", keyword: "スタート展示" },
  { number: "18", title: "周回展示とは？", description: "ターンの安定感、出口の加速、直線の気配の見方を解説。", href: "/guide/lap-exhibition", keyword: "周回展示" },
  { number: "19", title: "当地勝率とは？", description: "全国勝率との違いと、そのレース場での過去成績の使い方を解説。", href: "/guide/local-win-rate", keyword: "当地勝率" },
  { number: "20", title: "今節成績とは？", description: "着順・コース・ST・展示から、今開催での状態を見る方法を解説。", href: "/guide/series-performance", keyword: "今節成績" },
];

export default function GuidePage() {
  return (
    <main className={styles.page}>
      <nav className={styles.breadcrumb} aria-label="パンくずリスト">
        <Link href="/">ホーム</Link><span>›</span><span>ボートレースガイド</span>
      </nav>

      <header className={styles.hero}>
        <div className={styles.heroCopy}>
          <span>BOAT RACE BEGINNER&apos;S GUIDE</span>
          <h1>ボートレース初心者ガイド</h1>
          <p className={styles.subtitle}>〜基本から実戦の見方まで、3人がやさしく解説〜</p>
          <p>専門用語をできるだけかみ砕き、レースを見るための基礎から、出走表・展示・進入・スタートの見方まで順番に紹介します。</p>
        </div>
        <div className={styles.heroCharacters}>
          {Object.values(CHARACTERS).map((character) => (
            <div key={character.name}>
              <Image src={character.image} alt={`${character.name} ボートレースガイド担当`} width={82} height={82} />
              <strong>{character.name}</strong>
              <small>{character.role}</small>
            </div>
          ))}
        </div>
      </header>

      <section className={styles.firstSteps} aria-labelledby="guide-first-title">
        <span>FIRST STEPS</span>
        <h2 id="guide-first-title">初めての方は、01から順番に</h2>
        <p>基本ルールから風・水面まで、まず押さえておきたい10記事です。気になるテーマだけ選んで読んでも問題ありません。</p>
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

      <section className={styles.deepDive} aria-labelledby="guide-deep-title">
        <div className={styles.deepDiveHeading}>
          <span>STEP UP GUIDE</span>
          <h2 id="guide-deep-title">もう一歩詳しく知りたい方へ</h2>
          <p>検索されやすい疑問を、1テーマずつ詳しく解説する実践寄りのガイドです。</p>
        </div>
        <div className={styles.deepDiveGrid}>
          {DEEP_DIVE_ARTICLES.map((article) => (
            <Link href={article.href} className={styles.deepDiveCard} key={article.href}>
              <span className={styles.deepDiveNumber}>{article.number}</span>
              <small>{article.keyword}</small>
              <h3>{article.title}</h3>
              <p>{article.description}</p>
              <b>詳しく読む <i>›</i></b>
            </Link>
          ))}
        </div>
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
        <time dateTime="2026-09-07">更新日：2026年9月7日</time>
      </footer>
    </main>
  );
}
