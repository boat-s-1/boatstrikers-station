import Link from "next/link";
import {
  formatJstDateTime,
  getAvailableDates,
  getCoursesByDate,
  normalizeDate,
} from "../lib/boatstrikersPlatform";
import styles from "./phase2.module.css";

/* =========================================================
   ナイター場
========================================================= */

const NIGHT_COURSE_CODES = new Set([
  1,  // 桐生
  7,  // 蒲郡
  12, // 住之江
  15, // 丸亀
  19, // 下関
  20, // 若松
  24, // 大村
]);

function getCourseRaceType(courseCode) {
  return NIGHT_COURSE_CODES.has(Number(courseCode))
    ? "night"
    : "day";
}

/* =========================================================
   各場専用背景
========================================================= */

const COURSE_BACKGROUNDS = {
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

export const dynamic = "force-dynamic";

/* =========================================================
   日付関連
========================================================= */

function getJstDateString() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function formatUpdateTime(value) {
  if (!value) {
    return "未取得";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return formatJstDateTime(value);
  }

  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

/* =========================================================
   レース状況判定

   🟢 開催前
   🟡 展示中
   🔴 只今レース中
   🔵 結果確定
========================================================= */

function getCourseLiveStatus(course, raceDate) {
  const today = getJstDateString();

  const raceCount = Number(
    course.raceCount ?? 0
  );

  const exhibitionCount = Number(
    course.exhibitionCount ?? 0
  );

  const startedExhibitionCount = Number(
    course.startedExhibitionCount ?? 0
  );

  const resultCount = Number(
    course.resultCount ?? 0
  );

  /*
   * 過去日
   */
  if (raceDate < today) {
    return {
      key: "finished",
      label: "結果確定",
      subLabel:
        resultCount > 0
          ? `${resultCount}/${raceCount}R結果公開`
          : "結果を公開中",
      buttonLabel: "本日の結果を見る",
    };
  }

  /*
   * 未来日
   */
  if (raceDate > today) {
    return {
      key: "scheduled",
      label: "開催前",
      subLabel: "出走表公開中",
      buttonLabel: "出走表を見る",
    };
  }

  /*
   * 当日・全レース結果取得済み
   */
  if (
    raceCount > 0 &&
    resultCount >= raceCount
  ) {
    return {
      key: "finished",
      label: "結果確定",
      subLabel: `${resultCount}/${raceCount}R結果公開`,
      buttonLabel: "本日の結果を見る",
    };
  }

  /*
   * 当日・1レース以上結果あり
   */
  if (resultCount > 0) {
    return {
      key: "live",
      label: "只今レース中",
      subLabel: `${resultCount}/${raceCount}R終了`,
      buttonLabel: "今日のレースを見る",
    };
  }

  /*
   * 当日・展示開始済み
   */
  if (startedExhibitionCount > 0) {
    return {
      key: "exhibition",
      label: "展示中",
      subLabel:
        exhibitionCount > 0
          ? `${exhibitionCount}R展示完了`
          : "展示情報を取得中",
      buttonLabel: "展示情報を見る",
    };
  }

  /*
   * 当日・展示前
   */
  return {
    key: "scheduled",
    label: "開催前",
    subLabel: "出走表公開中",
    buttonLabel: "今日のレースを見る",
  };
}

/* =========================================================
   AI公開状況
========================================================= */

function getCourseAiStatus(course) {
  const aiCount = Number(
    course.aiPredictionCount ??
      course.livePredictionCount ??
      course.previousPredictionCount ??
      0
  );

  const isPublished =
    course.hasAiPrediction === true ||
    course.aiPublished === true ||
    aiCount > 0;

  if (isPublished) {
    return {
      key: "published",
      label: "AI公開中",
      subLabel:
        aiCount > 0
          ? `${aiCount}R分析済み`
          : "予想を公開中",
    };
  }

  return {
    key: "preparing",
    label: "AI準備中",
    subLabel: "順次公開予定",
  };
}

/* =========================================================
   ページ
========================================================= */

export default async function RacesPage({
  searchParams,
}) {
  const query = await searchParams;
  const raceDate = normalizeDate(query?.date);

  let courses = [];
  let dates = [];
  let loadError = null;

  try {
    [courses, dates] = await Promise.all([
      getCoursesByDate(raceDate),
      getAvailableDates(),
    ]);
  } catch (error) {
    console.error(
      "開催場一覧ページ取得エラー:",
      error
    );

    loadError =
      error instanceof Error
        ? error.message
        : "データの取得中にエラーが発生しました。";
  }

  /*
   * 展示中またはレース中の場
   */
  const activeCourses = courses.filter(
    (course) => {
      const status = getCourseLiveStatus(
        course,
        raceDate
      );

      return (
        status.key === "live" ||
        status.key === "exhibition"
      );
    }
  );

  return (
    <main className={styles.page}>
      {/* =====================================================
          トップバナー
      ===================================================== */}

      <header className={styles.racesHero}>
        <div
          className={styles.racesHeroBackground}
        />

        <div
          className={styles.racesHeroOverlay}
        />

        <div
          className={styles.racesHeroScanLine}
        />

        <div
          className={styles.racesHeroGlow}
        />

        <div className={styles.racesHeroInner}>
          <Link
            href="/"
            className={styles.racesBackPill}
          >
            <span>←</span>
            <span>ホーム</span>
          </Link>

          <div className={styles.racesHeroMain}>
            <div className={styles.racesHeroText}>
              <p
                className={
                  styles.racesHeroEyebrow
                }
              >
                BOATSTRIKERS LIVE DATABASE
              </p>

              <h1>本日の開催場</h1>

              <div
                className={
                  styles.racesHeroMeta
                }
              >
                <span>
                  <small>RACE DATE</small>
                  <strong>{raceDate}</strong>
                </span>

                <span>
                  <small>
                    TODAY&apos;S COURSES
                  </small>

                  <strong>
                    {courses.length}場開催
                  </strong>
                </span>

                <span
                  className={
                    styles.racesHeroLive
                  }
                >
                  <i />
                  <strong>自動更新中</strong>
                </span>
              </div>
            </div>

            <div
              className={
                styles.racesHeroStatus
              }
            >
              <div
                className={
                  styles.racesHeroStatusHeader
                }
              >
                <span>AI RACE CENTER</span>
                <b>ONLINE</b>
              </div>

              <div
                className={
                  styles.racesHeroStatusBody
                }
              >
                <div>
                  <small>開催場</small>
                  <strong>
                    {courses.length}
                  </strong>
                </div>

                <div>
                  <small>更新間隔</small>
                  <strong>5分</strong>
                </div>

                <div>
                  <small>システム</small>
                  <strong>稼働中</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* =====================================================
          開催場一覧
      ===================================================== */}

      <section className={styles.content}>
        {/* 日付ナビ */}

        {dates.length > 0 && (
          <nav className={styles.dateNav}>
            {dates.map((date) => (
              <Link
                key={date}
                href={`/races?date=${date}`}
                className={`${styles.dateLink} ${
                  date === raceDate
                    ? styles.dateLinkActive
                    : ""
                }`}
              >
                {date}
              </Link>
            ))}
          </nav>
        )}

        {/* 展示中・レース中 */}

        {activeCourses.length > 0 && (
          <section
            className={
              styles.liveCourseSection
            }
          >
            <div
              className={
                styles.liveCourseHeading
              }
            >
              <div>
                <span
                  className={
                    styles.liveCourseDot
                  }
                />

                <strong>
                  展示・レース進行中
                </strong>
              </div>

              <small>
                {activeCourses.length}場
              </small>
            </div>

            <div
              className={
                styles.liveCourseList
              }
            >
              {activeCourses.map((course) => {
                const numericCourseCode =
                  Number(course.courseCode);

                const courseCode = String(
                  numericCourseCode
                ).padStart(2, "0");

                const status =
                  getCourseLiveStatus(
                    course,
                    raceDate
                  );

                return (
                  <Link
                    key={course.courseCode}
                    href={`/races/${courseCode}?date=${raceDate}`}
                    className={
                      styles.liveCourseChip
                    }
                  >
                    <span>{courseCode}</span>

                    <strong>
                      {course.courseName}
                    </strong>

                    <b>
                      {status.key === "live"
                        ? "LIVE"
                        : "展示中"}
                    </b>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* 見出し */}

        <div className={styles.sectionHeading}>
          <div>
            <p>TODAY&apos;S COURSES</p>
            <h2>開催場を選択</h2>
          </div>

          <span>{courses.length}場</span>
        </div>

        {/* エラー・0件・一覧 */}

        {loadError ? (
          <div className={styles.messageCard}>
            <strong>
              ⚠️ データを取得できませんでした
            </strong>

            <p>{loadError}</p>
          </div>
        ) : courses.length === 0 ? (
          <div className={styles.messageCard}>
            <strong>
              🚤 この日の開催データはありません
            </strong>

            <p>
              PC-KYOTEIから同期済みの日付を
              選択してください。
            </p>
          </div>
        ) : (
          <div className={styles.courseGrid}>
            {courses.map((course) => {
              const numericCourseCode =
                Number(course.courseCode);

              const courseCode = String(
                numericCourseCode
              ).padStart(2, "0");

              const raceType =
                getCourseRaceType(
                  numericCourseCode
                );

              const isNight =
                raceType === "night";

              const background =
                COURSE_BACKGROUNDS[
                  numericCourseCode
                ] ??
                "/backgrounds/default.jpg";

              const liveStatus =
                getCourseLiveStatus(
                  course,
                  raceDate
                );

              const aiStatus =
                getCourseAiStatus(course);

              const updateTime =
                formatUpdateTime(
                  course.syncedAt
                );

              return (
                <article
                  key={course.courseCode}
                  className={`${styles.courseCard} ${
                    isNight
                      ? styles.courseCardNight
                      : styles.courseCardDay
                  }`}
                  style={{
                    backgroundImage: `
                      linear-gradient(
                        180deg,
                        rgba(3, 14, 38, 0.18) 0%,
                        rgba(3, 16, 43, 0.48) 46%,
                        rgba(2, 14, 38, 0.86) 100%
                      ),
                      url("${background}")
                    `,
                  }}
                >
                  <div
                    className={
                      styles.courseCardContent
                    }
                  >
                    {/* 上段：バッジ */}

                    <div
                      className={
                        styles.courseCardTop
                      }
                    >
                      {/*
                        場名・場コードは背景画像内へ
                        入れているため、コードでは
                        表示しません。
                      */}

                      <div
                        className={
                          styles.courseTitle
                        }
                        aria-hidden="true"
                      />

                      <div
                        className={
                          styles.courseBadges
                        }
                      >
                        <b>出走表公開</b>

                        <span
                          className={
                            isNight
                              ? styles.nightBadge
                              : styles.dayBadge
                          }
                        >
                          {isNight
                            ? "🌙 ナイター"
                            : "☀️ デイ"}
                        </span>
                      </div>
                    </div>

                    {/* 中段：ステータス */}

                    <div
                      className={
                        styles.courseLiveStats
                      }
                    >
                      {/* レース状況 */}

                      <div
                        className={`${styles.courseLiveStat} ${
                          styles[
                            `courseLiveStat_${liveStatus.key}`
                          ] ?? ""
                        }`}
                      >
                        <div>
                          <span>
                            レース状況
                          </span>

                          <strong
                            className={
                              styles.courseStatusLabel
                            }
                          >
                            <i
                              className={
                                styles[
                                  `courseStatusDot_${liveStatus.key}`
                                ]
                              }
                            />

                            {liveStatus.label}
                          </strong>

                          <small>
                            {liveStatus.subLabel}
                          </small>
                        </div>
                      </div>

                      {/* 最新更新 */}

                      <div
                        className={
                          styles.courseLiveStat
                        }
                      >
                        <div>
                          <span>最新更新</span>

                          <strong>
                            {updateTime}
                          </strong>

                          <small>
                            5分ごとに更新
                          </small>
                        </div>
                      </div>

                      {/* AI予想 */}

                      <div
                        className={`${styles.courseLiveStat} ${
                          aiStatus.key ===
                          "published"
                            ? styles.courseLiveStat_aiPublished
                            : styles.courseLiveStat_aiPreparing
                        }`}
                      >
                        <div>
                          <span>AI予想</span>

                          <strong>
                            {aiStatus.label}
                          </strong>

                          <small>
                            {aiStatus.subLabel}
                          </small>
                        </div>
                      </div>
                    </div>

                    {/* ボタン */}

                    <Link
                      href={`/races/${courseCode}?date=${raceDate}`}
                      className={`${styles.primaryButton} ${
                        isNight
                          ? styles.primaryButtonNight
                          : styles.primaryButtonDay
                      }`}
                    >
                      <span>
                        {liveStatus.buttonLabel}
                      </span>

                      <span>→</span>
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
