import Link from "next/link";
import { formatNewsShortDate, isNewNews, newsBucketLabel } from "../../lib/newsTaxonomy";
import styles from "./page.module.css";

export function categoryClass(bucket) {
  return styles[`cat_${bucket}`] || styles.cat_all;
}

// 一覧の1行。サーバー描画と「もっと見る」の追加読み込みで同じ表示にするため共通化している。
export default function NewsHeadlineRow({ item, now }) {
  return (
    <Link href={`/news/${item.id}`} className={styles.headlineRow}>
      <time dateTime={item.publishedAt || undefined}>{formatNewsShortDate(item.publishedAt)}</time>
      <strong>{item.headline}</strong>
      <span className={styles.rowTags}>
        {isNewNews(item.publishedAt, now) && <span className={styles.newBadge}>NEW</span>}
        <span className={`${styles.categoryBadge} ${categoryClass(item.bucket)}`}>{newsBucketLabel(item.bucket)}</span>
      </span>
      <span className={styles.arrow}>›</span>
    </Link>
  );
}
