import Link from "next/link";
import { getPublicScheduleSupabase } from "../../lib/scheduleSupabase";
import styles from "./HomeRaceInfo.module.css";

const NIGHT_COURSE_CODES = new Set([1, 7, 12, 15, 19, 20, 24]);
const MORNING_COURSE_CODES = new Set([10, 14, 18, 21, 23]);

const KIND_META = {
  prediction: { icon: "🎯", label: "予想" },
  hit: { icon: "🎉", label: "的中" },
  update: { icon: "📰", label: "更新" },
  radio: { icon: "🎙️", label: "ラジオ" },
  video: { icon: "▶️", label: "動画" },
  notice: { icon: "📢", label: "お知らせ" },
};

const CHARACTER_META = {
  ichika: { label: "一果", className: styles.ichika },
  hatsune: { label: "初音", className: styles.hatsune },
  kiina: { label: "キイナ", className: styles.kiina },
  all: { label: "BoatStrikers", className: styles.all },
};

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

function formatDate(value) {
  if (!value) return "";

  try {
    return new Intl.DateTimeFormat("ja-JP", {
      timeZone: "Asia/Tokyo",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return "";
  }
}

async function getRealtimeItems(limit = 3) {
  const client = getPublicScheduleSupabase();
  if (!client) return [];

  try {
    const { data, error } = await client
      .from("realtime_updates")
      .select(
        "id,kind,character,title,body,link_url,image_url,published_at,created_at"
      )
      .eq("is_active", true)
      .eq("show_home", true)
      .lte("published_at", new Date().toISOString())
      .order("published_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("トップページ・リアルタイム更新取得エラー:", error.message);
      return [];
    }

    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("トップページ・リアルタイム更新取得例外:", error);
    return [];
  }
}

function UpdateCard({ item }) {
  const kind = KIND_META[item.kind] || KIND_META.notice;
  const chara = CHARACTER_META[item.character] || CHARACTER_META.all;

  const inner = (
    <>
      <div className={styles.updateTop}>
        <div className={styles.updateBadges}>
          <span className={styles.kindBadge}>
            {kind.icon} {kind.label}
          </span>
          <span className={`${styles.characterBadge} ${chara.className}`}>
            {chara.label}
          </span>
        </div>
        <time className={styles.updateTime}>
          {formatDate(item.published_at || item.created_at)}
        </time>
      </div>

      <h4 className={styles.updateTitle}>{item.title}</h4>

      {item.body ? (
        <p className={styles.updateBody}>{item.body}</p>
      ) : null}

      {item.image_url ? (
        <div className={styles.updateImageWrap}>
          <img
            src={item.image_url}
            alt={item.title || "リアルタイム更新画像"}
            className={styles.updateImage}
          />
        </div>
      ) : null}

      {item.link_url ? (
        <span className={styles.updateCta}>詳しく見る →</span>
      ) : null}
    </>
  );

  if (!item.link_url) {
    return <article className={styles.updateCard}>{inner}</article>;
  }

  const external = /^https?:\/\//.test(item.link_url);

  return external ? (
    <a
      href={item.link_url}
      target="_blank"
      rel="noopener noreferrer"
      className={styles.updateCard}
    >
      {inner}
    </a>
  ) : (
    <Link href={item.link_url} className={styles.updateCard}>
      {inner}
    </Link>
  );
}

export default async function HomeRaceInfo({
  courses = [],
  raceDate = "",
  realtimeLimit = 3,
}) {
  const realtimeItems = await getRealtimeItems(realtimeLimit);
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
                  className={`${styles.courseCard} ${
                    styles[type.key]
                  } ${
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
                    className={`${styles.courseStatus} ${
                      styles[`status_${status.key}`]
                    }`}
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

      <div className={styles.block}>
        <div className={styles.subHeader}>
          <div className={styles.subTitleWrap}>
            <span className={styles.subIcon} aria-hidden="true">⚡</span>
            <h3>リアルタイム予想</h3>
          </div>

          <a
            href={
              process.env.NEXT_PUBLIC_BOATSTRIKERS_X_URL ||
              "https://x.com/boatstrikers"
            }
            target="_blank"
            rel="noopener noreferrer"
            className={styles.subLink}
          >
            Xを見る ↗
          </a>
        </div>

        {realtimeItems.length > 0 ? (
          <div className={styles.updateList}>
            {realtimeItems.map((item) => (
              <UpdateCard item={item} key={item.id} />
            ))}
          </div>
        ) : (
          <div className={styles.updateEmpty}>
            <span className={styles.emptyIcon} aria-hidden="true">📡</span>
            <div>
              <strong>現在、新しいリアルタイム予想はありません。</strong>
              <p>更新が入り次第、ここに自動で表示されます。</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
