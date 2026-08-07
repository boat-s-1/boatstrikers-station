import Link from "next/link";
import {
  getAvailableDates,
  getCoursesByDate,
  getPublishedNoteFeaturesByDate,
  getAiBetHitFlashByDate,
  getCourseName,
  normalizeDate,
} from "../lib/boatstrikersPlatform";
import styles from "./phase2.module.css";

const NIGHT_COURSE_CODES = new Set([1, 7, 12, 15, 19, 20, 24]);

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

const POPULAR_CONTENTS = [
  {
    href: "/library",
    icon: "📚",
    title: "一果図書館",
    text: "攻略本・週刊誌・24場データ",
    image: "/library-banner.jpg",
  },
  {
    href: "/ichika",
    icon: "🍎",
    title: "一果のイン逃げ",
    text: "前日版・直前版のAI予想",
    image: "/ichika-banner.jpg",
  },
  {
    href: "/hatsune",
    icon: "🌸",
    title: "初音の女子戦",
    text: "女子戦の注目レースを研究",
    image: "/hatsune-banner.jpg",
  },
  {
    href: "/kiina",
    icon: "🎯",
    title: "キイナの穴党塾",
    text: "5号艇と高配当を狙う",
    image: "/kiina-banner.jpg",
  },
];

export const dynamic = "force-dynamic";

function getJstDateString() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function getCourseStatus(course, raceDate) {
  const today = getJstDateString();
  const raceCount = Number(course.raceCount ?? 0);
  const resultCount = Number(course.resultCount ?? 0);
  const exhibitionCount = Number(course.exhibitionCount ?? 0);

  if (raceDate < today || course.liveStatus === "finished") {
    return { key: "finished", label: "結果確定", detail: `${resultCount}/${raceCount}R` };
  }
  if (raceDate > today) {
    return { key: "scheduled", label: "開催前", detail: "出走表公開中" };
  }
  if (course.liveStatus === "live") {
    return {
      key: "live",
      label: "LIVE",
      detail: course.liveRaceNo ? `${course.liveRaceNo}R進行中` : `${resultCount}R終了`,
    };
  }
  if (course.liveStatus === "exhibition") {
    return { key: "exhibition", label: "展示中", detail: `${exhibitionCount}R公開` };
  }
  return { key: "scheduled", label: "出走表公開", detail: "開催前" };
}

function noteTimingLabel(value) {
  const timing = String(value ?? "both").toLowerCase();
  if (["previous_day", "previous", "before"].includes(timing)) return "前日版";
  if (["after_exhibition", "live", "direct", "last_minute"].includes(timing)) return "直前版";
  return "新聞公開中";
}

function yen(value) {
  return `${Number(value ?? 0).toLocaleString("ja-JP")}円`;
}

export const metadata = {
  title: "本日のボートレース出走表・レース情報",
  description:
    "本日開催されるボートレースの出走表、選手情報、モーター成績、展示情報、BoatStrikers独自分析を確認できます。",
};

