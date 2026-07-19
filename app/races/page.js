import Link from "next/link";
import {
  formatJstDateTime,
  getAvailableDates,
  getCoursesByDate,
  normalizeDate,
} from "../lib/boatstrikersPlatform";
import styles from "./phase2.module.css";

const NIGHT_COURSE_CODES = new Set([
  1,  // 桐生
  7,  // 蒲郡
  12, // 住之江
  15, // 丸亀
  19, // 下関
  20, // 若松
  24, // 大村
]);

function getCourseRaceType(courseCode) {
  return NIGHT_COURSE_CODES.has(Number(courseCode))
    ? "night"
    : "day";
}

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
    loadError =
      error instanceof Error
        ? error.message
        : "データの取得中にエラーが発生しました。";
  }

  return (
    <main className={styles.page}>
      {/* =====================================================
          トップバナー
      ===================================================== */}
      <header className={styles.racesHero}>
        {/* 背景画像 */}
        <div className={styles.racesHeroBackground} />

        {/* 文字を見やすくする暗いレイヤー */}
        <div className={styles.racesHeroOverlay} />

        {/* AIスキャンライン */}
        <div className={styles.racesHeroScanLine} />

        {/* 装飾の光 */}
        <div className={styles.racesHeroGlow} />

        <div className={styles.racesHeroInner}>
          <Link href="/" className={styles.racesBackPill}>
            <span>←</span>
            <span>ホーム</span>
          </Link>

          <div className={styles.racesHeroMain}>
            <div className={styles.racesHeroText}>
              <p className={styles.racesHeroEyebrow}>
                BOATSTRIKERS LIVE DATABASE
              </p>

              <h1>本日の開催場</h1>

              <div className={styles.racesHeroMeta}>
                <span>
                  <small>RACE DATE</small>
                  <strong>{raceDate}</strong>
                </span>

                <span>
                  <small>TODAY&apos;S COURSES</small>
                  <strong>{courses.length}場開催</strong>
                </span>

                <span className={styles.racesHeroLive}>
                  <i />
                  <strong>自動更新中</strong>
                </span>
              </div>
            </div>

            {/* 右下のAIステータス */}
            <div className={styles.racesHeroStatus}>
              <div className={styles.racesHeroStatusHeader}>
                <span>AI RACE CENTER</span>
                <b>ONLINE</b>
              </div>

              <div className={styles.racesHeroStatusBody}>
                <div>
                  <small>開催場</small>
                  <strong>{courses.length}</strong>
                </div>

                <div>
                  <small>更新間隔</small>
                  <strong>5分</strong>
                </div>

                <div>
                  <small>システム</small>
                  <strong>稼働中</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* =====================================================
          開催場一覧
      ===================================================== */}
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
            {courses.map((course) => {
  const courseCode = String(
    course.courseCode
  ).padStart(2, "0");

  const raceType = getCourseRaceType(
    course.courseCode
  );

  const isNight = raceType === "night";

  return (
    <article
      className={`${styles.courseCard} ${
        isNight
          ? styles.courseCardNight
          : styles.courseCardDay
      }`}
      key={course.courseCode}
    >
      <div className={styles.courseCardTop}>
        <div className={styles.courseTitle}>
          <span>{courseCode}</span>

          <div>
            <h2>{course.courseName}</h2>

            <small
              className={
                isNight
                  ? styles.nightTypeLabel
                  : styles.dayTypeLabel
              }
            >
              {isNight ? "NIGHT RACE" : "DAY RACE"}
            </small>
          </div>
        </div>

        <div className={styles.courseBadges}>
          <b>出走表公開</b>

          <span
            className={
              isNight
                ? styles.nightBadge
                : styles.dayBadge
            }
          >
            {isNight ? "🌙 ナイター" : "☀️ デイ"}
          </span>
        </div>
      </div>

      <div className={styles.courseStats}>
        <div>
          <span>レース</span>
          <strong>{course.raceCount}R</strong>
        </div>

        <div>
          <span>展示公開</span>
          <strong>
            {course.exhibitionCount}R
          </strong>
        </div>

        <div>
          <span>最終同期</span>
          <strong>
            {formatJstDateTime(course.syncedAt)}
          </strong>
        </div>
      </div>

      <Link
        href={`/races/${courseCode}?date=${raceDate}`}
        className={`${styles.primaryButton} ${
          isNight
            ? styles.primaryButtonNight
            : styles.primaryButtonDay
        }`}
      >
        <span>1R〜12Rを見る</span>
        <span>→</span>
      </Link>
    </article>
  );
})}
          </div>
        )}
      </section>
    </main>
  );
}
