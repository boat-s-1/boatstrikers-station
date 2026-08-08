import Link from "next/link";
import { getCourseName, getPublishedNoteFeaturesByDate, normalizeCourseCode, normalizeDate } from "../../../lib/boatstrikersPlatform";
import styles from "./newspaper.module.css";

export const dynamic = "force-dynamic";

function timingLabel(value) {
  if (value === "previous") return "前日版";
  if (value === "live") return "直前版";
  return "前日・直前";
}

export default async function TodayNewspaperPage({ params, searchParams }) {
  const route = await params;
  const query = await searchParams;
  const courseCode = normalizeCourseCode(route.courseCode);
  const raceDate = normalizeDate(query?.date);
  const courseName = getCourseName(courseCode);
  const items = (await getPublishedNoteFeaturesByDate(raceDate)).filter((item) => Number(item.course_code) === Number(courseCode));
  const freeItems = items.filter((item) => !item.is_paid);
  const paidItems = items.filter((item) => item.is_paid);
  const code = String(courseCode).padStart(2, "0");

  return <main className={styles.page}>
    <header className={styles.header}><Link href={`/races/${code}?date=${raceDate}`}>← {courseName} レース一覧</Link><span>BOATSTRIKERS NEWSPAPER</span></header>
    <section className={styles.hero}><small>TODAY&apos;S NEWSPAPER</small><h1>今日の{courseName}<br />予想新聞</h1><p>{raceDate.replaceAll("-", "/")} ・ 公開中のnoteをまとめて表示</p></section>

    <section className={styles.section}>
      <div className={styles.heading}><span>FREE</span><h2>無料で読める新聞</h2></div>
      {freeItems.length ? <div className={styles.grid}>{freeItems.map(item => <Article item={item} key={item.id || item.note_url} />)}</div> : <Empty text="本日の無料新聞はまだ公開されていません。" />}
    </section>

    <section className={`${styles.section} ${styles.premium}`}>
      <div className={styles.heading}><span>PREMIUM</span><h2>有料・詳細分析</h2></div>
      {paidItems.length ? <div className={styles.grid}>{paidItems.map(item => <Article item={item} key={item.id || item.note_url} />)}</div> : <Empty text="本日の有料・詳細分析はまだ公開されていません。" />}
    </section>

    <section className={styles.links}><Link href="/library/free">無料新聞一覧を見る</Link><a href="https://note.com/boat_strikers" target="_blank" rel="noopener noreferrer">BoatStrikers noteを開く ↗</a></section>
  </main>;
}

function Article({ item }) {
  return <a className={styles.card} href={item.note_url} target="_blank" rel="noopener noreferrer">
    <div><span>{item.is_paid ? "PREMIUM" : "FREE"}</span><b>{item.race_no}R</b></div>
    <small>{item.character_name || "BoatStrikers"} ・ {timingLabel(item.target_timing)}</small>
    <h3>{item.feature_title || `${item.race_no}R 予想新聞`}</h3>
    <p>{item.teaser_text || "noteで予想・レース分析をチェックできます。"}</p>
    <strong>{item.cta_label || "新聞を読む"} →</strong>
  </a>;
}
function Empty({ text }) { return <div className={styles.empty}>{text}</div>; }
