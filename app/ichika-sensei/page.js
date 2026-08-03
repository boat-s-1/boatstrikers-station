import Parser from "rss-parser";
import styles from "./ichikaSensei.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PLAYLIST_ID =
  process.env.ICHIKA_SENSEI_YOUTUBE_PLAYLIST_ID ||
  "PLOcyYXdocTd8";

const PLAYLIST_URL =
  "https://youtube.com/playlist?list=PLOcyYXdocTd8&si=mnV0MmFfYLcBrBKy";

const CHANNEL_URL =
  process.env.NEXT_PUBLIC_ICHIKA_SENSEI_YOUTUBE_URL ||
  "https://www.youtube.com/@boatstrikers_official";

function getVideoId(item) {
  if (item?.id?.startsWith("yt:video:")) {
    return item.id.replace("yt:video:", "");
  }

  if (item?.link) {
    try {
      return new URL(item.link).searchParams.get("v");
    } catch {
      return null;
    }
  }

  return null;
}

async function getLatestLessons() {
  const parser = new Parser();
  const feedUrl = `https://www.youtube.com/feeds/videos.xml?playlist_id=${PLAYLIST_ID}`;

  try {
    const feed = await parser.parseURL(feedUrl);
    return (feed.items || [])
      .map((item) => ({
        id: getVideoId(item),
        title: item.title || "教えて！一果センセー",
        publishedAt: item.pubDate || item.isoDate || null,
      }))
      .filter((item) => item.id)
      .slice(0, 3);
  } catch (error) {
    console.error("一果センセーの再生リストを取得できませんでした。", error);
    return [];
  }
}

function formatDate(value) {
  if (!value) return "";

  try {
    return new Intl.DateTimeFormat("ja-JP", {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "Asia/Tokyo",
    }).format(new Date(value));
  } catch {
    return "";
  }
}

export const metadata = {
  title: "教えて！一果センセー｜ボートレース初心者講座",
  description:
    "ボートレースのルール、展示タイム、スタート、進入、決まり手などを、一果センセーが初心者向けに分かりやすく解説します。",
};

export default async function IchikaSenseiPage() {
  const lessons = await getLatestLessons();

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <a href="/" className={styles.logo} aria-label="BoatStrikers ホーム">
          BOAT<br /><span>STRIKERS</span>
        </a>
        <nav className={styles.topNav} aria-label="一果センセーページ内メニュー">
          <a href="#top">TOP</a>
          <a href="#latest">最新授業</a>
          <a href="#about">一果センセー</a>
        </nav>
      </header>

      <section className={styles.hero} id="top">
        <img
          src="/59F96330-6F99-4736-8083-6D6508FCD861.png"
          alt="教えて！一果センセー"
          className={styles.heroImage}
        />
        <div className={styles.heroOverlay}>
          <p>BOAT RACE BEGINNER LESSON</p>
          <h1>教えて！<br />一果センセー</h1>
          <span>ボートレースを楽しく、やさしく解説！</span>
        </div>
      </section>

      <nav className={styles.sectionNav} aria-label="コンテンツメニュー">
        <a href="#top"><span>01</span>TOP</a>
        <a href="#latest"><span>02</span>最新授業</a>
        <a href="#about"><span>03</span>一果センセー</a>
      </nav>

      <section className={styles.introSection}>
        <p className={styles.sectionKicker}>BOAT RACE BEGINNER CLASS</p>
        <h2>ボートレースの基本を<br /><span>一果センセーと学ぼう！</span></h2>
        <p>
          「ボートレースってどんな競技？」「スタートや1マークって何？」など、
          初心者が知りたいポイントを、一果センセーが分かりやすく解説します。
        </p>
      </section>

      <section className={styles.latestSection} id="latest">
        <div className={styles.sectionHeading}>
          <div>
            <span className={styles.sectionKicker}>LATEST LESSONS</span>
            <h2>最新の授業</h2>
          </div>
          <span className={styles.swipeHint}>横にスワイプできます →</span>
        </div>

        {lessons.length > 0 ? (
          <div className={styles.slider}>
            {lessons.map((lesson, index) => (
              <article className={styles.episodeCard} key={lesson.id}>
                <div className={styles.videoWrap}>
                  <iframe
                    src={`https://www.youtube.com/embed/${lesson.id}`}
                    title={lesson.title}
                    loading="lazy"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                  <span className={styles.episodeNumber}>LESSON {index + 1}</span>
                </div>
                <div className={styles.cardBody}>
                  <h3>{lesson.title}</h3>
                  {lesson.publishedAt && <time>{formatDate(lesson.publishedAt)}</time>}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className={styles.fallbackPlayer}>
            <iframe
              src={`https://www.youtube.com/embed/videoseries?list=${PLAYLIST_ID}`}
              title="教えて！一果センセー 再生リスト"
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
            <p>最新動画を再生リストから表示しています。</p>
          </div>
        )}

        <a href={PLAYLIST_URL} target="_blank" rel="noopener noreferrer" className={styles.youtubeButton}>
          YouTubeで授業をすべて見る <span aria-hidden="true">›</span>
        </a>
      </section>

      <section className={styles.teacherSection} id="about">
        <div className={styles.teacherImage}>
          <img src="/comic/ichika.jpeg" alt="一果センセー" />
        </div>
        <div className={styles.teacherBody}>
          <span className={styles.sectionKicker}>TEACHER PROFILE</span>
          <p className={styles.teacherRole}>イン逃げ担当・初心者講座</p>
          <h2>一果センセー</h2>
          <p>
            ボートレースの基本やレースの見どころを、初心者にも伝わる言葉で解説。
            難しい専門用語も、図や具体例を使いながら一緒に学んでいきます。
          </p>
          <div className={styles.tags}>
            <span>初心者向け</span>
            <span>イン逃げ</span>
            <span>基本ルール</span>
            <span>1マーク解説</span>
          </div>
        </div>
      </section>

      <section className={styles.channelSection}>
        <h2>BoatStrikers公式YouTube</h2>
        <p>一果センセーの授業や、ボートレースのショート動画を配信しています。</p>
        <a href={CHANNEL_URL} target="_blank" rel="noopener noreferrer">チャンネルを見る</a>
      </section>
    </main>
  );
}
