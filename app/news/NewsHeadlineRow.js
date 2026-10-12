import Link from "next/link";
import { NEWS_CHARACTERS, formatNewsShortDate, formatNewsTime, isNewNews, newsBucketLabel, newsDayKey, newsDayLabel } from "../../lib/newsTaxonomy";
import NewsCharacterFace from "./NewsCharacterFace";
import styles from "./newsTheme.module.css";

export function categoryClass(bucket) {
  return styles[`cat_${bucket}`] || styles.cat_all;
}

export function NewsMarks({ item, now, showNew = true }) {
  return (
    <>
      <span className={`${styles.chip} ${categoryClass(item.bucket)}`}>{newsBucketLabel(item.bucket)}</span>
      {item.bsData && <span className={styles.bsMark}>BS DATA</span>}
      {showNew && isNewNews(item.publishedAt, now) && <span className={styles.newMark}>NEW</span>}
    </>
  );
}

// 一覧の1行。サーバー描画と「もっと見る」の追加読み込みで同じ表示にするため共通化している。
// timeMode="time" は日付区切りの下で時刻だけ、"date" は月日を表示する。
export default function NewsHeadlineRow({ item, now, timeMode = "time", showNew = true }) {
  const character = item.character ? NEWS_CHARACTERS[item.character] : null;
  // 判定理由（characterReason）は内部用。読者向けには担当名と担当分野だけを出す。
  const characterTitle = character ? `${character.name}担当（${character.role}）` : undefined;
  return (
    <Link href={`/news/${item.id}`} className={styles.row}>
      <time dateTime={item.publishedAt || undefined}>{timeMode === "time" ? formatNewsTime(item.publishedAt) : formatNewsShortDate(item.publishedAt)}</time>
      <span className={styles.rowMain}>
        <strong>{item.headline}</strong>
        <span className={styles.rowMeta}><NewsMarks item={item} now={now} showNew={showNew} /></span>
      </span>
      {character && <span className={styles.rowFace} aria-label={characterTitle}><NewsCharacterFace character={item.character} size={24} title={characterTitle} /></span>}
    </Link>
  );
}

// 日付区切り付きの一覧。previousDayKey は直前に表示済みの最後の記事の日付（追加読み込み時の続き用）。
export function NewsDatedList({ items, now, previousDayKey = "" }) {
  let current = previousDayKey;
  const nodes = [];
  for (const item of items) {
    const key = newsDayKey(item.publishedAt);
    if (key !== current) {
      current = key;
      nodes.push(<div key={`d-${key}-${item.id}`} className={styles.dateSep}>{newsDayLabel(item.publishedAt, now)}</div>);
    }
    nodes.push(<NewsHeadlineRow key={item.id} item={item} now={now} />);
  }
  return <div className={styles.list}>{nodes}</div>;
}
