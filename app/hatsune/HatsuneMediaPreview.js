import Link from "next/link";
import { getOfficialYoutubeUpdates, formatMediaDate } from "../news/media/mediaData";
import { getMediaEditorialMap } from "../../lib/mediaEditorialData";
import styles from "./HatsuneMediaPreview.module.css";

function fallbackHeadline(title) {
  const clean = String(title || "公式YouTube更新").replace(/[【\[].*?[】\]]/g, " ").replace(/#\S+/g, " ").replace(/\s+/g, " ").trim();
  return clean.length > 30 ? `${clean.slice(0, 29)}…` : clean;
}

export default async function HatsuneMediaPreview() {
  const videos = await getOfficialYoutubeUpdates({ limit: 3, womenOnly: true });
  if (!videos.length) return null;
  const editorialMap = await getMediaEditorialMap(videos.map((item) => item.videoId));

  return (
    <section className={styles.section}>
      <Link href="/news/media" className={styles.bannerHeading}>
        <img
          src="/top/IMG_7863.jpeg?v=20260901-0445"
          alt="女子ボート関連動画"
          className={styles.bannerImage}
        />
      </Link>

      <div className={styles.list}>
        {videos.map((item) => (
          <Link key={item.id} href={`/news/media/${item.videoId}`} className={styles.card}>
            <img src={item.thumbnailUrl} alt="" loading="lazy" />
            <div>
              <div className={styles.meta}>
                <strong>{item.place}公式</strong>
                <time>{formatMediaDate(item.publishedAt)}</time>
              </div>
              <h3>{editorialMap[item.videoId]?.short_headline || fallbackHeadline(item.title)}</h3>
              <span>BoatStrikersで内容を見る →</span>
            </div>
          </Link>
        ))}
      </div>

      <Link href="/news/media" className={styles.moreButton}>
        女子ボート関連動画をもっと見る →
      </Link>
    </section>
  );
}
