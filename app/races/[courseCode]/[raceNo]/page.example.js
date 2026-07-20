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

export default async function RaceDetailPage({
  params,
  searchParams,
}) {
  const route = await params;
  const query = await searchParams;

  const courseCode = normalizeCourseCode(route.courseCode);
  const raceNo = normalizeRaceNo(route.raceNo);
  const raceDate = normalizeDate(query?.date);

  if (!courseCode || !raceNo) {
    return (
      <main className={styles.page}>
        URLが正しくありません。
      </main>
    );
  }

  let data = null;
  let loadError = null;

  try {
    data = await getRaceDetail(
      raceDate,
      courseCode,
      raceNo
    );
  } catch (error) {
    console.error(error);
    loadError =
      error instanceof Error
        ? error.message
        : "レース情報を取得できませんでした。";
  }

  return (
    <main className={styles.page}>
      <section className={styles.content}>
        <Link
          href={`/races/${String(courseCode).padStart(
            2,
            "0"
          )}?date=${raceDate}`}
          className={styles.backPill}
        >
          ← {getCourseName(courseCode)}のレース一覧
        </Link>

        {loadError || !data ? (
          <div className={styles.messageCard}>
            <strong>データを取得できませんでした</strong>
            <p>{loadError || "レース情報がありません。"}</p>
          </div>
        ) : (
          <RaceDetailTabs
            courseCode={courseCode}
            raceNo={raceNo}
            raceDate={raceDate}
            event={data.event}
            entries={data.entries}
            previousPrediction={data.previousPrediction}
            livePrediction={data.livePrediction}
            syncedAt={formatJstDateTime(
              data?.event?.synced_at
            )}
            result={data.result}
            resultEntries={data.resultEntries}
          />
        )}
      </section>
    </main>
  );
}
