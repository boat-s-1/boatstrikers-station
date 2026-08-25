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
import CourseQuickNav from "../components/CourseQuickNav";
import StadiumHeroBanner from "../components/StadiumHeroBanner";

export const revalidate = 30;

export default async function CoursePage({ params, searchParams }) {
  const route = await params;
  const query = await searchParams;

  const courseCode = normalizeCourseCode(route.courseCode);
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
      <StadiumHeroBanner courseCode={courseCode} />

      <CourseQuickNav
        courseCode={courseCode}
        raceDate={raceDate}
        races={races}
      />

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
              <article id={`race-card-${race.race_no}`} className={styles.raceCard} key={race.race_no}>
                <div className={styles.raceCardHead}>
                  <div className={styles.raceNo}>
                    <strong>{race.race_no}</strong><span>R</span>
                  </div>
                  <div className={styles.raceCardTitleArea}>
                    <h2>{courseName} {race.race_no}R</h2>
                    <p>
                      {race.entries.length}艇・同期{" "}
                      {formatJstDateTime(race.synced_at)}
                    </p>
                    <div className={styles.raceClosingTime}>
                      <span>締切予定</span>
                      <strong>
                        {race.closing_time
                          ? String(race.closing_time).slice(0, 5)
                          : "--:--"}
                      </strong>
                    </div>
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
                      <span className={`${styles.boatBadge} ${styles[`boat${entry.boat_no}`]}`}>
                        {entry.boat_no}
                      </span>
                      <div className={styles.miniEntryInline}>
                        <span className={styles.miniEntryName}>
                          {normalizeRacerName(entry.racer_name)}
                        </span>
                        <span className={styles.miniEntryClass}>
                          {entry.racer_class || "-"}
                        </span>
                        <span className={styles.miniEntryMotor}>
                          モーター
                          {entry.motor_2_rate != null
                            ? `${Number(entry.motor_2_rate).toFixed(1)}%`
                            : "-"}
                        </span>
                        <span className={styles.miniEntryNation}>
                          全国勝率{formatNumber(entry.national_win_rate)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {Number.isFinite(Number(race.race_no)) && Number(race.race_no) >= 1 && Number(race.race_no) <= 12 && (
                  <Link
                    href={`/races/${String(courseCode).padStart(2, "0")}/${Number(race.race_no)}?date=${raceDate}`}
                    className={styles.primaryButton}
                    prefetch={false}
                  >
                    <span>出走表・AI情報を見る</span>
                    <span>→</span>
                  </Link>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
