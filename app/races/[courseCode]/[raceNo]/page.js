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
import RaceFeatureQuotaGate from "../../components/RaceFeatureQuotaGate";
import RacePremiumMemberGate from "../../components/RacePremiumMemberGate";
import RaceQuickView from "../../components/RaceQuickView";
import StadiumHeroBanner from "../../components/StadiumHeroBanner";
import styles from "../../phase2.module.css";
import { getPublishedNewspapers } from "../../../../lib/newspapers";

export const dynamic = "force-dynamic";

const RACE_STATUS_LABELS = {
  open: "発売中",
  on_sale: "発売中",
  onsale: "発売中",
  closed: "締切",
  cutoff: "締切",
};

function getRaceStatusLabel(event) {
  const rawStatus = event?.race_status ?? event?.status ?? null;
  if (!rawStatus) return null;
  return RACE_STATUS_LABELS[String(rawStatus).trim().toLowerCase()] ?? null;
}

async function getRaceMemberAccess(){
  try{
    const cookieStore=await cookies();
    const token=cookieStore.get(MEMBER_ACCESS_COOKIE)?.value||"";
    const entitlement=await getMemberEntitlementFromToken(token);
    return {
      premiumAccess:Boolean(entitlement.premium),
      authenticated:Boolean(entitlement.authenticated),
      entitlementResolved:true,
    };
  }catch(error){
    console.error("race member entitlement error",error);
    return {
      premiumAccess:false,
      authenticated:null,
      entitlementResolved:false,
    };
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
  const memberAccess = await getRaceMemberAccess();
  const premiumAccess = memberAccess.premiumAccess;
  const showFreeMemberCta = memberAccess.entitlementResolved && memberAccess.authenticated === false;

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
  const resultEntries = Array.isArray(data?.resultEntries) ? data.resultEntries : [];
  const resultConfirmed = Boolean(data?.event?.result_available || data?.result || resultEntries.length > 0);
  const visibleLivePrediction = premiumAccess && exhibitionReady
    ? data?.livePrediction
    : null;

  const courseName = getCourseName(courseCode);
  const paddedCourseCode = String(courseCode).padStart(
    2,
    "0"
  );
  const racePapers = (await getPublishedNewspapers({
    date: raceDate,
    course: courseName,
    raceNo,
    limit: 10,
  })).sort((a, b) => {
    const editionRank = (paper) => paper.edition === "just_before" ? 0 : 1;
    const byEdition = editionRank(a) - editionRank(b);
    if (byEdition !== 0) return byEdition;
    return String(b.published_at || "").localeCompare(String(a.published_at || ""));
  });
  const directEditionPairs = new Set(
    racePapers
      .filter((paper) => paper.edition === "just_before")
      .map((paper) => paper.character_key)
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
            {racePapers.length ? (
              <section style={{
                margin:"0 0 14px", padding:"14px",
                border:"1px solid #ead8ec", borderRadius:16,
                background:"#fff"
              }}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,marginBottom:10}}>
                  <div>
                    <small style={{display:"block",color:"#9b4bb0",fontWeight:900,letterSpacing:".08em"}}>PUBLISHED NEWSPAPER</small>
                    <strong style={{fontSize:16}}>このレースの公開新聞</strong>
                  </div>
                  <span style={{fontSize:12,fontWeight:900,color:"#765082"}}>{racePapers.length}件</span>
                </div>
                <div style={{display:"grid",gap:8}}>
                  {racePapers.map((paper)=>(
                    <Link key={paper.id} href={`/newspapers/${paper.slug}`} style={{
                      display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,
                      padding:"11px 12px",borderRadius:12,background:"#fff8ff",
                      border:"1px solid #ecd8ef",textDecoration:"none",color:"#4d3058"
                    }}>
                      <span style={{fontWeight:900}}>
                        📰 {paper.character_key === "ichika" ? "一果" : paper.character_key === "hatsune" ? "初音" : "キイナ"}新聞
                        ・{paper.edition === "just_before" ? "直前版" : "前日版"}
                        {paper.edition === "previous_day" && directEditionPairs.has(paper.character_key) ? "・直前版あり" : ""}
                      </span>
                      <b style={{color:"#8d3fa3"}}>{paper.edition === "just_before" ? "最新を見る" : "読む"} ›</b>
                    </Link>
                  ))}
                </div>
              </section>
            ) : null}
            <RaceQuickView
              courseName={courseName}
              raceNo={raceNo}
              closingTime={data.event.closing_time || null}
              raceStatus={resultConfirmed ? null : getRaceStatusLabel(data.event)}
              exhibitionReady={exhibitionReady}
              hasPreviousAi={Boolean(data.previousPrediction)}
              hasLiveAi={Boolean(visibleLivePrediction)}
              resultConfirmed={resultConfirmed}
            />
            <RaceFeatureQuotaGate premiumAccess={premiumAccess} />
            <RaceDetailTabs
              event={data.event}
              entries={displayEntries}
              venueBaselines={data.venueBaselines}
              previousPrediction={
                data.previousPrediction
              }
              noteFeature={data.noteFeature}
              livePrediction={visibleLivePrediction}
              syncedAt={
                data?.event?.synced_at
                  ? formatJstDateTime(
                      data.event.synced_at
                    )
                  : null
              }
              result={data.result}
              resultEntries={resultEntries}
              courseCode={courseCode}
              raceNo={raceNo}
              raceDate={raceDate}
            />

            {showFreeMemberCta ? (
              <aside
                aria-label="無料会員のご案内"
                style={{
                  margin: "16px 12px 18px",
                  padding: "16px",
                  border: "1px solid #d7e7f3",
                  borderRadius: "16px",
                  background: "#f8fcff",
                  boxShadow: "0 6px 18px rgba(21,89,149,.07)",
                }}
              >
                <strong style={{ display: "block", color: "#155995", fontSize: "16px", lineHeight: 1.4 }}>
                  BoatStrikersをもっと活用する
                </strong>
                <p style={{ margin: "7px 0 13px", color: "#536b7d", fontSize: "13px", lineHeight: 1.7 }}>
                  無料会員になると、TODAYを中心にBoatStrikersを毎日のレースチェックに使えます。
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px 14px" }}>
                  <Link
                    href="/members"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      minHeight: "42px",
                      padding: "0 18px",
                      borderRadius: "12px",
                      background: "#1679d6",
                      color: "#fff",
                      textDecoration: "none",
                      fontSize: "13px",
                      fontWeight: 900,
                    }}
                  >
                    無料会員になる
                  </Link>
                  <Link href="/today" style={{ color: "#155995", fontSize: "13px", fontWeight: 800, textDecoration: "none" }}>
                    BoatStrikers TODAYを見る →
                  </Link>
                </div>
              </aside>
            ) : null}

            <div style={{ margin: "18px 0" }}>
              <Link
                href={`/tools/elimination/${paddedCourseCode}/${raceNo}?date=${raceDate}`}
                style={{
                  display: "block",
                  padding: "16px 18px",
                  borderRadius: "16px",
                  background: "linear-gradient(135deg,#17253a,#274b72)",
                  color: "#fff",
                  textDecoration: "none",
                  fontWeight: 1000,
                  textAlign: "center",
                  boxShadow: "0 10px 24px rgba(23,37,58,.18)",
                }}
              >
                🧹 BoatStrikers 消去ラボ β を開く
              </Link>
            </div>

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
