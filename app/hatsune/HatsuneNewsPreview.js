import Link from "next/link";
import styles from "./HatsuneNewsPreview.module.css";
import {
  HATSUNE_NEWS_LABELS,
  formatHatsuneNewsDate,
  getHatsuneNewsImage,
} from "./newsData";

function NewsCard({ item }) {
  const label = HATSUNE_NEWS_LABELS[item.category] || HATSUNE_NEWS_LABELS.topic;
  const thumbnail = getHatsuneNewsImage(item);

  return (
    <Link
      href={`/hatsune/news/${item.id}`}
      className={styles.newsItem}
    >
      <div className={styles.thumbWrap}>
        <img
          src={thumbnail}
          alt=""
          className={styles.thumb}
          loading="lazy"
          decoding="async"
        />
      </div>

      <div className={styles.newsBody}>
        <div className={styles.metaRow}>
          <span className={styles.tag}>{label}</span>
          {item.source_type === "bs_data" && (
            <span className={styles.bsTag}>BS DATA</span>
          )}
        </div>

        <h3>{item.title}</h3>

        <div className={styles.subMeta}>
          {item.place && <span>{item.place}</span>}
          <span>{formatHatsuneNewsDate(item.published_at)}</span>
        </div>
      </div>
    </Link>
  );
}

export default function HatsuneNewsPreview({ news = [] }) {
  const previewNews = news.slice(0, 3);

  return (
    <section className={styles.wrap}>
      <div className={styles.bannerHeading}>
        <img
          src="/top/IMG_7847.jpeg?v=20260831-2321"
          alt="女子ボートNEWS"
          className={styles.bannerImage}
        />
      </div>

      {previewNews.length > 0 ? (
        <div className={styles.list}>
          {previewNews.map((item) => (
            <NewsCard key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <div className={styles.empty}>
          <strong>初音NEWSは準備中です</strong>
          <p>
            夜間の自動収集を接続すると、水神祭・優勝・級別・女子戦結果・高モーター・翌日情報がここに表示されます。
          </p>
        </div>
      )}

      <Link href="/hatsune/news" className={styles.moreButton}>
        女子ボートNEWSをもっと見る →
      </Link>
    </section>
  );
}
