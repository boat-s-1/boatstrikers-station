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
   1: "/backgrounds/6B178DB8-C92E-46CC-82A5-5451D7AC5AA0.png",
  2: "/backgrounds/FC5BE741-F73B-4256-9F44-6956FBD20E6F.png",
  3: "/backgrounds/BD55BDF9-EE60-49A1-BFDA-5B95FF2BC85F.png",
  4: "/backgrounds/62DFF1EC-DE56-4368-AD4F-68AD6494C97D.png",
  5: "/backgrounds/C6329CF8-BADE-44E0-838F-BE5B8605DCFC.png",
  6: "/backgrounds/C93356BF-1F30-495D-9CCB-9DA45FD6E73A.png",
  7: "/backgrounds/E4607E75-9DB1-4FA5-A5E7-3E6A03B7C9FE.png",
  8: "/backgrounds/F80FCF3E-7D13-410C-8574-84417C142816.png",
  9: "/backgrounds/9F98462B-9AF6-4354-8F4C-4EE8DFEDACAE.png",
  10: "/backgrounds/E988F9B9-C704-4918-AC70-810A6D7F7073.png",
  11: "/backgrounds/5B9AE3A1-48BD-4C9C-803C-04BEB7012EC7.png",
  12: "/backgrounds/758979BE-A279-47EB-B2C1-D43E16E976A5.png",
  13: "/backgrounds/3E4DBBD8-8744-44C2-A78E-2701DDC4296E.png",
  14: "/backgrounds/C60FE24E-A424-4BDA-878A-112A2D41898C.png",
  15: "/backgrounds/0355DF1E-8167-4230-A3F6-BE5E2EC6E068.png",
  16: "/backgrounds/01725F6C-7DC9-4343-8D00-9DA2F3604D27.png",
  17: "/backgrounds/758979BE-A279-47EB-B2C1-D43E16E976A5.png",
  18: "/backgrounds/17914489-7354-4382-AD50-D12D6440E32F.png",
  19: "/backgrounds/F72FBD4C-991A-4127-92DB-007206E0D31F.png",
  20: "/backgrounds/BD69613E-C153-49E8-AE37-BF338F87FA51.png",
  21: "/backgrounds/41ED7181-4C61-4F30-BDE3-E95F79F088A8.png",
  22: "/backgrounds/B8091B1D-0189-4915-9594-4428C5B93339.png",
  23: "/backgrounds/6E5D6CA0-3A66-47EB-99BD-9936F92D422E.png",
  24: "/backgrounds/B5B45305-8C2B-4F52-A7A0-41B0917E8156.png",
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
          </div></div>

       
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

               <div className={styles.miniEntry} key={entry.boat_no}>
  <span
    className={`${styles.boatBadge} ${
      styles[`boat${entry.boat_no}`]
    }`}
  >
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
      モ
      {entry.motor_2_rate != null
        ? `${(entry.motor_2_rate * 100).toFixed(1)}%`
        : "-"}
    </span>

    <span className={styles.miniEntryNation}>
      全
      {formatNumber(entry.national_win_rate)}
    </span>
  </div>
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
