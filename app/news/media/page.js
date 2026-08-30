import Link from "next/link";
import { getOfficialYoutubeUpdates, formatMediaDate, OFFICIAL_YOUTUBE_CHANNELS } from "./mediaData";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "MEDIA | BoatStrikers NEWS",
  description: "ボートレース場の公式YouTube最新動画をBoatStrikers独自の紹介ページからチェック。",
};

function shortHeadline(title) {
  const clean = String(title || "公式YouTube更新").replace(/[【\[].*?[】\]]/g, " ").replace(/#\S+/g, " ").replace(/\s+/g, " ").trim();
  return clean.length > 30 ? `${clean.slice(0, 29)}…` : clean;
}

export default async function MediaPage() {
  const updates = await getOfficialYoutubeUpdates({ limit: 24 });

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div>
            <span className={styles.eyebrow}>BOATSTRIKERS MEDIA</span>
            <h1>公式YouTube 更新情報</h1>
            <p>公式動画を、BoatStrikersの紹介・注目ポイントと一緒にチェック。</p>
          </div>
          <Link href="/news" className={styles.back}>← NEWS</Link>
        </header>

        <nav className={styles.tabs}>
          <Link href="/news">主要</Link><Link href="/news?category=women">女子</Link><Link href="/news?category=grade">SG・G1</Link><Link href="/news?category=win">優勝</Link><Link href="/news?category=motor">モーター</Link><Link href="/news/media" className={styles.active}>MEDIA</Link>
        </nav>

        <section className={styles.channelStrip}>
          {OFFICIAL_YOUTUBE_CHANNELS.map((channel) => (
            <a key={channel.key} href={channel.channelUrl} target="_blank" rel="noreferrer"><strong>{channel.place}</strong><span>公式YouTube ↗</span></a>
          ))}
        </section>

        <section className={styles.listSection}>
          <div className={styles.sectionHeading}><h2>最新の公式動画</h2><span>{updates.length}件</span></div>
          {updates.length ? (
            <div className={styles.list}>
              {updates.map((item) => (
                <Link key={item.id} href={`/news/media/${item.videoId}`} className={styles.row}>
                  {item.thumbnailUrl ? <img src={item.thumbnailUrl} alt="" loading="lazy" /> : <div className={styles.noImage}>YouTube</div>}
                  <div className={styles.body}>
                    <div className={styles.meta}><span>{item.place}公式</span><time>{formatMediaDate(item.publishedAt)}</time>{item.womenRelated && <b>女子</b>}</div>
                    <h3>{shortHeadline(item.title)}</h3>
                    <small>BoatStrikersで内容を見る →</small>
                  </div>
                </Link>
              ))}
            </div>
          ) : <div className={styles.empty}>現在、公式YouTubeの更新情報を取得できません。</div>}
        </section>
      </div>
    </main>
  );
}
