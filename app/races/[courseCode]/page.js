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
      <header className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.topLinks}>
            <Link href={`/races?date=${raceDate}`} className={styles.backPill}>
              ← 開催場一覧
            </Link>
            <Link href="/" className={styles.backPill}>ホーム</Link>
          </div>

          <div className={styles.heroMain}>
            <div className={styles.heroIcon}>🚤</div>
            <div>
              <p className={styles.eyebrow}>
                BOAT RACE {String(courseCode).padStart(2, "0")}
              </p>
              <h1>{courseName}</h1>
              <p>1R〜12R 出走表一覧</p>
              <div className={styles.heroMeta}>
                <span>{raceDate}</span>
                <span>{races.length}レース</span>
              </div>
            </div>
          </div>
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
