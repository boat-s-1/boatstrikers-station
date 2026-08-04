import Link from "next/link";
import styles from "./HomeRaceStrip.module.css";

const NIGHT_COURSE_CODES = new Set([1, 7, 12, 15, 19, 20, 24]);
const MORNING_COURSE_CODES = new Set([10, 14, 18, 21, 23]);

function courseType(courseCode) {
  const code = Number(courseCode);
  if (NIGHT_COURSE_CODES.has(code)) return { label: "ナイター", icon: "🌙", key: "night" };
  if (MORNING_COURSE_CODES.has(code)) return { label: "モーニング", icon: "☀️", key: "morning" };
  return { label: "デイ", icon: "☀️", key: "day" };
}

function statusInfo(course) {
  const raceCount = Number(course.raceCount || 0);
  const resultCount = Number(course.resultCount || 0);
  const nextRaceNo = Number(course.nextRaceNo || 0);

  if (course.liveStatus === "finished" || (raceCount > 0 && resultCount >= raceCount)) {
    return { label: "開催終了", key: "finished" };
  }
  if (course.liveStatus === "exhibition") {
    return { label: nextRaceNo ? `${nextRaceNo}R 展示中` : "展示中", key: "live" };
  }
  if (course.liveStatus === "live") {
    return { label: nextRaceNo ? `${nextRaceNo}R 受付中` : "開催中", key: "live" };
  }
  return { label: nextRaceNo ? `${nextRaceNo}Rから` : "出走表公開", key: "scheduled" };
}

export default function HomeRaceStrip({ courses = [], raceDate = "" }) {
  if (!Array.isArray(courses) || courses.length === 0) return null;

  return (
    <section className={styles.section} aria-labelledby="home-race-title">
      <div className={styles.header}>
        <div>
          <p>TODAY&apos;S RACES</p>
          <h2 id="home-race-title">本日の開催場</h2>
        </div>
        <Link href={`/races?date=${raceDate}`} className={styles.allLink}>
          全場を見る <span aria-hidden="true">›</span>
        </Link>
      </div>

      <div className={styles.rail}>
        {courses.map((course) => {
          const code = String(course.courseCode).padStart(2, "0");
          const type = courseType(course.courseCode);
          const status = statusInfo(course);
          const href = `/races/${code}?date=${raceDate}`;

          return (
            <Link
              href={href}
              className={`${styles.card} ${styles[type.key]} ${status.key === "finished" ? styles.finished : ""}`}
              key={course.courseCode}
            >
              <div className={styles.cardTop}>
                <span className={styles.courseNo}>#{code}</span>
                <span className={styles.type}>{type.icon} {type.label}</span>
              </div>
              <strong>{course.courseName}</strong>
              <span className={`${styles.status} ${styles[`status_${status.key}`]}`}>{status.label}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
