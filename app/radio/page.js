import Link from "next/link";
import { radioBlogs } from "./blogData";
import styles from "./radio.module.css";

const playlistId = process.env.NEXT_PUBLIC_RADIO_YOUTUBE_PLAYLIST_ID || "";
const youtubeChannel =
  process.env.NEXT_PUBLIC_RADIO_YOUTUBE_CHANNEL_URL ||
  "https://www.youtube.com/@boatstrikers_official";

const programs = [
  {
    name: "一果",
    title: "一果のボート・ナイト・ニッポン",
    schedule: "毎週月曜日 22:00 ON AIR",
    description: "イン逃げ研究や今週の注目情報を、一果が整理してお届けします。",
    image: "/radio/ichika-program.jpeg",
  },
  
  {
    name: "初音",
    title: "初音のボート・ナイト・ジャパン",
    schedule: "毎週水曜日 22:00 ON AIR",
    description: "女子戦や注目レーサーを、初音が楽しく紹介します。",
    image: "/radio/hatsune-program.jpeg",
  },
  {
    name: "キイナ",
    title: "キイナのボート・ナイト・ニッポン",
    schedule: "毎週金曜日 22:00 ON AIR",
    description: "5号艇や高配当レースを中心に、穴狙いを振り返ります。",
    image: "/radio/kiina-program.jpeg",
  },
  
];

export const metadata = {
  title: "ボート・ナイト・ニッポン｜BoatStrikers",
  description: "一果・初音・キイナが出演するBoatStrikersのラジオ番組ページです。",
};

export default function RadioPage() {
  return (
    <main className={styles.page}>
      <section id="top" className={styles.hero}>
        <img
          src="/radio/radio-main.jpeg"
          alt="ボート・ナイト・ニッポン"
          className={styles.heroImage}
        />
      </section>

      <nav className={styles.localNav} aria-label="ラジオページ内メニュー">
        <a href="#top">TOP</a>
        <a href="#archive">過去の放送</a>
        <a href="#blog">放送ブログ</a>
      </nav>

      <section className={styles.intro}>
        <p className={styles.kicker}>BOATSTRIKERS RADIO PROGRAM</p>
        <h1>ボート・ナイト・ニッポン</h1>
        <p>
          一果・初音・キイナが、ボートレースの研究や注目情報、収録後の反省会を
          にぎやかにお届けするラジオ番組です。
        </p>
      </section>

      <section id="archive" className={styles.section}>
        <div className={styles.sectionHeading}>
          <span>🎧</span>
          <div>
            <p>ARCHIVE</p>
            <h2>過去の放送を聴く</h2>
          </div>
        </div>

        {playlistId ? (
          <div className={styles.playerWrap}>
            <iframe
              src={`https://www.youtube.com/embed/videoseries?list=${encodeURIComponent(
                playlistId
              )}`}
              title="ボート・ナイト・ニッポン 過去の放送"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        ) : (
          <div className={styles.playerPlaceholder}>
            <strong>過去の放送プレーヤー</strong>
            <p>
              Vercelの環境変数に再生リストIDを登録すると、ここに過去の放送が表示されます。
            </p>
            <code>NEXT_PUBLIC_RADIO_YOUTUBE_PLAYLIST_ID</code>
          </div>
        )}

        <a
          className={styles.youtubeButton}
          href={youtubeChannel}
          target="_blank"
          rel="noreferrer"
        >
          YouTubeで放送一覧を見る
        </a>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeading}>
          <span>🎙️</span>
          <div>
            <p>PROGRAMS</p>
            <h2>番組ラインナップ</h2>
          </div>
        </div>

        <div className={styles.programGrid}>
          {programs.map((program) => (
            <article className={styles.programCard} key={program.name}>
              <img src={program.image} alt={program.title} />
              <div className={styles.programBody}>
                <span>{program.name}</span>
                <h3>{program.title}</h3>
                <p className={styles.schedule}>{program.schedule}</p>
                <p>{program.description}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="blog" className={styles.section}>
        <div className={styles.sectionHeading}>
          <span>✏️</span>
          <div>
            <p>ON AIR BLOG</p>
            <h2>放送ブログ</h2>
          </div>
        </div>

        <p className={styles.sectionLead}>
          放送後記、収録の裏話、番組内で紹介しきれなかった研究メモを掲載します。
        </p>

        <div className={styles.blogGrid}>
          {radioBlogs.map((post) => (
            <Link
              href={`/radio/blog/${post.slug}`}
              className={styles.blogCard}
              key={post.slug}
            >
              <img src={post.image} alt="" />
              <div>
                <div className={styles.blogMeta}>
                  <span>{post.number}</span>
                  <time>{post.date}</time>
                </div>
                <h3>{post.title}</h3>
                <p>{post.summary}</p>
                <b>続きを読む →</b>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className={styles.notice}>
        <h2>番組からのお知らせ</h2>
        <p>
          掲載内容は独自の研究・感想です。的中や利益を保証するものではありません。
          舟券の購入は20歳以上の方に限られます。無理のない範囲でお楽しみください。
        </p>
      </section>
    </main>
  );
}
