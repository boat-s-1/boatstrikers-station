import Link from "next/link";
import { isExhibitionReady } from "../../../../lib/exhibitionDisplay";
import ExhibitionAutoRefresh from "../../components/ExhibitionAutoRefresh";
import { cookies } from "next/headers";
import {
  formatJstDateTime,
  getCourseName,
  getRaceDetail,
  normalizeCourseCode,
  normalizeDate,
  normalizeRaceNo,
} from "../../../lib/boatstrikersPlatform";
import { getMemberEntitlementFromToken, MEMBER_ACCESS_COOKIE } from "../../../../lib/memberEntitlement";
import RaceDetailTabs from "../../components/RaceDetailTabs";
import RacePremiumMemberGate from "../../components/RacePremiumMemberGate";
import StadiumHeroBanner from "../../components/StadiumHeroBanner";
import styles from "../../phase2.module.css";

export const dynamic = "force-dynamic";

async function getPremiumAccess(){
  try{
    const cookieStore=await cookies();
    const token=cookieStore.get(MEMBER_ACCESS_COOKIE)?.value||"";
    const entitlement=await getMemberEntitlementFromToken(token);
    return Boolean(entitlement.premium);
  }catch(error){
    console.error("race member entitlement error",error);
    return false;
  }
}

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
  const premiumAccess = await getPremiumAccess();

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

  const displayEntries = Array.isArray(data?.entries)
    ? data.entries
    : [];
  const exhibitionReady = isExhibitionReady(displayEntries);

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

      <section className={styles.content}>
        {loadError ? (
          <div className={styles.messageCard}>
            {loadError}
          </div>
        ) : !data?.event ||
          displayEntries.length === 0 ? (
          <div className={styles.messageCard}>
            このレースの出走表はありません。
          </div>
        ) : (
          <>
            <ExhibitionAutoRefresh raceDate={raceDate} closingTime={data.event.closing_time} />
            <RaceDetailTabs
              event={data.event}
              entries={displayEntries}
              venueBaselines={data.venueBaselines}
              previousPrediction={
                data.previousPrediction
              }
              noteFeature={data.noteFeature}
              livePrediction={
                premiumAccess && exhibitionReady
                  ? data.livePrediction
                  : null
              }
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

            <RacePremiumMemberGate premiumAccess={premiumAccess} />

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
