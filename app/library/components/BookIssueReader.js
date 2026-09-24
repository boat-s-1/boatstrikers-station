import Link from "next/link";
import BookSwipeViewer from "./BookSwipeViewer";
import BookArticle from "./BookArticle";
import styles from "./BookIssueReader.module.css";
export default function BookIssueReader({series,issue}){const shelf=series.basePath||`/${series.slug}`;return <><BookSwipeViewer series={series} issue={issue}/><BookArticle article={issue.article}/><nav className={styles.bookNav} aria-label="本のナビゲーション"><Link href={shelf}>← 本の一覧へ戻る</Link><Link href="/ichika">一果の部屋へ</Link></nav></>}
