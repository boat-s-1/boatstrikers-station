import Link from "next/link";
import {
  formatJstDateTime,
  formatNumber,
  getCourseName,
  getCourseRaces,
  normalizeCourseCode,
  normalizeDate,
  normalizeRacerName,
} from "../../lib/boatstrikersPlatform";
import styles from "../phase2.module.css";

export const dynamic = "force-dynamic";

const COURSE_HEADER_BACKGROUNDS = {
  1: "/course-headers/A095D5F8-14FA-482F-A13F-C052DD3AF4C8.png",
  2: "/course-headers/02.png",
  3: "/course-headers/03.png",
  4: "/course-headers/04.png",
  5: "/course-headers/05.png",
  6: "/course-headers/06.png",
  7: "/course-headers/07.png",
  8: "/course-headers/08.png",
  9: "/course-headers/09.png",
  10: "/course-headers/10.png",
  11: "/course-headers/11.png",
  12: "/course-headers/12.png",
  13: "/course-headers/13.png",
  14: "/course-headers/14.png",
  15: "/course-headers/15.png",
  16: "/course-headers/16.png",
  17: "/course-headers/17.png",
  18: "/course-headers/18.png",
  19: "/course-headers/19.png",
  20: "/course-headers/20.png",
  21: "/course-headers/21.png",
  22: "/course-headers/22.png",
  23: "/course-headers/23.png",
  24: "/course-headers/24.png",
  };


export default async function CoursePage({ params, searchParams }) {
  const route = await params;
  const query = await searchParams;

  const courseCode = normalizeCourseCode(route.courseCode);
  const numericCourseCode = Number(courseCode);

const headerBackground =
  COURSE_HEADER_BACKGROUNDS[numericCourseCode] ||
  "/course-headers/default.png";
  const raceDate = normalizeDate(query?.date);

  if (!courseCode) {
    return <main className={styles.page}>開催場コードが正しくありません。</main>;
  }

  let races = [];
  let loadError = null;

  try {
    races = await getCourseRaces(raceDate, courseCode);
  } catch (error) {
    console.error(error);
    loadError = error.message;
  }

  

  

  const courseName = getCourseName(courseCode);

  return (
    <main className={styles.page}>
      <header
  className={styles.courseHero}
  style={{
    backgroundImage: `
      linear-gradient(
        135deg,
        rgba(2, 45, 105, 0.78),
        rgba(0, 133, 214, 0.48)
      ),
      url("${headerBackground}")
    `,
  }}
>
        <div className={styles.heroInner}>
          <div className={styles.topLinks}>
            <Link href={`/races?date=${raceDate}`} className={styles.backPill}>
              ← 開催場一覧
            </Link>
            <Link href="/" className={styles.backPill}>ホーム</Link>
          </div>

       
      </header>

      <section className={styles.content}>
        <div className={styles.sectionHeading}>
          <div>
            <p>RACE SCHEDULE</p>
            <h2>レースを選択</h2>
          </div>
          <span>{races.length}R</span>
        </div>

        {loadError ? (
          <div className={styles.messageCard}>{loadError}</div>
        ) : (
          <div className={styles.raceGrid}>
            {races.map((race) => (
              <article className={styles.raceCard} key={race.race_no}>
                <div className={styles.raceCardHead}>
                  <div className={styles.raceNo}>
                    <strong>{race.race_no}</strong><span>R</span>
                  </div>
                  <div>
                    <h2>{courseName} {race.race_no}R</h2>
                    <p>
                      {race.entries.length}艇・同期{" "}
                      {formatJstDateTime(race.synced_at)}
                    </p>
                  </div>
                  <b className={styles.statusBadge}>
                    {race.race_status === "exhibition"
                      ? "展示公開"
                      : "出走表公開"}
                  </b>
                </div>

                <div className={styles.miniEntryList}>
                  {race.entries.map((entry) => (
                    <div className={styles.miniEntry} key={entry.boat_no}>
                      <span
                        className={`${styles.boatBadge} ${
                          styles[`boat${entry.boat_no}`]
                        }`}
                      >
                        {entry.boat_no}
                      </span>
                      <strong>{normalizeRacerName(entry.racer_name)}</strong>
                      <small>
                        全国 {formatNumber(entry.national_win_rate)}
                      </small>
                    </div>
                  ))}
                </div>

                <Link
                  href={`/races/${String(courseCode).padStart(2, "0")}/${
                    race.race_no
                  }?date=${raceDate}`}
                  className={styles.primaryButton}
                >
                  <span>出走表・AI情報を見る</span>
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
