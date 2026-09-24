import Link from "next/link";
import MagazineSwipeViewer from "./MagazineSwipeViewer";
import BookArticle from "./BookArticle";
import styles from "./BookIssueReader.module.css";

export default function BookIssueReader({ series, issue }) {
  return (
    <>
      <MagazineSwipeViewer magazine={series} issue={issue} />
      <BookArticle article={issue.article} />
      <nav className={styles.bookNav} aria-label="本のナビゲーション">
        <Link href={`/${series.slug}`}>← 本の一覧へ戻る</Link>
        <Link href="/ichika">一果の部屋へ</Link>
      </nav>
    </>
  );
}
