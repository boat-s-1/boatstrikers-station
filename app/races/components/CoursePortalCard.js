import Link from "next/link";
import styles from "./CoursePortalCard.module.css";
import layerStyles from "./CoursePortalCardLayers.module.css";

const SESSION_BACKGROUNDS = {
  morning: "/races/card-morning-final.jpg",
  day: "/races/card-day-final.jpg",
  night: "/races/card-night-final.jpg",
};

const MORNING_COURSE_CODES = new Set([10, 18, 21, 23]);
const NIGHT_COURSE_CODES = new Set([1, 7, 12, 15, 19, 20, 24]);

const COURSE_ENGLISH = {
  "01": "KIRYU", "02": "TODA", "03": "EDOGAWA", "04": "HEIWAJIMA",
  "05": "TAMAGAWA", "06": "HAMANAKO", "07": "GAMAGORI", "08": "TOKONAME",
  "09": "TSU", "10": "MIKUNI", "11": "BIWAKO", "12": "SUMINOE",
  "13": "AMAGASAKI", "14": "NARUTO", "15": "MARUGAME", "16": "KOJIMA",
  "17": "MIYAJIMA", "18": "TOKUYAMA", "19": "SHIMONOSEKI", "20": "WAKAMATSU",
  "21": "ASHIYA", "22": "FUKUOKA", "23": "KARATSU", "24": "OMURA",
};

function shortTime(value) {
  const match = String(value ?? "").match(/^(\d{1,2}):(\d{2})/);
  if (!match) return "--:--";
  return `${String(match[1]).padStart(2, "0")}:${match[2]}`;
}

function sessionType(course) {
  const courseCode = Number(course?.courseCode);
  if (MORNING_COURSE_CODES.has(courseCode)) return "morning";
  if (NIGHT_COURSE_CODES.has(courseCode)) return "night";
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
  const values = [];
  for (const race of Array.isArray(course?.races) ? course.races : []) {
    const event = race?.event ?? {};
    values.push(
      event.grade, event.race_grade, event.series_grade, event.grade_code,
      event.event_grade, event.meeting_grade, event.race_name, event.event_name,
      event.series_name, event.title
    );
  }
  const text = values.map(normalizeGradeText).filter(Boolean).join(" ");
  if (text.includes("SG")) return "SG";
  if (/G1/.test(text)) return "G1";
  if (/G2/.test(text)) return "G2";
  if (/G3/.test(text)) return "G3";
  return null;
}

function detectStage(course, raceDate) {
  const races = Array.isArray(course?.races) ? course.races : [];
  const kindCodes = new Set(races.map((race) => String(race?.raceKindCode ?? race?.race_kind_code ?? "").padStart(4, "0")));
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
  const code = String(Number(course.courseCode)).padStart(2, "0");
  const type = sessionType(course);
  const background = SESSION_BACKGROUNDS[type] ?? SESSION_BACKGROUNDS.day;
  const englishName = COURSE_ENGLISH[code] ?? "BOATRACE";
  const ladies = isLadiesCourse(course);
  const finished = course.liveStatus === "finished";
  const directRace = latestDirectRace(course);
  const nextRaceNo = Number(course.nextRaceNo || 0) || null;
  const nextClosing = shortTime(course.nextClosingTime);
  const urgency = deadlineUrgency(course.nextClosingAt);
  const infoBadges = [
    ...(ladies ? ["女子戦"] : []),
    ...eventBadges(course, raceDate),
  ].slice(0, 3);

  return (
    <Link
      href={`/races/${code}?date=${raceDate}`}
      prefetch={false}
      className={`${styles.card} ${styles[type]}`}
    >
      <img
        src={background}
        alt=""
        aria-hidden="true"
        className={layerStyles.backgroundImage}
        loading="eager"
        decoding="async"
      />
      <div className={`${styles.tint} ${layerStyles.tintLayer}`} aria-hidden="true" />

      <div className={`${styles.topRow} ${layerStyles.foreground}`}>
        <span className={styles.code}>#{code}</span>
        <div className={styles.tags}>
          <span className={styles.session}>{sessionLabel(type)}</span>
        </div>
      </div>

      <div className={`${styles.mainInfo} ${layerStyles.foreground}`}>
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

        <div className={styles.infoTags} aria-label={infoBadges.length ? "開催情報" : undefined}>
          {infoBadges.map((badge) => (
            <span key={badge} className={`${styles.infoTag} ${badgeClass(badge)}`}>
              {badgeLabel(badge)}
            </span>
          ))}
        </div>
      </div>

      <div className={`${styles.bottomRow} ${layerStyles.foreground}`}>
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
