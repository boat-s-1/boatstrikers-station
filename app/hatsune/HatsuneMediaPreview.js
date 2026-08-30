import Link from "next/link";
import { getOfficialYoutubeUpdates, formatMediaDate } from "../news/media/mediaData";
import styles from "./HatsuneMediaPreview.module.css";

export default async function HatsuneMediaPreview() {
  const videos = await getOfficialYoutubeUpdates({ limit: 3, womenOnly: true });
  if (!videos.length) return null;

  return (
    <section className={styles.section}>
      <div className={styles.heading}>
        <div>
          <span>OFFICIAL YOUTUBE</span>
          <h2>🌸 女子ボート関連動画</h2>
        </div>
        <Link href="/news/media">MEDIAを見る →</Link>
      </div>

      <div className={styles.list}>
        {videos.map((item) => (
          <a key={item.id} href={item.url} target="_blank" rel="noreferrer" className={styles.card}>
            <img src={item.thumbnailUrl} alt="" loading="lazy" />
            <div>
              <div className={styles.meta}>
                <strong>{item.place}公式</strong>
                <time>{formatMediaDate(item.publishedAt)}</time>
              </div>
              <h3>{item.title}</h3>
              <span>YouTubeで見る ↗</span>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
