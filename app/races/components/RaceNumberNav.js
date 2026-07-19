import Link from "next/link";
import styles from "./RaceNumberNav.module.css";

const RACE_NUMBERS = Array.from({ length: 12 }, (_, index) => index + 1);

export default function RaceNumberNav({
  courseCode,
  currentRaceNo,
  raceDate,
}) {
  const normalizedCourseCode = String(courseCode).padStart(2, "0");
  const normalizedCurrentRaceNo = Number(currentRaceNo);

  return (
    <nav
      className={styles.wrapper}
      aria-label="レース番号切り替え"
    >
      <div className={styles.scroller}>
        {RACE_NUMBERS.map((raceNo) => {
          const isActive = raceNo === normalizedCurrentRaceNo;

          const href = {
            pathname: `/races/${normalizedCourseCode}/${raceNo}`,
            query: raceDate
              ? {
                  date: raceDate,
                }
              : {},
          };

          return (
            <Link
              key={raceNo}
              href={href}
              className={`${styles.raceLink} ${
                isActive ? styles.active : ""
              }`}
              aria-current={isActive ? "page" : undefined}
              prefetch
            >
              <span>{raceNo}</span>
              <small>R</small>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
