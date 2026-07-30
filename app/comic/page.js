import Parser from "rss-parser";
import styles from "./comic.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PLAYLIST_ID =
  process.env.MINAMO_YOUTUBE_PLAYLIST_ID ||
  "PLc-EenUbZSQm-GnGt_afC3xUuDcI2DD0T";

const CHANNEL_URL =
  process.env.NEXT_PUBLIC_MINAMO_YOUTUBE_URL ||
  "https://www.youtube.com/@boatstrikers_official";

function getVideoId(item) {
  if (item?.id?.startsWith("yt:video:")) {
    return item.id.replace("yt:video:", "");
  }

  if (item?.link) {
    try {
      const url = new URL(item.link);
      return url.searchParams.get("v");
    } catch {
      return null;
    }
  }

  return null;
}

async function getLatestEpisodes() {
  const parser = new Parser();
  const feedUrl = `https://www.youtube.com/feeds/videos.xml?playlist_id=${PLAYLIST_ID}`;

  try {
    const feed = await parser.parseURL(feedUrl);

    return (feed.items || [])
      .map((item) => ({
        id: getVideoId(item),
        title: item.title || "私立みなも学園",
        publishedAt: item.pubDate || item.isoDate || null,
      }))
      .filter((item) => item.id)
      .slice(0, 3);
  } catch (error) {
    console.error("みなも学園の再生リストを取得できませんでした。", error);
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

export default async function ComicPage() {
  const episodes = await getLatestEpisodes();
  const playlistUrl = `https://www.youtube.com/playlist?list=${PLAYLIST_ID}`;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <a href="/" className={styles.logo} aria-label="BoatStrikers ホーム">
          BOAT
          <br />
          <span>STRIKERS</span>
        </a>

        <a className={styles.lineButton} href="https://lin.ee/Pf3FEEQ">
          LINE登録
        </a>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroGlow} aria-hidden="true" />
        <p className={styles.eyebrow}>BOAT RACE SCHOOL COMEDY</p>
        <h1>私立みなも学園</h1>
        <p className={styles.subtitle}>〜ふなけん研究部〜</p>
        <p className={styles.description}>
          一果・初音・キイナが、学校の日常をボートレースに例えて大騒ぎ。
          ゆるく楽しめるショートアニメです。
        </p>
      </section>

      <section className={styles.latestSection}>
        <div className={styles.sectionHeading}>
          <div>
            <span className={styles.sectionKicker}>NEW EPISODES</span>
            <h2>最新話はコチラ</h2>
          </div>
          <span className={styles.swipeHint}>横にスライドできます →</span>
        </div>

        {episodes.length > 0 ? (
          <div className={styles.slider} aria-label="みなも学園 最新3話">
            {episodes.map((episode, index) => (
              <article className={styles.episodeCard} key={episode.id}>
                <div className={styles.videoWrap}>
                  <iframe
                    src={`https://www.youtube.com/embed/${episode.id}?rel=0`}
                    title={episode.title}
                    loading="lazy"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allowFullScreen
                  />
                  <span className={styles.episodeNumber}>第{index + 1}枠</span>
                </div>

                <div className={styles.cardBody}>
                  <h3>{episode.title}</h3>
                  {episode.publishedAt && (
                    <time dateTime={episode.publishedAt}>
                      {formatDate(episode.publishedAt)} 公開
                    </time>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className={styles.fallbackPlayer}>
            <iframe
              src={`https://www.youtube.com/embed/videoseries?list=${PLAYLIST_ID}`}
              title="私立みなも学園 再生リスト"
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
            <p>
              最新3話を取得できないため、再生リストを表示しています。
            </p>
          </div>
        )}

        <a
          href={playlistUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.youtubeButton}
        >
          YouTubeで全話を見る
          <span aria-hidden="true">›</span>
        </a>
      </section>

      <section className={styles.aboutSection}>
        <span className={styles.sectionKicker}>CHARACTERS</span>
        <h2>ふなけん研究部の3人</h2>
        <div className={styles.characterGrid}>
          <article>
            <span className={styles.laneOne}>1</span>
            <h3>一果</h3>
            <p>まじめな部長。いつもキイナのボートレース例えにツッコミを入れる。</p>
          </article>
          <article>
            <span className={styles.laneFour}>4</span>
            <h3>初音</h3>
            <p>落ち着いて見えて意外とノリがいい、女子戦好きの研究部員。</p>
          </article>
          <article>
            <span className={styles.laneFive}>5</span>
            <h3>キイナ</h3>
            <p>何でも5号艇や穴狙いに例える自由人。騒動の中心になりがち。</p>
          </article>
        </div>
      </section>

      <section className={styles.channelSection}>
        <h2>BoatStrikers公式YouTube</h2>
        <p>みなも学園の新作や、ボートレースのショート動画を配信しています。</p>
        <a href={CHANNEL_URL} target="_blank" rel="noopener noreferrer">
          チャンネルを見る
        </a>
      </section>
    </main>
  );
}