export default async function RacesPage({ searchParams }) {
  const query = await searchParams;
  const raceDate = normalizeDate(query?.date);

  let courses = [];
  let dates = [];
  let newspapers = [];
  let hitFlash = [];
  let loadError = null;

  try {
    [courses, dates, newspapers, hitFlash] = await Promise.all([
      getCoursesByDate(raceDate),
      getAvailableDates(),
      getPublishedNoteFeaturesByDate(raceDate, false),
      getAiBetHitFlashByDate(raceDate, 6),
    ]);
  } catch (error) {
    console.error("出走表トップ取得エラー:", error);
    loadError = error instanceof Error ? error.message : "データの取得に失敗しました。";
  }

  const noteCountByCourse = newspapers.reduce((map, item) => {
    const code = Number(item.course_code);
    map.set(code, (map.get(code) ?? 0) + 1);
    return map;
  }, new Map());

  return (
    <main className={`${styles.page} ${styles.portalPage}`}>
      <header className={styles.portalHero}>
        <div className={styles.portalHeroBackground} />
        <div className={styles.portalHeroShade} />
        <div className={styles.portalHeroInner}>
          <Link href="/" className={styles.portalHomeLink}>← BoatStrikers HOME</Link>
          <div className={styles.portalHeroCopy}>
            <p>BOATSTRIKERS RACE &amp; NEWSPAPER</p>
            <h1>今日のレースを、<br />新聞からもっと面白く。</h1>
            <span>出走表・展示情報・AI予想を5分ごとに更新中</span>
          </div>
          <div className={styles.portalHeroSummary}>
            <div><small>開催場</small><strong>{courses.length}</strong></div>
            <div><small>公開新聞</small><strong>{newspapers.length}</strong></div>
            <div><small>開催日</small><strong>{raceDate.slice(5).replace("-", "/")}</strong></div>
          </div>
        </div>
      </header>

      <div className={styles.portalContent}>
        {dates.length > 0 && (
          <nav className={styles.portalDateNav} aria-label="開催日を選択">
            {dates.map((date) => (
              <Link
                key={date}
                href={`/races?date=${date}`}
                className={`${styles.portalDateLink} ${date === raceDate ? styles.portalDateActive : ""}`}
              >
                {date.slice(5).replace("-", "/")}
              </Link>
            ))}
          </nav>
        )}


<div className={styles.portalSection}>
  <Image
    src="/S__22142979.jpg"
    alt="只今、開発中"
    className={styles.developingBannerImage}
  />
</div>


        <section className={styles.portalSection}>
          <div className={styles.portalSectionHead}>
            <div><span>DAILY NEWSPAPER</span><h2>📰 今日公開の新聞</h2></div>
            <b>{newspapers.length}件公開</b>
          </div>

          {newspapers.length > 0 ? (
            <div className={styles.newspaperRail}>
              {newspapers.map((item) => {
                const code = String(item.course_code).padStart(2, "0");
                const raceHref = `/races/${code}/${item.race_no}?date=${raceDate}`;
                const external = Boolean(item.note_url);
                return (
                  <article key={item.id ?? `${item.course_code}-${item.race_no}-${item.sort_order}`} className={styles.newspaperCard}>
                    <div className={styles.newspaperTop}>
                      <span>{item.character_name || "BoatStrikers"}</span>
                      <b>{noteTimingLabel(item.target_timing)}</b>
                    </div>
                    <div className={styles.newspaperRace}>
                      <small>本日の注目レース</small>
                      <strong>{getCourseName(item.course_code)} {item.race_no}R</strong>
                    </div>
                    <h3>{item.feature_title || "今日の予想新聞を公開中"}</h3>
                    <p>{item.teaser_text || "展開・評価・買い目の詳しい解説を公開しています。"}</p>
                    <div className={styles.newspaperActions}>
                      <Link href={raceHref}>出走表を見る</Link>
                      {external && (
                        <a href={item.note_url} target="_blank" rel="noreferrer">
                          {item.cta_label || "noteで読む"} ↗
                        </a>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className={styles.portalEmpty}>
              <span>📰</span><strong>本日の新聞は準備中です</strong><p>公開されると、ここに自動で表示されます。</p>
            </div>
          )}
        </section>

        <section className={styles.portalSection}>
          <div className={styles.portalSectionHead}>
            <div><span>TODAY&apos;S COURSES</span><h2>🚤 本日の開催場</h2></div>
            <b>{courses.length}場</b>
          </div>

          {loadError ? (
            <div className={styles.portalEmpty}><span>⚠️</span><strong>データを取得できませんでした</strong><p>{loadError}</p></div>
          ) : courses.length === 0 ? (
            <div className={styles.portalEmpty}><span>🚤</span><strong>この日の開催データはありません</strong><p>上の日付から同期済みの日を選択してください。</p></div>
          ) : (
            <div className={styles.compactCourseGrid}>
              {courses.map((course) => {
                const numericCode = Number(course.courseCode);
                const code = String(numericCode).padStart(2, "0");
                const status = getCourseStatus(course, raceDate);
                const noteCount = noteCountByCourse.get(numericCode) ?? 0;
                const isNight = NIGHT_COURSE_CODES.has(numericCode);
                const background = COURSE_BACKGROUNDS[numericCode] ?? "/IMG_6460.jpeg";
                return (
                  <Link
                    key={numericCode}
                    href={`/races/${code}?date=${raceDate}`}
                    className={styles.compactCourseCard}
                    style={{ backgroundImage: `linear-gradient(180deg,rgba(2,12,32,.10),rgba(2,14,38,.88)),url("${background}")` }}
                  >
                    <div className={styles.compactCourseTop}>
                      <span>#{code}</span>
                      <b className={styles[`courseStatus_${status.key}`]}>{status.label}</b>
                    </div>
                    <div className={styles.compactCourseBottom}>
                      <div><h3>{course.courseName}</h3><p>{status.detail}</p></div>
                      <div className={styles.compactCourseBadges}>
                        {isNight && <span>🌙</span>}
                        {noteCount > 0 && <strong>📰 {noteCount}件</strong>}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        <section className={styles.portalSection}>
          <div className={styles.portalSectionHead}>
            <div><span>HIT FLASH</span><h2>🎯 的中速報</h2></div>
            <Link href="/admin/ai-bet-stats">成績を見る →</Link>
          </div>

          {hitFlash.length > 0 ? (
            <div className={styles.hitFlashList}>
              {hitFlash.map((item) => {
                const code = String(item.course_code).padStart(2, "0");
                return (
                  <Link key={item.id ?? `${item.course_code}-${item.race_no}-${item.mode_key}`} href={`/races/${code}/${item.race_no}?date=${raceDate}`} className={styles.hitFlashCard}>
                    <div className={styles.hitFlashIcon}>的中</div>
                    <div className={styles.hitFlashMain}>
                      <span>{item.mode_name || "AI予想"}</span>
                      <strong>{getCourseName(item.course_code)} {item.race_no}R</strong>
                      <small>{item.hit_ticket || item.result_combination}</small>
                    </div>
                    <div className={styles.hitFlashMoney}><small>払戻</small><strong>{yen(item.payout)}</strong></div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className={styles.portalEmpty}><span>🎯</span><strong>的中結果を集計中です</strong><p>結果確定後、AIの的中速報を表示します。</p></div>
          )}
        </section>

        <section className={styles.portalSection}>
          <div className={styles.portalSectionHead}>
            <div><span>POPULAR CONTENTS</span><h2>📚 人気コンテンツ</h2></div>
          </div>
          <div className={styles.popularGrid}>
            {POPULAR_CONTENTS.map((item) => (
              <Link key={item.href} href={item.href} className={styles.popularCard}>
                <div className={styles.popularImage} style={{ backgroundImage: `linear-gradient(90deg,rgba(5,18,43,.76),rgba(5,18,43,.18)),url("${item.image}")` }} />
                <div className={styles.popularCopy}><span>{item.icon}</span><div><strong>{item.title}</strong><small>{item.text}</small></div><b>→</b></div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
