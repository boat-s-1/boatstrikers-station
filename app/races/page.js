import Link from "next/link";
import {
  formatJstDateTime,
  getAvailableDates,
  getCoursesByDate,
  normalizeDate,
} from "../lib/boatstrikersPlatform";
import styles from "./phase2.module.css";

export const dynamic = "force-dynamic";

export default async function RacesPage({ searchParams }) {
  const query = await searchParams;
  const raceDate = normalizeDate(query?.date);

  let courses = [];
  let dates = [];
  let loadError = null;

  try {
    [courses, dates] = await Promise.all([
      getCoursesByDate(raceDate),
      getAvailableDates(),
    ]);
  } catch (error) {
    console.error(error);
    loadError = error.message;
  }

  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroInner}>
          <Link href="/" className={styles.backPill}>← ホーム</Link>

          <div className={styles.heroMain}>
            <div className={styles.heroIcon}>🚤</div>
            <div>
              <p className={styles.eyebrow}>BOATSTRIKERS LIVE</p>
              <h1>本日の開催場</h1>
              <p>PC-KYOTEIから5分ごとに自動更新</p>
              <div className={styles.heroMeta}>
                <span>{raceDate}</span>
                <span>{courses.length}場開催</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <section className={styles.content}>
        {dates.length > 0 && (
          <nav className={styles.dateNav}>
            {dates.map((date) => (
              <Link
                key={date}
                href={`/races?date=${date}`}
                className={`${styles.dateLink} ${
                  date === raceDate ? styles.dateLinkActive : ""
                }`}
              >
                {date}
              </Link>
            ))}
          </nav>
        )}

        <div className={styles.sectionHeading}>
          <div>
            <p>TODAY&apos;S COURSES</p>
            <h2>開催場を選択</h2>
          </div>
          <span>{courses.length}場</span>
        </div>

        {loadError ? (
          <div className={styles.messageCard}>
            <strong>⚠️ データを取得できませんでした</strong>
            <p>{loadError}</p>
          </div>
        ) : courses.length === 0 ? (
          <div className={styles.messageCard}>
            <strong>🚤 この日の開催データはありません</strong>
            <p>PC-KYOTEIから同期済みの日付を選択してください。</p>
          </div>
        ) : (
          <div className={styles.courseGrid}>
            {courses.map((course) => (
              <article className={styles.courseCard} key={course.courseCode}>
                <div className={styles.courseCardTop}>
                  <div className={styles.courseTitle}>
                    <span>{String(course.courseCode).padStart(2, "0")}</span>
                    <h2>{course.courseName}</h2>
                  </div>
                  <b>出走表公開</b>
                </div>

                <div className={styles.courseStats}>
                  <div>
                    <span>レース</span>
                    <strong>{course.raceCount}R</strong>
                  </div>
                  <div>
                    <span>展示公開</span>
                    <strong>{course.exhibitionCount}R</strong>
                  </div>
                  <div>
                    <span>最終同期</span>
                    <strong>{formatJstDateTime(course.syncedAt)}</strong>
                  </div>
                </div>

                <Link
                  href={`/races/${String(course.courseCode).padStart(
                    2,
                    "0"
                  )}?date=${raceDate}`}
                  className={styles.primaryButton}
                >
                  <span>1R〜12Rを見る</span>
                  <span>→</span>
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
