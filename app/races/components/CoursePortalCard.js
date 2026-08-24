import Link from "next/link";
import styles from "./CoursePortalCard.module.css";

const SESSION_BACKGROUNDS = {
  morning: "/api/course-card-background/morning",
  day: "/api/course-card-background/day",
  night: "/api/course-card-background/night",
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
  const races = Array.isArray(course?.races) ? course.races : [];
  const values = [];

  for (const race of races) {
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
  if (/\bSG\b/.test(text) || text.includes("SG")) return "SG";
  if (/G1/.test(text)) return "G1";
  if (/G2/.test(text)) return "G2";
  if (/G3/.test(text)) return "G3";
  return null;
}

function detectStage(course, raceDate) {
  const races = Array.isArray(course?.races) ? course.races : [];
  const kindCodes = new Set(
    races.map((race) => String(race?.raceKindCode ?? race?.race_kind_code ?? "").padStart(4, "0"))
  );

  if (kindCodes.has("0021")) return "優勝戦";
  if (kindCodes.has("0011")) return "準優勝戦";

  const firstEvent = races.find((race) => race?.event)?.event ?? null;
  const raceDayNo = Number(firstEvent?.race_day_no ?? firstEvent?.raceDayNo ?? 0);
  const openingDate = String(firstEvent?.opening_date ?? "").slice(0, 10);
  if (raceDayNo === 1 || (openingDate && openingDate === String(raceDate))) return "初日";

  return null;
}

function eventBadges(course, raceDate) {
  return [detectGrade(course), detectStage(course, raceDate)].filter(Boolean).slice(0, 2);
}

function badgeLabel(badge) {
  if (badge === "女子戦") return "🌸 女子戦";
  if (badge === "優勝戦") return "🏆 優勝戦";
  if (badge === "準優勝戦") return "🔥 準優勝戦";
  if (badge === "初日") return "🚩 初日";
  return badge;
}

function badgeClass(badge) {
  if (badge === "女子戦") return styles.infoTag_ladies;
  if (badge === "優勝戦") return styles.infoTag_優勝戦;
  if (badge === "準優勝戦") return styles.infoTag_準優勝戦;
  if (badge === "初日") return styles.infoTag_初日;
  if (badge === "SG") return styles.infoTag_sg;
  if (badge === "G1") return styles.infoTag_g1;
  if (badge === "G2") return styles.infoTag_g2;
  if (badge === "G3") return styles.infoTag_g3;
  return "";
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
  const specialBadges = eventBadges(course, raceDate);
  const infoBadges = [
    ...(ladies ? ["女子戦"] : []),
    ...specialBadges,
  ].slice(0, 3);

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

        {infoBadges.length > 0 && (
          <div className={styles.infoTags}>
            {infoBadges.map((badge) => (
              <span key={badge} className={`${styles.infoTag} ${badgeClass(badge)}`}>
                {badgeLabel(badge)}
              </span>
            ))}
          </div>
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
