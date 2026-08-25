import Link from "next/link";
import Image from "next/image";
import {
  getAvailableDates,
  getCoursesByDate,
  getPublishedNoteFeaturesByDate,
  getAiBetHitFlashByDate,
  getAiPredictionPickupsByDate,
  getCourseName,
  normalizeDate,
} from "../lib/boatstrikersPlatform";
import styles from "./phase2.module.css";
import RealtimeUpdates from "../components/RealtimeUpdates";
import CoursePortalCard from "./components/CoursePortalCard";

export const revalidate = 30;

function getJstDateString() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
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

function shortTime(value) {
  const match = String(value ?? "").match(/^(\d{1,2}):(\d{2})/);
  if (!match) return "--:--";
  return `${String(match[1]).padStart(2, "0")}:${match[2]}`;
}

function pickupTickets(value, limit = 2) {
  const source = Array.isArray(value) ? value : [];
  return source
    .map((item) => (typeof item === "string" ? item : item?.ticket))
    .filter(Boolean)
    .slice(0, limit);
}

function scoreText(value) {
  const score = Number(value ?? 0);
  return Number.isFinite(score) ? `${Math.round(score)}%` : "--";
}

function safeNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function clampScore(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function validRaceNo(value) {
  const raceNo = Number(value);
  return Number.isInteger(raceNo) && raceNo >= 1 && raceNo <= 12 ? raceNo : null;
}

function buildFallbackPickups(courses, raceDate) {
  const now = Date.now();
  const today = getJstDateString();
  const candidates = [];

  for (const course of courses ?? []) {
    for (const race of course.races ?? []) {
      if (race.resultAvailable) continue;
      if (raceDate === today && race.closingAt) {
        const closing = new Date(race.closingAt).getTime();
        if (Number.isFinite(closing) && closing <= now) continue;
      }

      const entries = Array.isArray(race.entries) ? race.entries : [];
      if (entries.length < 6) continue;

      const byBoat = new Map(entries.map((entry) => [Number(entry.boat_no), entry]));
      const one = byBoat.get(1);
      if (!one) continue;

      const rate = (entry) => {
        const national = safeNumber(entry?.national_win_rate, 4.8);
        const local = safeNumber(entry?.local_win_rate, national);
        const motor = safeNumber(entry?.motor_2_rate, 30);
        const boat = safeNumber(entry?.boat_2_rate, 30);
        const st = safeNumber(entry?.average_st, 0.18);
        return national * 8 + local * 4 + motor * 0.45 + boat * 0.2 - st * 45;
      };

      const onePower = rate(one);
      const rivals = [2, 3, 4, 5, 6]
        .map((n) => ({ boatNo: n, entry: byBoat.get(n) }))
        .filter((x) => x.entry);
      const rivalScores = rivals
        .map((x) => ({ ...x, score: rate(x.entry) }))
        .sort((a, b) => b.score - a.score);
      const bestRival = rivalScores[0]?.score ?? onePower;
      const gap = onePower - bestRival;

      const oneEx = safeNumber(one.exhibition_time, 0);
      const exTimes = entries
        .map((e) => safeNumber(e.exhibition_time, 0))
        .filter((v) => v > 0);
      const bestEx = exTimes.length ? Math.min(...exTimes) : 0;
      const exhibitionBonus = oneEx > 0 && bestEx > 0
        ? clampScore((bestEx - oneEx + 0.08) * 80, -6, 6)
        : 0;

      const insideExpectation = clampScore(66 + gap * 1.25 + exhibitionBonus, 45, 94);
      const outer = rivalScores.filter((x) => x.boatNo >= 3);
      const outerBest = outer[0];
      const outerGap = (outerBest?.score ?? bestRival) - onePower;
      const holeExpectation = clampScore(55 + outerGap * 1.15 + (insideExpectation < 62 ? 8 : 0), 38, 91);
      const dangerScore = clampScore(100 - insideExpectation + Math.max(0, outerGap * 1.1), 20, 92);
      const totalScore = clampScore((insideExpectation + (100 - dangerScore)) / 2, 45, 92);

      const second = rivalScores[0]?.boatNo ?? 2;
      const third = rivalScores.find((x) => x.boatNo !== second)?.boatNo ?? 3;
      const holeHead = outerBest?.boatNo ?? 5;
      const raceNo = validRaceNo(race.raceNo);
      if (!raceNo) continue;

      candidates.push({
        id: `fallback-${course.courseCode}-${raceNo}`,
        stadium_code: Number(course.courseCode),
        courseCode: Number(course.courseCode),
        courseName: course.courseName,
        race_no: raceNo,
        raceNo,
        closingTime: race.closingTime,
        closing_time: race.closingTime,
        inside_expectation: insideExpectation,
        hole_expectation: holeExpectation,
        danger_score: dangerScore,
        total_score: totalScore,
        diagnosis_code: "fallback",
        diagnosis_label: insideExpectation >= 72 ? "イン有力" : holeExpectation >= 67 ? "穴期待" : "データ注目",
        tickets: insideExpectation >= holeExpectation
          ? [`1-${second}-${third}`, `1-${third}-${second}`]
          : [`${holeHead}-1-${second}`, `${holeHead}-${second}-1`],
        isFallback: true,
      });
    }
  }

  return candidates;
}

function formatQuickDate(value) {
  try {
    return new Intl.DateTimeFormat("ja-JP", {
      timeZone: "Asia/Tokyo",
      month: "numeric",
      day: "numeric",
      weekday: "short",
    }).format(new Date(`${value}T00:00:00+09:00`));
  } catch {
    return String(value || "").slice(5).replace("-", "/");
  }
}

export const metadata = {
  title: "本日のボートレース出走表・レース情報",
  description: "本日開催されるボートレースの出走表、選手情報、モーター成績、展示情報、BoatStrikers独自分析を確認できます。",
};

export default async function RacesPage({ searchParams }) {
  const query = await searchParams;
  const raceDate = normalizeDate(query?.date);

  let courses = [];
  let dates = [];
  let newspapers = [];
  let hitFlash = [];
  let aiPickups = [];
  let loadError = null;

  try {
    [courses, dates, newspapers, hitFlash, aiPickups] = await Promise.all([
      getCoursesByDate(raceDate),
      getAvailableDates(),
      getPublishedNoteFeaturesByDate(raceDate, false),
      getAiBetHitFlashByDate(raceDate, 6),
      getAiPredictionPickupsByDate(raceDate),
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

  const raceMetaByKey = new Map();
  for (const course of courses) {
    for (const race of course.races ?? []) {
      const raceNo = validRaceNo(race.raceNo);
      if (!raceNo || race.resultAvailable) continue;
      if (raceDate === getJstDateString() && race.closingAt) {
        const closing = new Date(race.closingAt).getTime();
        if (Number.isFinite(closing) && closing <= Date.now()) continue;
      }
      const key = `${Number(course.courseCode)}:${raceNo}`;
      raceMetaByKey.set(key, {
        courseCode: Number(course.courseCode),
        courseName: course.courseName,
        raceNo,
        closingTime: race.closingTime,
      });
    }
  }

  const activeAiPickups = aiPickups
    .map((item) => {
      const raceNo = validRaceNo(item.race_no);
      if (!raceNo) return null;
      const key = `${Number(item.stadium_code)}:${raceNo}`;
      const meta = raceMetaByKey.get(key);
      return meta ? { ...item, ...meta } : null;
    })
    .filter(Boolean)
    .filter((item) => item.diagnosis_code !== "skip");

  const fallbackPickups = buildFallbackPickups(courses, raceDate);
  const pickupPool = activeAiPickups.length > 0 ? activeAiPickups : fallbackPickups;

  let insidePickups = pickupPool
    .filter((item) => ["イン鉄板", "イン有力"].includes(item.diagnosis_label) || Number(item.inside_expectation ?? 0) >= 70)
    .sort((a, b) => Number(b.inside_expectation ?? 0) - Number(a.inside_expectation ?? 0))
    .slice(0, 6);

  if (insidePickups.length === 0) {
    insidePickups = pickupPool
      .slice()
      .sort((a, b) => Number(b.inside_expectation ?? 0) - Number(a.inside_expectation ?? 0))
      .slice(0, 3);
  }

  const insideKeys = new Set(insidePickups.map((item) => `${item.courseCode}:${item.raceNo}`));
  let holePickups = pickupPool
    .filter((item) => ["穴期待", "5アタマ警戒"].includes(item.diagnosis_label) || Number(item.hole_expectation ?? 0) >= 65)
    .filter((item) => !insideKeys.has(`${item.courseCode}:${item.raceNo}`))
    .sort((a, b) => Number(b.hole_expectation ?? 0) - Number(a.hole_expectation ?? 0))
    .slice(0, 6);

  if (holePickups.length === 0) {
    holePickups = pickupPool
      .filter((item) => !insideKeys.has(`${item.courseCode}:${item.raceNo}`))
      .slice()
      .sort((a, b) => Number(b.hole_expectation ?? 0) - Number(a.hole_expectation ?? 0))
      .slice(0, 3);
  }

  return (
    <main className={`${styles.page} ${styles.portalPage}`}>
      <header className={styles.portalBannerHero}>
        <Image
          src="/races/7465ae1e-cbab-4271-836f-4d443777080d.png"
          alt="BoatStrikers 今日のレースをもっと分かりやすく。24場対応・展示データ・AI分析"
          width={1536}
          height={512}
          className={styles.portalBannerImage}
          priority
        />
      </header>

      <nav className={styles.portalQuickNav} aria-label="出走表トップメニュー">
        <a href="#race-dates">
          <span className={styles.portalQuickIcon} aria-hidden="true">📅</span>
          <span className={styles.portalQuickText}><small>日付</small><strong>{formatQuickDate(raceDate)}</strong></span>
        </a>
        <a href="#todays-courses">
          <span className={styles.portalQuickIcon} aria-hidden="true">🚤</span>
          <span className={styles.portalQuickText}><small>本日の開催場</small><strong>{courses.length}場</strong></span>
        </a>
        <a href="#daily-newspaper">
          <span className={styles.portalQuickIcon} aria-hidden="true">📰</span>
          <span className={styles.portalQuickText}><small>新聞</small><strong>{newspapers.length}件</strong></span>
        </a>
      </nav>

      <div className={styles.portalContent}>
        {dates.length > 0 && (
          <nav id="race-dates" className={`${styles.portalDateNav} ${styles.portalAnchorTarget}`} aria-label="開催日を選択">
            {dates.map((date) => (
              <Link
                key={date}
                href={`/races?date=${date}`}
                prefetch={false}
                className={`${styles.portalDateLink} ${date === raceDate ? styles.portalDateActive : ""}`}
              >
                {date.slice(5).replace("-", "/")}
              </Link>
            ))}
          </nav>
        )}

        <div className={styles.portalSection}>
          <Image src="/S__22142979.jpg" alt="只今、開発中" className={styles.developingBannerImage} />
        </div>

        <section id="daily-newspaper" className={`${styles.portalSection} ${styles.portalAnchorTarget}`}>
          <div className={styles.portalSectionHead}>
            <div><span>DAILY NEWSPAPER</span><h2>📰 今日公開の新聞</h2></div>
            <b>{newspapers.length}件公開</b>
          </div>

          {newspapers.length > 0 ? (
            <div className={styles.newspaperRail}>
              {newspapers.map((item) => {
                const raceNo = validRaceNo(item.race_no);
                if (!raceNo) return null;
                const code = String(item.course_code).padStart(2, "0");
                const raceHref = `/races/${code}/${raceNo}?date=${raceDate}`;
                const external = Boolean(item.note_url);
                return (
                  <article key={item.id ?? `${item.course_code}-${raceNo}-${item.sort_order}`} className={styles.newspaperCard}>
                    <div className={styles.newspaperTop}>
                      <span>{item.character_name || "BoatStrikers"}</span>
                      <b>{noteTimingLabel(item.target_timing)}</b>
                    </div>
                    <div className={styles.newspaperRace}>
                      <small>本日の注目レース</small>
                      <strong>{getCourseName(item.course_code)} {raceNo}R</strong>
                    </div>
                    <h3>{item.feature_title || "今日の予想新聞を公開中"}</h3>
                    <p>{item.teaser_text || "展開・評価・買い目の詳しい解説を公開しています。"}</p>
                    <div className={styles.newspaperActions}>
                      <Link prefetch={false} href={raceHref}>出走表を見る</Link>
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

        <section id="todays-courses" className={`${styles.portalSection} ${styles.portalAnchorTarget}`}>
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
                const noteCount = noteCountByCourse.get(numericCode) ?? 0;
                return (
                  <CoursePortalCard
                    key={numericCode}
                    course={course}
                    raceDate={raceDate}
                    noteCount={noteCount}
                  />
                );
              })}
            </div>
          )}
        </section>

        <section className={`${styles.portalSection} ${styles.aiPickupSection}`}>
          <div className={`${styles.aiPickupBanner} ${styles.aiPickupBannerInside}`}>
            <div><span>AI PICKUP</span><h2>🍎 イン逃げ鉄板レース</h2></div>
            <b>イン期待度 上位</b>
          </div>

          {insidePickups.length > 0 ? (
            <div className={styles.aiPickupRail}>
              {insidePickups.map((item, index) => {
                const raceNo = validRaceNo(item.raceNo);
                if (!raceNo) return null;
                const code = String(item.courseCode).padStart(2, "0");
                const tickets = pickupTickets(item.tickets);
                return (
                  <Link
                    key={`inside-${item.id ?? `${code}-${raceNo}`}`}
                    href={`/races/${code}/${raceNo}?date=${raceDate}`}
                    prefetch={false}
                    className={`${styles.aiPickupCard} ${styles.aiPickupCardInside}`}
                  >
                    <div className={styles.aiPickupRank}>#{index + 1}</div>
                    <div className={styles.aiPickupCardHead}>
                      <div><small>イン逃げ鉄板</small><strong>{item.courseName} {raceNo}R</strong></div>
                      <span>締切 {shortTime(item.closingTime)}</span>
                    </div>
                    <div className={styles.aiPickupScoreRow}>
                      <div><small>イン期待度</small><strong>{scoreText(item.inside_expectation)}</strong></div>
                      <div><small>AI総合</small><strong>{scoreText(item.total_score)}</strong></div>
                    </div>
                    <div className={styles.aiPickupMeter}><span style={{ width: `${Math.max(4, Math.min(100, Number(item.inside_expectation ?? 0)))}%` }} /></div>
                    <div className={styles.aiPickupBottom}>
                      <span>{item.diagnosis_label || "イン有力"}</span>
                      <b>{tickets.length ? tickets.join(" / ") : "予想を見る"}</b>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className={styles.aiPickupEmpty}>現在、締切前のイン逃げ鉄板候補はありません。</div>
          )}
        </section>

        <section className={`${styles.portalSection} ${styles.aiPickupSection}`}>
          <div className={`${styles.aiPickupBanner} ${styles.aiPickupBannerHole}`}>
            <div><span>AI PICKUP</span><h2>🔥 穴狙いレース</h2></div>
            <b>穴期待度 上位</b>
          </div>

          {holePickups.length > 0 ? (
            <div className={styles.aiPickupRail}>
              {holePickups.map((item, index) => {
                const raceNo = validRaceNo(item.raceNo);
                if (!raceNo) return null;
                const code = String(item.courseCode).padStart(2, "0");
                const tickets = pickupTickets(item.tickets);
                return (
                  <Link
                    key={`hole-${item.id ?? `${code}-${raceNo}`}`}
                    href={`/races/${code}/${raceNo}?date=${raceDate}`}
                    prefetch={false}
                    className={`${styles.aiPickupCard} ${styles.aiPickupCardHole}`}
                  >
                    <div className={styles.aiPickupRank}>#{index + 1}</div>
                    <div className={styles.aiPickupCardHead}>
                      <div><small>穴狙い</small><strong>{item.courseName} {raceNo}R</strong></div>
                      <span>締切 {shortTime(item.closingTime)}</span>
                    </div>
                    <div className={styles.aiPickupScoreRow}>
                      <div><small>穴期待度</small><strong>{scoreText(item.hole_expectation)}</strong></div>
                      <div><small>波乱警戒</small><strong>{scoreText(item.danger_score)}</strong></div>
                    </div>
                    <div className={styles.aiPickupMeter}><span style={{ width: `${Math.max(4, Math.min(100, Number(item.hole_expectation ?? 0)))}%` }} /></div>
                    <div className={styles.aiPickupBottom}>
                      <span>{item.diagnosis_label || "穴期待"}</span>
                      <b>{tickets.length ? tickets.join(" / ") : "予想を見る"}</b>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className={styles.aiPickupEmpty}>現在、締切前の穴狙い候補はありません。</div>
          )}
        </section>

        <section className={styles.portalSection}>
          <div className={styles.portalSectionHead}>
            <div><span>HIT FLASH</span><h2>🎯 的中速報</h2></div>
            <Link prefetch={false} href="/ai-results">成績を見る →</Link>
          </div>

          {hitFlash.length > 0 ? (
            <div className={styles.hitFlashList}>
              {hitFlash.map((item) => {
                const raceNo = validRaceNo(item.race_no);
                if (!raceNo) return null;
                const code = String(item.course_code).padStart(2, "0");
                return (
                  <Link
                    key={item.id ?? `${item.course_code}-${raceNo}-${item.mode_key}`}
                    href={`/races/${code}/${raceNo}?date=${raceDate}`}
                    prefetch={false}
                    className={styles.hitFlashCard}
                  >
                    <div className={styles.hitFlashIcon}>的中</div>
                    <div className={styles.hitFlashMain}>
                      <span>{item.mode_name || "AI予想"}</span>
                      <strong>{getCourseName(item.course_code)} {raceNo}R</strong>
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

        <RealtimeUpdates target="races" limit={5} />
      </div>
    </main>
  );
}
