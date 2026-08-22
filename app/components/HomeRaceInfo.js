import Link from "next/link";
import { supabase } from "../bsc2/lib/supabaseClient";
import styles from "./HomeRaceInfo.module.css";

const NIGHT_COURSE_CODES = new Set([1, 7, 12, 15, 19, 20, 24]);
const MORNING_COURSE_CODES = new Set([10, 14, 18, 21, 23]);

function courseType(courseCode) {
  const code = Number(courseCode);
  if (NIGHT_COURSE_CODES.has(code)) {
    return { label: "ナイター", icon: "🌙", key: "night" };
  }
  if (MORNING_COURSE_CODES.has(code)) {
    return { label: "モーニング", icon: "☀️", key: "morning" };
  }
  return { label: "デイ", icon: "☀️", key: "day" };
}

function statusInfo(course) {
  const raceCount = Number(course.raceCount || 0);
  const resultCount = Number(course.resultCount || 0);
  const nextRaceNo = Number(course.nextRaceNo || 0);

  if (
    course.liveStatus === "finished" ||
    (raceCount > 0 && resultCount >= raceCount)
  ) {
    return { label: "開催終了", key: "finished" };
  }

  if (course.liveStatus === "exhibition") {
    return {
      label: nextRaceNo ? `${nextRaceNo}R 展示中` : "展示中",
      key: "live",
    };
  }

  if (course.liveStatus === "live") {
    return {
      label: nextRaceNo ? `${nextRaceNo}R 受付中` : "開催中",
      key: "live",
    };
  }

  return {
    label: nextRaceNo ? `${nextRaceNo}Rから` : "出走表公開",
    key: "scheduled",
  };
}

function formatHitDate(value) {
  if (!value) return "";
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return String(value);
  return `${Number(match[2])}/${Number(match[3])}`;
}

async function getLatestHits(limit = 5) {
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from("bsc_results")
      .select("race_date, category, invest, payout, hit")
      .in("category", ["一果", "初音", "キイナ"])
      .order("race_date", { ascending: false })
      .limit(60);

    if (error) {
      console.error("最新の的中レース取得エラー:", error.message);
      return [];
    }

    return (Array.isArray(data) ? data : [])
      .filter((row) => Boolean(row.hit) || Number(row.payout || 0) > 0)
      .slice(0, limit);
  } catch (error) {
    console.error("最新の的中レース取得例外:", error);
    return [];
  }
}

function HitCard({ item, index }) {
  const invest = Number(item.invest || 0);
  const payout = Number(item.payout || 0);
  const recovery = invest > 0 ? (payout / invest) * 100 : 0;

  return (
    <article className={styles.hitCard}>
      <div className={styles.hitTop}>
        <span className={styles.hitCharacter}>{item.category}AI</span>
        <span className={styles.hitNo}>{formatHitDate(item.race_date)}</span>
      </div>
      <span className={styles.hitLabel}>払戻</span>
      <strong className={styles.hitPayout}>{payout.toLocaleString()}円</strong>
      <div className={styles.hitMeta}>
        <span>投資 {invest.toLocaleString()}円</span>
        {invest > 0 ? <span>回収率 {recovery.toFixed(1)}%</span> : null}
      </div>
      <span className={styles.hitSequence}>直近的中 #{index + 1}</span>
    </article>
  );
}

export default async function HomeRaceInfo({ courses = [], raceDate = "" }) {
  const hitItems = await getLatestHits(5);
  const hasCourses = Array.isArray(courses) && courses.length > 0;

  return (
    <section className={styles.section} aria-labelledby="home-race-info-title">
      <div className={styles.bannerWrap}>
        <img
          src="/home/today-race-info-banner.jpg"
          alt="本日のレース情報"
          className={styles.banner}
        />
      </div>

      <div className={styles.block}>
        <div className={styles.subHeader}>
          <div className={styles.subTitleWrap}>
            <span className={styles.subIcon} aria-hidden="true">🚤</span>
            <h3>開催場</h3>
          </div>

          <Link href={`/races?date=${raceDate}`} className={styles.subLink}>
            一覧を見る <span aria-hidden="true">›</span>
          </Link>
        </div>

        {hasCourses ? (
          <div className={styles.courseRail}>
            {courses.map((course) => {
              const code = String(course.courseCode).padStart(2, "0");
              const type = courseType(course.courseCode);
              const status = statusInfo(course);
              const href = `/races/${code}?date=${raceDate}`;

              return (
                <Link
                  href={href}
                  className={`${styles.courseCard} ${styles[type.key]} ${
                    status.key === "finished" ? styles.finished : ""
                  }`}
                  key={course.courseCode}
                >
                  <div className={styles.courseCardTop}>
                    <span className={styles.courseNo}>#{code}</span>
                    <span className={styles.courseType}>
                      {type.icon} {type.label}
                    </span>
                  </div>

                  <strong className={styles.courseName}>
                    {course.courseName}
                  </strong>

                  <span
                    className={`${styles.courseStatus} ${styles[`status_${status.key}`]}`}
                  >
                    {status.label}
                  </span>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className={styles.courseEmpty}>
            本日の開催場情報を取得中です。
          </div>
        )}
      </div>

      <div className={styles.divider} />

      <div className={`${styles.block} ${styles.hitsBlock}`}>
        <div className={styles.subHeader}>
          <div className={styles.subTitleWrap}>
            <span className={styles.subIcon} aria-hidden="true">🎯</span>
            <h3>的中レース</h3>
          </div>
          <span className={styles.swipeHint}>最新5件・横にスワイプ →</span>
        </div>

        {hitItems.length > 0 ? (
          <div className={styles.hitsRail}>
            {hitItems.map((item, index) => (
              <HitCard
                item={item}
                index={index}
                key={`${item.race_date}-${item.category}-${index}`}
              />
            ))}
          </div>
        ) : (
          <div className={styles.hitEmpty}>
            <span aria-hidden="true">📊</span>
            <div>
              <strong>的中実績を集計中です。</strong>
              <p>的中結果が登録されると、最新順にここへ表示されます。</p>
            </div>
          </div>
        )}

        <div className={styles.resultsLinkRow}>
          <Link href="/results" className={styles.resultsLink}>
            過去の成績をすべて見る →
          </Link>
        </div>
      </div>
    </section>
  );
}
