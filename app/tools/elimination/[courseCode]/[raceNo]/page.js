import Link from "next/link";
import { cookies } from "next/headers";
import { formatJstDateTime, getCourseName, getRaceDetail, normalizeCourseCode, normalizeDate, normalizeRaceNo } from "../../../../lib/boatstrikersPlatform";
import { getMemberEntitlementFromToken, MEMBER_ACCESS_COOKIE } from "../../../../../lib/memberEntitlement";
import { getOfficialTrifectaOdds } from "../../../../../lib/boatraceOdds";
import EliminationLabClient from "./EliminationLabClient";

export const dynamic = "force-dynamic";

async function getPremiumAccess() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(MEMBER_ACCESS_COOKIE)?.value || "";
    const entitlement = await getMemberEntitlementFromToken(token);
    return Boolean(entitlement.premium);
  } catch (error) {
    console.error("elimination lab member entitlement error", error);
    return false;
  }
}

function hasExhibition(entries) {
  if (!Array.isArray(entries) || entries.length < 4) return false;
  return entries.filter((entry) => {
    const value = Number(entry?.exhibition_time ?? entry?.official_exhibition_time ?? entry?.tenji_time ?? entry?.display_time);
    return Number.isFinite(value) && value > 0;
  }).length >= 4;
}

export default async function EliminationLabPage({ params, searchParams }) {
  const route = await params;
  const query = await searchParams;
  const courseCode = normalizeCourseCode(route.courseCode);
  const raceNo = normalizeRaceNo(route.raceNo);
  const raceDate = normalizeDate(query?.date);
  const premiumAccess = await getPremiumAccess();

  if (!courseCode || !raceNo) {
    return <main style={{ maxWidth: 760, margin: "0 auto", padding: 20 }}>URLが正しくありません。</main>;
  }

  let data = null;
  let loadError = null;
  let oddsData = null;
  let oddsError = null;

  try {
    [data, oddsData] = await Promise.all([
      getRaceDetail(raceDate, courseCode, raceNo),
      getOfficialTrifectaOdds({ raceDate, courseCode, raceNo }).catch((error) => {
        oddsError = error instanceof Error ? error.message : "3連単オッズを取得できませんでした。";
        return null;
      }),
    ]);
  } catch (error) {
    console.error(error);
    loadError = error instanceof Error ? error.message : "レースデータの読み込みに失敗しました。";
  }

  const entries = Array.isArray(data?.entries) ? data.entries : [];
  const courseName = getCourseName(courseCode);

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "18px 14px 40px", background: "#f5f7fa", minHeight: "100vh" }}>
      <div style={{ marginBottom: 14 }}>
        <Link href={`/races/${String(courseCode).padStart(2, "0")}/${raceNo}?date=${raceDate}`} style={{ color: "#4d6177", fontSize: 13, fontWeight: 800, textDecoration: "none" }}>← レース詳細へ戻る</Link>
      </div>

      <header style={{ padding: "20px 18px", borderRadius: 22, background: "linear-gradient(135deg,#17253a,#274b72)", color: "#fff", marginBottom: 18 }}>
        <div style={{ fontSize: 11, fontWeight: 1000, letterSpacing: ".12em", opacity: .75 }}>{premiumAccess ? "BOATSTRIKERS PREMIUM TOOL" : "BOATSTRIKERS FREE TRIAL"}</div>
        <h1 style={{ margin: "6px 0 8px", fontSize: 27 }}>消去ラボ β</h1>
        <p style={{ margin: 0, fontWeight: 800 }}>{courseName} {raceNo}R・{raceDate}</p>
        <p style={{ margin: "8px 0 0", fontSize: 12, lineHeight: 1.7, opacity: .82 }}>120通りのオッズ表から「買わない目」を条件ごとに消していくツールです。</p>
      </header>

      {loadError ? (
        <div style={{ padding: 18, borderRadius: 16, background: "#fff1f1", color: "#a23434", fontWeight: 800 }}>{loadError}</div>
      ) : entries.length === 0 ? (
        <div style={{ padding: 18, borderRadius: 16, background: "#fff", color: "#66788a", fontWeight: 800 }}>このレースの出走データがありません。</div>
      ) : (
        <EliminationLabClient
          entries={entries}
          premiumAccess={premiumAccess}
          syncedAt={data?.event?.synced_at ? formatJstDateTime(data.event.synced_at) : null}
          exhibitionReady={hasExhibition(entries)}
          odds={oddsData?.odds || {}}
          oddsCount={oddsData?.count || 0}
          oddsFetchedAt={oddsData?.fetchedAt ? formatJstDateTime(oddsData.fetchedAt) : null}
          oddsSource={oddsData?.source || null}
          oddsError={oddsError}
        />
      )}
    </main>
  );
}
