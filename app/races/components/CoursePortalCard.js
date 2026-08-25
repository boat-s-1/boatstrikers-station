import Link from "next/link";
import styles from "./CoursePortalCard.module.css";

const MORNING_COURSE_CODES = new Set([10, 18, 21, 23]);
const NIGHT_COURSE_CODES = new Set([1, 7, 12, 15, 19, 20, 24]);

function shortTime(value) {
  const match = String(value ?? "").match(/^(\d{1,2}):(\d{2})/);
  if (!match) return "--:--";
  return `${String(match[1]).padStart(2, "0")}:${match[2]}`;
}

function sessionType(course) {
  const code = Number(course?.courseCode);
  if (MORNING_COURSE_CODES.has(code)) return "morning";
  if (NIGHT_COURSE_CODES.has(code)) return "night";
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
  return sample ? sample.entries.slice(0, 6).every(isFemaleEntry) : false;
}

function normalizeGradeText(value) {
  return String(value ?? "")
    .toUpperCase()
    .replace(/Ｇ/g, "G")
    .replace(/Ⅰ/g, "1")
    .replace(/Ⅱ/g, "2")
    .replace(/Ⅲ/g, "3")
    .replace(/\s+/g, "");
}

function detectGrade(course) {
  const values = [];
  for (const race of Array.isArray(course?.races) ? course.races : []) {
    const event = race?.event ?? {};
    values.push(
      event.grade,
      event.race_grade,
      event.series_grade,
      event.grade_code,
      event.event_grade,
      event.meeting_grade,
      event.race_name,
      event.event_name,
      event.series_name,
      event.title
    );
  }
  const text = values.map(normalizeGradeText).filter(Boolean).join(" ");
  if (text.includes("SG")) return "SG";
  if (/G1/.test(text)) return "G1";
  if (/G2/.test(text)) return "G2";
  if (/G3/.test(text)) return "G3";
  return "一般";
}

function raceDayLabel(course, raceDate) {
  const races = Array.isArray(course?.races) ? course.races : [];
  const firstEvent = races.find((race) => race?.event)?.event ?? null;
  const raceDayNo = Number(firstEvent?.race_day_no ?? firstEvent?.raceDayNo ?? 0);
  const openingDate = String(firstEvent?.opening_date ?? "").slice(0, 10);

  if (raceDayNo > 0) return `${raceDayNo}日目`;
  if (openingDate && openingDate === String(raceDate)) return "初日";
  return "開催中";
}

function specialStage(course) {
  const races = Array.isArray(course?.races) ? course.races : [];
  const kindCodes = new Set(
    races.map((race) => String(race?.raceKindCode ?? race?.race_kind_code ?? "").padStart(4, "0"))
  );
  if (kindCodes.has("0021")) return "優勝戦";
  if (kindCodes.has("0011")) return "準優勝戦";
  return null;
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

function gradeClass(grade) {
  if (grade === "SG") return styles.gradeSG;
  if (grade === "G1") return styles.gradeG1;
  if (grade === "G2") return styles.gradeG2;
  if (grade === "G3") return styles.gradeG3;
  return styles.gradeGeneral;
}

export default function CoursePortalCard({ course, raceDate }) {
  const code = String(Number(course.courseCode)).padStart(2, "0");
  const type = sessionType(course);
  const grade = detectGrade(course);
  const ladies = isLadiesCourse(course);
  const finished = course.liveStatus === "finished";
  const stage = specialStage(course);
  const nextRaceNo = Number(course.nextRaceNo || 0) || null;
  const nextClosing = shortTime(course.nextClosingTime);
  const urgency = deadlineUrgency(course.nextClosingAt);

  return (
    <Link
      href={`/races/${code}?date=${raceDate}`}
      prefetch={false}
      className={`${styles.card} ${styles[type]} ${finished ? styles.cardFinished : ""}`}
    >
      <div className={styles.topRow}>
        <span className={`${styles.grade} ${gradeClass(grade)}`}>{grade}</span>
        <span className={styles.code}>#{code}</span>
      </div>

      <div className={styles.nameRow}>
        <h3>{course.courseName}</h3>
        <span className={styles.session}>{sessionLabel(type)}</span>
      </div>

      <div className={styles.metaRow}>
        <span className={styles.dayLabel}>{raceDayLabel(course, raceDate)}</span>
        {ladies && <span className={styles.ladies}>🌸 女子戦</span>}
        {stage && <span className={styles.stage}>{stage}</span>}
      </div>

      <div className={`${styles.raceLine} ${styles[`deadline_${urgency}`]}`}>
        {finished ? (
          <strong>✓ 本日終了</strong>
        ) : nextRaceNo ? (
          <>
            <strong>{nextRaceNo}R</strong>
            <span>{nextClosing} 〆切</span>
          </>
        ) : (
          <strong>出走表公開中</strong>
        )}
      </div>
    </Link>
  );
}
