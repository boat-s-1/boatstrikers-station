import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { getHatsuneNews } from "../hatsune/newsData";
import styles from "./HomeRaceInfo.module.css";

const NIGHT_COURSE_CODES = new Set([1, 7, 12, 15, 19, 20, 24]);
const MORNING_COURSE_CODES = new Set([10, 14, 18, 21, 23]);

const COURSE_NAMES = {
  1: "桐生", 2: "戸田", 3: "江戸川", 4: "平和島", 5: "多摩川", 6: "浜名湖",
  7: "蒲郡", 8: "常滑", 9: "津", 10: "三国", 11: "びわこ", 12: "住之江",
  13: "尼崎", 14: "鳴門", 15: "丸亀", 16: "児島", 17: "宮島", 18: "徳山",
  19: "下関", 20: "若松", 21: "芦屋", 22: "福岡", 23: "唐津", 24: "大村",
};

const MODE_META = {
  oni: { label: "鬼絞り", emoji: "🔥" },
  hit: { label: "的中率", emoji: "🎯" },
  recovery: { label: "回収率", emoji: "💰" },
  hole: { label: "穴狙い", emoji: "🚀" },
};

const NEWS_CATEGORY_LABELS = {
  result: "結果",
  women: "女子",
  "女子戦": "女子",
  suijinsai: "選手情報",
  "A1/A2・級別": "選手情報",
  grade: "SG・G1",
  SG: "SG・G1",
  G1: "SG・G1",
  G2: "SG・G1",
  G3: "G3",
  motor: "モーター",
  tomorrow: "注目",
  topic: "NEWS",
  win: "結果",
};

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) return null;

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

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

function getFutureRace(course) {
  const now = Date.now();
  const races = Array.isArray(course?.races) ? course.races : [];

  return [...races]
    .sort((a, b) => Number(a?.raceNo ?? a?.race_no ?? 0) - Number(b?.raceNo ?? b?.race_no ?? 0))
    .find((race) => {
      const closingAt = race?.closingAt ?? race?.closing_at;
      if (!closingAt) return false;

      const closingTime = new Date(closingAt).getTime();
      return Number.isFinite(closingTime) && closingTime > now;
    }) ?? null;
}

