import Link from "next/link";
import Image from "next/image";
import { GuideCast, GuideTalk } from "./GuideConversation";
import styles from "./guide.module.css";
import { CHARACTERS, GUIDE_ARTICLES, GUIDE_UPDATED_AT } from "./guideData";

export const metadata = {
  title: "ボートレース初心者ガイド｜基本・出走表・展示・進入をやさしく解説",
  description: "ボートレース初心者向けガイド。基本ルール、舟券、出走表、展示航走、イン逃げ、モーター、平均ST、風、水面、進入・前付け、級別、チルト、展示タイム、直線、安定板、潮位などを分かりやすく解説します。",
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
  { number: "21", title: "展示タイムとは？", description: "展示タイムの意味、展示1位の見方、直線や周回展示との合わせ方を解説。", href: "/guide/exhibition-time", keyword: "展示タイム" },
  { number: "22", title: "直線タイムとは？", description: "直線の伸び、展示タイムとの違い、外枠やカド攻めを見るポイントを解説。", href: "/guide/straight-line-time", keyword: "直線タイム" },
  { number: "23", title: "モーター交換とは？", description: "交換後に過去データをどう扱うか、展示で確認したいポイントを解説。", href: "/guide/motor-change", keyword: "モーター交換" },
  { number: "24", title: "安定板とは？", description: "荒天時に装着される安定板と、展示・風・波を見るときの注意点を解説。", href: "/guide/stabilizer", keyword: "安定板" },
  { number: "25", title: "潮位とは？", description: "満潮・干潮と水面条件、レース場ごとに潮位を見るポイントを解説。", href: "/guide/tide-level", keyword: "潮位" },
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
          <GuideTalk character="hatsune" pose="welcome"><p>専門用語をできるだけかみ砕き、レースを見るための基礎から、出走表・展示・進入・スタートの見方まで順番に紹介します。</p></GuideTalk>
          <GuideTalk character="ichika" pose="explain"><p>私はイン・1コース・逃げの見方を担当するよ。選手の話は初音、穴や展開の話はキイナ。それぞれの視点で、一緒に考えていこう！</p></GuideTalk>
          <GuideTalk character="kiina" pose="ask"><p>分からない言葉は、そのままにしないで聞いていこう！ 「どうして？」から、レースの見方を広げたいな。</p></GuideTalk>
        </div>
        <GuideCast />
      </header>

      <section className={styles.firstSteps} aria-labelledby="guide-first-title">
        <span>FIRST STEPS</span>
        <h2 id="guide-first-title">初めての方は、01から順番に</h2>
        <GuideTalk character="kiina" pose="ask"><p>初めてなら、どの記事から読むといい？</p></GuideTalk>
        <GuideTalk character="hatsune" pose="explain"><p>基本ルールから風・水面まで、まず押さえておきたい10記事です。気になるテーマだけ選んで読んでも問題ありません。</p></GuideTalk>
        <GuideTalk character="ichika" pose="recap"><p>順番に読むなら01から。基本を押さえて、出走表や展示を読む練習につなげよう！</p></GuideTalk>
      </section>

      <section className={styles.articleGrid} aria-label="初心者ガイド記事一覧">
        {GUIDE_ARTICLES.map((article) => {
          const character = CHARACTERS[article.character];
          return (
            <Link href={`/guide/${article.slug}`} className={styles.articleCard} key={article.slug}>
              <span className={styles.articleNumber}>{article.number}</span>
              <div className={styles.articleCharacter}>
                <Image src={character.image} alt="" width={48} height={48} />
                <small>3人で学ぶ · {character.name}の注目テーマ</small>
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
          <GuideTalk character="ichika" pose="ask"><p>基本が分かったら、進入やコースの違いも掘り下げてみない？</p></GuideTalk>
          <GuideTalk character="hatsune" pose="think"><p>検索されやすい疑問を、1テーマずつ詳しく解説する実践寄りのガイドです。</p></GuideTalk>
          <GuideTalk character="kiina" pose="explain"><p>外の艇が攻められる条件や、水面の変化も気になるね。知りたいテーマから詳しく見ていこう！</p></GuideTalk>
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
        <GuideTalk character="hatsune" pose="recap"><p>基本が分かったら、本日の出走表で選手・モーター・展示情報を確認してみましょう。</p></GuideTalk>
        <GuideTalk character="kiina" pose="think"><p>数字や展示を見て、どんな展開になるか考えてみよう。迷ったらガイドに戻って確かめていいんだね。</p></GuideTalk>
        <GuideTalk character="ichika" pose="welcome"><p>動画・画像の教材や全国24場攻略も使って、実際の走りと場の特徴を見比べよう！</p></GuideTalk>
        <div>
          <Link href="/races">本日の出走表を見る</Link>
          <Link href="/ichika-sensei">動画・画像で学ぶ</Link>
          <Link href="/library/stadiums">全国24場攻略を見る</Link>
        </div>
      </section>

      <aside className={styles.notice}>
        <strong>安心して楽しむために</strong>
        <GuideTalk character="hatsune" pose="think"><p>舟券の購入は20歳になってから。予想や情報は的中・利益を保証するものではありません。無理のない範囲でお楽しみください。</p></GuideTalk>
      </aside>

      <footer className={styles.editorial}>
        <span>編集：BoatStrikers編集部</span>
        <time dateTime="2026-09-07">更新日：2026年9月7日</time>
      </footer>
    </main>
  );
}
