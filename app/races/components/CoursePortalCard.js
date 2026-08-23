import Link from "next/link";
import styles from "./CoursePortalCard.module.css";
import { MORNING_BACKGROUND } from "./courseCardBackgroundMorning";
import { DAY_BACKGROUND } from "./courseCardBackgroundDay";
import { NIGHT_BACKGROUND } from "./courseCardBackgroundNight";

const SESSION_BACKGROUNDS = {
  morning: MORNING_BACKGROUND,
  day: DAY_BACKGROUND,
  night: NIGHT_BACKGROUND,
};

const COURSE_ENGLISH = {
  "01": "KIRYU",
  "02": "TODA",
  "03": "EDOGAWA",
  "04": "HEIWAJIMA",
  "05": "TAMAGAWA",
  "06": "HAMANAKO",
  "07": "GAMAGORI",
  "08": "TOKONAME",
  "09": "TSU",
  "10": "MIKUNI",
  "11": "BIWAKO",
  "12": "SUMINOE",
  "13": "AMAGASAKI",
  "14": "NARUTO",
  "15": "MARUGAME",
  "16": "KOJIMA",
  "17": "MIYAJIMA",
  "18": "TOKUYAMA",
  "19": "SHIMONOSEKI",
  "20": "WAKAMATSU",
  "21": "ASHIYA",
  "22": "FUKUOKA",
  "23": "KARATSU",
  "24": "OMURA",
};

function timeMinutes(value) {
  const match = String(value ?? "").match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function shortTime(value) {
  const match = String(value ?? "").match(/^(\d{1,2}):(\d{2})/);
  if (!match) return "--:--";
  return `${String(match[1]).padStart(2, "0")}:${match[2]}`;
}

function sessionType(course) {
  const races = Array.isArray(course?.races) ? course.races : [];
  const first = races.find((race) => timeMinutes(race?.closingTime) !== null);
  const last = [...races].reverse().find((race) => timeMinutes(race?.closingTime) !== null);
  const firstMinutes = timeMinutes(first?.closingTime);
  const lastMinutes = timeMinutes(last?.closingTime);

  if (firstMinutes !== null && firstMinutes < 10 * 60) return "morning";
  if (lastMinutes !== null && lastMinutes >= 18 * 60) return "night";
  return "day";
}

function sessionLabel(type) {
  if (type === "morning") return "🌅 モーニング";
  if (type === "night") return "🌙 ナイター";
  return "☀ デイ";
}

function isFemaleEntry(entry) {
  const gender = String(entry?.gender ?? "").trim().toUpperCase();
  const genderCode = String(entry?.gender_code ?? "").trim();
  const sexCode = Number(entry?.sex_code);
  return gender === "F" || gender === "FEMALE" || gender === "女" || gender === "女子" || genderCode === "2" || sexCode === 2;
}

function isLadiesCourse(course) {
  const races = Array.isArray(course?.races) ? course.races : [];
  const sample = races.find((race) => Array.isArray(race?.entries) && race.entries.length >= 6);
  if (!sample) return false;
  return sample.entries.slice(0, 6).every(isFemaleEntry);
}

function latestDirectRace(course) {
  const races = Array.isArray(course?.races) ? course.races : [];
  const available = races.filter((race) => race?.hasExhibition && !race?.resultAvailable);
  if (!available.length) return null;
  return available.reduce((latest, race) => Number(race.raceNo) > Number(latest.raceNo) ? race : latest);
}

function deadlineUrgency(closingAt) {
  if (!closingAt) return "normal";
  const target = new Date(closingAt).getTime();
  if (!Number.isFinite(target)) return "normal";
  const minutes = (target - Date.now()) / 60000;
  if (minutes < 0) return "normal";
  if (minutes <= 10) return "urgent";
  if (minutes <= 30) return "soon";
  return "normal";
}

export default function CoursePortalCard({ course, raceDate, noteCount = 0 }) {
  const numericCode = Number(course.courseCode);
  const code = String(numericCode).padStart(2, "0");
  const type = sessionType(course);
  const background = SESSION_BACKGROUNDS[type] ?? SESSION_BACKGROUNDS.day;
  const englishName = COURSE_ENGLISH[code] ?? "BOATRACE";
  const ladies = isLadiesCourse(course);
  const finished = course.liveStatus === "finished";
  const directRace = latestDirectRace(course);
  const nextRaceNo = Number(course.nextRaceNo || 0) || null;
  const nextClosing = shortTime(course.nextClosingTime);
  const urgency = deadlineUrgency(course.nextClosingAt);

  return (
    <Link
      href={`/races/${code}?date=${raceDate}`}
      className={`${styles.card} ${styles[type]}`}
      style={{ backgroundImage: `url("${background}")` }}
    >
      <div className={styles.tint} aria-hidden="true" />

      <div className={styles.topRow}>
        <span className={styles.code}>#{code}</span>
        <div className={styles.tags}>
          <span className={styles.session}>{sessionLabel(type)}</span>
          {ladies && <span className={styles.ladies}>🌸 女子戦</span>}
        </div>
      </div>

      <div className={styles.mainInfo}>
        <h3>{course.courseName}</h3>
        <div className={styles.englishName}>BoatRace {englishName}</div>
        {finished ? (
          <div className={`${styles.statusLine} ${styles.finished}`}>✓ 本日終了</div>
        ) : nextRaceNo ? (
          <div className={`${styles.statusLine} ${styles[`deadline_${urgency}`]}`}>
            ⏰ {nextRaceNo}R {nextClosing} 〆切
          </div>
        ) : (
          <div className={styles.statusLine}>出走表公開中</div>
        )}
      </div>

      <div className={styles.bottomRow}>
        {!finished && directRace ? (
          <span className={styles.direct}>⚡ {directRace.raceNo}R 直前更新</span>
        ) : (
          <span className={styles.spacer} aria-hidden="true" />
        )}
        {noteCount > 0 && <span className={styles.newspaper}>📰 {noteCount}</span>}
      </div>
    </Link>
  );
}