function statusInfo(course) {
  const raceCount = Number(course.raceCount || 0);
  const resultCount = Number(course.resultCount || 0);
  const futureRace = getFutureRace(course);
  const nextRaceNo = Number(
    course.nextRaceNo || futureRace?.raceNo || futureRace?.race_no || 0
  );

  const hasFutureRace = Boolean(futureRace);

  if (
    !hasFutureRace &&
    (course.liveStatus === "finished" ||
      (raceCount > 0 && resultCount >= raceCount))
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

  if (hasFutureRace) {
    return {
      label: nextRaceNo ? `${nextRaceNo}Rから` : "開催中",
      key: "scheduled",
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

function formatNewsDate(value) {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat("ja-JP", {
      timeZone: "Asia/Tokyo",
      month: "numeric",
      day: "numeric",
    }).format(new Date(value));
  } catch {
    return "";
  }
}

function groupHitRows(rows, limit) {
  const grouped = new Map();

  for (const row of rows || []) {
    const key = `${row.race_date}:${row.course_code}:${row.race_no}`;
    const mode = MODE_META[row.mode_key] || {
      label: row.mode_name || row.mode_key || "AI予想",
      emoji: "🤖",
    };

    if (!grouped.has(key)) {
      grouped.set(key, {
        race_date: row.race_date,
        course_code: row.course_code,
        race_no: row.race_no,
        payout: Number(row.payout || 0),
        result_combination: row.result_combination || "",
        settled_at: row.settled_at || "",
        modes: [],
      });
    }

    const item = grouped.get(key);
    item.payout = Math.max(item.payout, Number(row.payout || 0));
    if (!item.result_combination && row.result_combination) {
      item.result_combination = row.result_combination;
    }
    if (!item.modes.some((entry) => entry.key === row.mode_key)) {
      item.modes.push({ key: row.mode_key, ...mode });
    }
  }

  return [...grouped.values()].slice(0, limit);
}

async function getLatestAiHits(limit = 5) {
  const supabase = getClient();
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from("bs_ai_bet_results")
      .select(
        "race_date,course_code,race_no,mode_key,mode_name,is_hit,payout,result_combination,settled_at"
      )
      .eq("is_hit", true)
      .order("race_date", { ascending: false })
      .order("settled_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error("最新AI的中レース取得エラー:", error.message);
      return [];
    }

    return groupHitRows(Array.isArray(data) ? data : [], limit);
  } catch (error) {
    console.error("最新AI的中レース取得例外:", error);
    return [];
  }
}

async function getLatestHomeNews() {
  try {
    const items = await getHatsuneNews({ limit: 3, category: "all" });
    return Array.isArray(items) ? items.slice(0, 3) : [];
  } catch (error) {
    console.error("トップページ最新NEWS取得エラー:", error);
    return [];
  }
}

function HitCard({ item }) {
  const payout = Number(item.payout || 0);
  const courseName = COURSE_NAMES[Number(item.course_code)] || `#${item.course_code}`;

  return (
    <article className={styles.hitCard}>
      <div className={styles.hitTop}>
        <strong className={styles.hitRace}>
          {courseName} {Number(item.race_no)}R
        </strong>
        <span className={styles.hitNo}>{formatHitDate(item.race_date)}</span>
      </div>

      <div className={styles.hitModes} aria-label="的中した買い方">
        {item.modes.map((mode) => (
          <span className={styles.hitMode} key={mode.key || mode.label}>
            {mode.emoji} {mode.label}
          </span>
        ))}
      </div>

      <span className={styles.hitLabel}>払戻</span>
      <strong className={styles.hitPayout}>{payout.toLocaleString()}円</strong>

      {item.result_combination ? (
        <span className={styles.hitCombination}>
          結果 <strong>{item.result_combination}</strong>
        </span>
      ) : null}

      {item.modes.length > 1 ? (
        <span className={styles.hitMulti}>{item.modes.length}モード的中</span>
      ) : null}
    </article>
  );
}

function LatestNewsBlock({ items }) {
  if (!items.length) return null;

  return (
    <section className={styles.latestNewsSection} aria-labelledby="home-latest-news-title">
      <div className={styles.latestNewsHeader}>
        <div>
          <span>BOATSTRIKERS NEWS</span>
          <h2 id="home-latest-news-title">最新ニュース</h2>
        </div>
        <Link href="/news" className={styles.latestNewsAllLink}>一覧を見る ›</Link>
      </div>

      <div className={styles.latestNewsList}>
        {items.map((item, index) => (
          <Link
            key={item.id}
            href={`/news/${item.id}`}
            className={`${styles.latestNewsRow} ${index === 0 ? styles.latestNewsRowFeatured : ""}`}
          >
            <div className={styles.latestNewsMeta}>
              {index === 0 ? <span className={styles.latestNewsNew}>NEW</span> : null}
              <time>{formatNewsDate(item.published_at)}</time>
              <span className={styles.latestNewsCategory}>
                {NEWS_CATEGORY_LABELS[item.category] || "NEWS"}
              </span>
            </div>
            <strong>{item.list_headline || item.title}</strong>
            <span className={styles.latestNewsArrow} aria-hidden="true">›</span>
          </Link>
        ))}
      </div>

      <Link href="/news" className={styles.latestNewsCta}>
        もっとニュースを見る <span aria-hidden="true">→</span>
      </Link>
    </section>
  );
}

export default async function HomeRaceInfo({ courses = [], raceDate = "" }) {
  const [hitItems, latestNews] = await Promise.all([
    getLatestAiHits(5),
    getLatestHomeNews(),
  ]);
  const hasCourses = Array.isArray(courses) && courses.length > 0;

  return (
    <>
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
              <h3>AI的中レース</h3>
            </div>
            <span className={styles.swipeHint}>最新5レース・横にスワイプ →</span>
          </div>

          {hitItems.length > 0 ? (
            <div className={styles.hitsRail}>
              {hitItems.map((item) => (
                <HitCard
                  item={item}
                  key={`${item.race_date}-${item.course_code}-${item.race_no}`}
                />
              ))}
            </div>
          ) : (
            <div className={styles.hitEmpty}>
              <span aria-hidden="true">📊</span>
              <div>
                <strong>AI的中実績を集計中です。</strong>
                <p>AI予想が的中すると、最新順にここへ表示されます。</p>
              </div>
            </div>
          )}

          <div className={styles.resultsLinkRow}>
            <Link href="/ai-results?period=all" className={styles.resultsLink}>
              AIの過去成績をすべて見る →
            </Link>
          </div>
        </div>
      </section>

      <LatestNewsBlock items={latestNews} />
    </>
  );
}
