import Link from "next/link";
import {
  formatJstDateTime,
  getCourseName,
  getRaceDetail,
  normalizeCourseCode,
  normalizeDate,
  normalizeRaceNo,
} from "../../../lib/boatstrikersPlatform";
import RaceDetailTabs from "../../components/RaceDetailTabs";
import styles from "../../phase2.module.css";

export const dynamic = "force-dynamic";

export default async function RaceDetailPage({ params, searchParams }) {
  const route = await params;
  const query = await searchParams;

  const courseCode = normalizeCourseCode(route.courseCode);
  const raceNo = normalizeRaceNo(route.raceNo);
  const raceDate = normalizeDate(query?.date);

  if (!courseCode || !raceNo) {
    return <main className={styles.page}>URLが正しくありません。</main>;
  }

  let data = null;
  let loadError = null;

  try {
    data = await getRaceDetail(raceDate, courseCode, raceNo);
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
            <Link
              href={`/races/${String(courseCode).padStart(
                2,
                "0"
              )}?date=${raceDate}`}
              className={styles.backPill}
            >
              ← {courseName}一覧
            </Link>
            <Link href={`/races?date=${raceDate}`} className={styles.backPill}>
              開催場
            </Link>
          </div>

          <div className={styles.heroMain}>
            <div className={styles.raceNoHero}>
              <strong>{raceNo}</strong><span>R</span>
            </div>
            <div>
              <p className={styles.eyebrow}>BOATSTRIKERS RACE CENTER</p>
              <h1>{courseName} {raceNo}R</h1>
              <p>出走表・展示・一果AI・買い目</p>
              <div className={styles.heroMeta}>
                <span>{raceDate}</span>
                <span>
                  同期 {formatJstDateTime(data?.event?.synced_at)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <section className={styles.content}>
        {loadError ? (
          <div className={styles.messageCard}>{loadError}</div>
        ) : !data?.event || data.entries.length === 0 ? (
          <div className={styles.messageCard}>
            このレースの出走表はありません。
          </div>
        ) : (
          <>
          <RaceDetailTabs
  entries={data.entries}
  previousPrediction={data.previousPrediction}
  livePrediction={data.livePrediction}
  syncedAt={formatJstDateTime(
    data?.event?.synced_at
  )}

  result={data.result}
  resultEntries={data.resultEntries}
/>

            <nav className={styles.moveNav}>
              {raceNo > 1 ? (
                <Link
                  href={`/races/${String(courseCode).padStart(2, "0")}/${
                    raceNo - 1
                  }?date=${raceDate}`}
                >
                  ← {raceNo - 1}R
                </Link>
              ) : <span />}

              {raceNo < 12 ? (
                <Link
                  href={`/races/${String(courseCode).padStart(2, "0")}/${
                    raceNo + 1
                  }?date=${raceDate}`}
                >
                  {raceNo + 1}R →
                </Link>
              ) : <span />}
            </nav>
          </>
        )}
      </section>
    </main>
  );
}
