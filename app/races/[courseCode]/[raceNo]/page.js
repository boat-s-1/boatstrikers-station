import Link from "next/link";
import Image from "next/image";
import {
  formatJstDateTime,
  getCourseName,
  getRaceDetail,
  normalizeCourseCode,
  normalizeDate,
  normalizeRaceNo,
} from "../../../lib/boatstrikersPlatform";
import RaceDetailTabs from "../../components/RaceDetailTabs";
import StadiumHeroBanner from "../../components/StadiumHeroBanner";
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
        : "出走表の読み込みに失敗しました。";
  }

  const courseName = getCourseName(courseCode);
  const paddedCourseCode = String(courseCode).padStart(
    2,
    "0"
  );

  return (
    <main className={styles.page}>
      <StadiumHeroBanner courseCode={courseCode} />

      <section className={styles.compactRaceHeader}>
        <div>
          <span className={styles.compactRaceLabel}>CURRENT RACE</span>
          <strong>{courseName} {raceNo}R</strong>
        </div>
        <div className={styles.compactRaceMeta}>
          <span>{raceDate}</span>
          <span>
            同期 {formatJstDateTime(data?.event?.synced_at)}
          </span>
        </div>
      </section>

                  
<div className={styles.developingBanner}>
  <Image
    src="/S__22142979.jpg"
    alt="只今、開発中"
    className={styles.developingBannerImage}
  />
</div>


    
      <section className={styles.content}>
  {loadError ? (
    <div className={styles.messageCard}>
      {loadError}
    </div>
  ) : !data?.event ||
    !Array.isArray(data?.entries) ||
    data.entries.length === 0 ? (
    <div className={styles.messageCard}>
      このレースの出走表はありません。
    </div>
  ) : (
    <>
      <div
        style={{
          marginBottom: "16px",
          padding: "12px",
          background: "#fff3cd",
          border: "1px solid #e4c766",
          borderRadius: "10px",
          fontSize: "12px",
          whiteSpace: "pre-wrap",
        }}
      >
        {JSON.stringify(
          {
            raceDate,
            courseCode,
            raceNo,
            hasEvent: Boolean(data?.event),
            entries: data?.entries?.length ?? 0,
            hasResult: Boolean(data?.result),
            resultEntries:
              data?.resultEntries?.length ?? 0,
            trifecta:
              data?.result?.trifecta ??
              data?.result?.trifecta_result ??
              null,
          },
          null,
          2
        )}
      </div>

      <RaceDetailTabs
        event={data.event}
        entries={data.entries}
        venueBaselines={data.venueBaselines}
        previousPrediction={
          data.previousPrediction
        }
        noteFeature={data.noteFeature}
        livePrediction={data.livePrediction}
        syncedAt={
          data?.event?.synced_at
            ? formatJstDateTime(
                data.event.synced_at
              )
            : null
        }
        result={data.result}
        resultEntries={
          data.resultEntries ?? []
        }
        courseCode={courseCode}
        raceNo={raceNo}
        raceDate={raceDate}
      />

      <nav className={styles.moveNav}>
        {raceNo > 1 ? (
          <Link
            href={`/races/${paddedCourseCode}/${
              raceNo - 1
            }?date=${raceDate}`}
          >
            ← {raceNo - 1}R
          </Link>
        ) : (
          <span />
        )}

        {raceNo < 12 ? (
          <Link
            href={`/races/${paddedCourseCode}/${
              raceNo + 1
            }?date=${raceDate}`}
          >
            {raceNo + 1}R →
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </>
  )}
</section>
    </main>
  );
}
