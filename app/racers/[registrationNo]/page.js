import "server-only";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import styles from "./racer.module.css";

export const dynamic = "force-dynamic";

const COURSE_NAMES = {
  1: "桐生", 2: "戸田", 3: "江戸川", 4: "平和島", 5: "多摩川", 6: "浜名湖",
  7: "蒲郡", 8: "常滑", 9: "津", 10: "三国", 11: "びわこ", 12: "住之江",
  13: "尼崎", 14: "鳴門", 15: "丸亀", 16: "児島", 17: "宮島", 18: "徳山",
  19: "下関", 20: "若松", 21: "芦屋", 22: "福岡", 23: "唐津", 24: "大村",
};

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} が設定されていません。`);
  return value;
}

function getSupabase() {
  return createClient(requiredEnv("NEXT_PUBLIC_SUPABASE_URL"), requiredEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

function getJstDateString() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

function normalizeRegistration(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits || digits.length > 5) return null;
  return digits.padStart(5, "0");
}

function n(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function pct(value, digits = 1) {
  return value == null ? "--" : `${Number(value).toFixed(digits)}%`;
}

function safeFinish(row) {
  const arrival = n(row.arrival_order);
  if (arrival && arrival >= 1 && arrival <= 6) return arrival;
  const match = String(row.finish_place ?? "").match(/[1-6]/);
  return match ? Number(match[0]) : null;
}

function buildStats(rows) {
  const completed = rows.filter((row) => safeFinish(row));
  const total = completed.length;
  const wins = completed.filter((row) => safeFinish(row) === 1).length;
  const top2 = completed.filter((row) => safeFinish(row) <= 2).length;
  const top3 = completed.filter((row) => safeFinish(row) <= 3).length;

  const courses = [1, 2, 3, 4, 5, 6].map((course) => {
    const group = completed.filter((row) => n(row.actual_course) === course);
    const starts = group.length;
    const cWins = group.filter((row) => safeFinish(row) === 1).length;
    const cTop2 = group.filter((row) => safeFinish(row) <= 2).length;
    const cTop3 = group.filter((row) => safeFinish(row) <= 3).length;
    return {
      course,
      starts,
      wins: cWins,
      winRate: starts ? (cWins / starts) * 100 : null,
      top2Rate: starts ? (cTop2 / starts) * 100 : null,
      top3Rate: starts ? (cTop3 / starts) * 100 : null,
    };
  });

  return {
    starts: rows.length,
    completed: total,
    wins,
    winRate: total ? (wins / total) * 100 : null,
    top2Rate: total ? (top2 / total) * 100 : null,
    top3Rate: total ? (top3 / total) * 100 : null,
    courses,
  };
}

function buildTags(stats, latest) {
  const c1 = stats.courses[0];
  const c2 = stats.courses[1];
  const c3 = stats.courses[2];
  const tags = [];
  if ((c1.winRate ?? 0) >= 70 && c1.starts >= 10) tags.push({ label: "イン信頼型", tone: "green" });
  if ((c2.top2Rate ?? 0) >= 55 && c2.starts >= 10) tags.push({ label: "2コース連対型", tone: "cyan" });
  if ((c3.top3Rate ?? 0) >= 65 && c3.starts >= 10) tags.push({ label: "3コース残り型", tone: "blue" });
  const avgSt = n(latest?.average_st);
  if (avgSt != null && avgSt <= 0.15) tags.push({ label: "ST安定", tone: "gold" });
  return tags.slice(0, 4);
}

function buildInsights(stats) {
  const c = stats.courses;
  const strengths = [];
  const cautions = [];
  if ((c[0].winRate ?? 0) >= 70) strengths.push(`1コース1着率 ${pct(c[0].winRate)}`);
  if ((c[1].top2Rate ?? 0) >= 50) strengths.push(`2コース2連対率 ${pct(c[1].top2Rate)}`);
  if ((c[2].top3Rate ?? 0) >= 60) strengths.push(`3コース3連対率 ${pct(c[2].top3Rate)}`);
  const outerBest = c.slice(3).filter((x) => x.winRate != null).sort((a, b) => b.winRate - a.winRate)[0];
  if (outerBest && outerBest.winRate >= 12) strengths.push(`${outerBest.course}コースでも1着率 ${pct(outerBest.winRate)}`);
  if ((c[5].winRate ?? 100) < 8) cautions.push(`6コース1着率は ${pct(c[5].winRate)}`);
  if ((c[4].top2Rate ?? 100) < 40) cautions.push(`5コース2連対率は ${pct(c[4].top2Rate)}`);
  if ((c[5].top2Rate ?? 100) < 25) cautions.push(`6コース2連対率は ${pct(c[5].top2Rate)}`);
  return { strengths: strengths.slice(0, 4), cautions: cautions.slice(0, 4) };
}

function latestTimestamp(values) {
  const times = values
    .filter(Boolean)
    .map((value) => new Date(value).getTime())
    .filter(Number.isFinite);
  return times.length ? new Date(Math.max(...times)).toISOString() : null;
}

function formatUpdatedAt(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

async function loadRacer(registrationNo) {
  const supabase = getSupabase();
  const today = getJstDateString();

  const [{ data: racer, error: racerError }, { data: rows, error: rowsError }, { data: todayRows, error: todayError }] = await Promise.all([
    supabase.from("bs_racers").select("registration_no,official_registration_no,name,name_kana,birthday,branch,birthplace,gender,racer_class,registration_term,height_cm,weight_kg,blood_type,is_active").eq("registration_no", registrationNo).maybeSingle(),
    supabase.from("bs_race_entries").select("race_date,course_code,race_no,boat_no,actual_course,arrival_order,finish_place,average_st,national_win_rate,local_win_rate").eq("racer_registration_no", registrationNo).order("race_date", { ascending: false }).limit(1000),
    supabase.from("bs_race_entries").select("race_date,course_code,race_no,boat_no,racer_name,average_st,national_win_rate,local_win_rate,updated_at,synced_at").eq("racer_registration_no", registrationNo).eq("race_date", today).order("race_no", { ascending: true }),
  ]);

  if (racerError) throw racerError;
  if (rowsError) throw rowsError;
  if (todayError) throw todayError;
  if (!racer) return null;

  const eventKeys = (todayRows ?? []).map((row) => `and(course_code.eq.${row.course_code},race_no.eq.${row.race_no})`);
  let eventMap = new Map();
  let events = [];
  if (eventKeys.length) {
    const { data: eventRows, error: eventsError } = await supabase
      .from("bs_race_events")
      .select("course_code,race_no,course_name,race_name,closing_time,deadline_time,race_status,result_available,updated_at,synced_at")
      .eq("race_date", today)
      .or(eventKeys.join(","));
    if (eventsError) throw eventsError;
    events = eventRows ?? [];
    eventMap = new Map(events.map((event) => [`${event.course_code}:${event.race_no}`, event]));
  }

  const stats = buildStats(rows ?? []);
  const latest = (todayRows ?? [])[0] ?? (rows ?? [])[0] ?? null;
  const races = (todayRows ?? []).map((row) => {
    const event = eventMap.get(`${row.course_code}:${row.race_no}`);
    return {
      ...row,
      courseName: event?.course_name || COURSE_NAMES[row.course_code] || `${row.course_code}場`,
      raceName: event?.race_name || null,
      closingTime: event?.closing_time || event?.deadline_time || null,
      status: event?.race_status || "scheduled",
      resultAvailable: Boolean(event?.result_available),
    };
  });

  const dataUpdatedAt = latestTimestamp([
    ...(todayRows ?? []).flatMap((row) => [row.updated_at, row.synced_at]),
    ...events.flatMap((event) => [event.updated_at, event.synced_at]),
  ]);

  return {
    racer,
    stats,
    latest,
    races,
    tags: buildTags(stats, latest),
    insights: buildInsights(stats),
    today,
    dataUpdatedAt,
  };
}

function boatClass(boatNo) {
  return styles[`boat${Number(boatNo)}`] || "";
}

function shortTime(value) {
  const match = String(value ?? "").match(/^(\d{1,2}):(\d{2})/);
  return match ? `${String(match[1]).padStart(2, "0")}:${match[2]}` : null;
}

function CharacterCard({ character, title, children }) {
  return (
    <article className={`${styles.characterCard} ${styles[character]}`}>
      <div className={styles.characterBadge}>{character === "ichika" ? "一果" : character === "hatsune" ? "初音" : "キイナ"}</div>
      <div><strong>{title}</strong><p>{children}</p></div>
    </article>
  );
}

export async function generateMetadata({ params }) {
  const { registrationNo: raw } = await params;
  const registrationNo = normalizeRegistration(raw);
  if (!registrationNo) return { title: "選手攻略FILE" };
  try {
    const data = await loadRacer(registrationNo);
    if (!data) return { title: "選手攻略FILE" };
    return {
      title: `${data.racer.name} 選手攻略FILE`,
      description: `${data.racer.name}選手のコース別成績、今日の出走、BoatStrikers独自の攻略ポイントをデータで紹介します。`,
    };
  } catch {
    return { title: "選手攻略FILE" };
  }
}

export default async function RacerGuidePage({ params }) {
  const { registrationNo: raw } = await params;
  const registrationNo = normalizeRegistration(raw);
  if (!registrationNo) notFound();

  const data = await loadRacer(registrationNo);
  if (!data) notFound();
  const { racer, stats, latest, races, tags, insights, today, dataUpdatedAt } = data;
  const c1 = stats.courses[0];
  const displayRegistration = String(racer.registration_no || registrationNo).replace(/^0+/, "") || registrationNo;
  const latestAverageSt = n(latest?.average_st);
  const latestNational = n(latest?.national_win_rate);
  const latestLocal = n(latest?.local_win_rate);
  const updatedLabel = formatUpdatedAt(dataUpdatedAt);

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroGlow} aria-hidden="true" />
        <div className={styles.heroInner}>
          <div className={styles.fileLabel}>選手攻略FILE <span>RACER FILE</span></div>
          <p className={styles.kicker}>BOATSTRIKERS DATA GUIDE</p>
          <h1>{racer.name}</h1>
          {racer.name_kana ? <p className={styles.kana}>{racer.name_kana}</p> : null}
          <div className={styles.identityRow}>
            <span>登録 {displayRegistration}</span>
            <span className={styles.classBadge}>{racer.racer_class || "--"}</span>
            <span>{racer.branch ? `${racer.branch}支部` : "支部 --"}</span>
            {racer.registration_term ? <span>{racer.registration_term}期</span> : null}
          </div>
          <div className={styles.heroStatement}>
            <strong>{(c1.winRate ?? 0) >= 70 ? "インの信頼度が高い" : "コース別データで特徴を読む"}</strong>
            <span>実進入コースの結果から、買いどころと注意点をチェック。</span>
          </div>
          <div className={styles.tagRow}>
            {tags.length ? tags.map((tag) => <span key={tag.label} data-tone={tag.tone}>{tag.label}</span>) : <span>データ蓄積中</span>}
          </div>
        </div>
      </section>

      <div className={styles.content}>
        <section className={styles.todaySection}>
          <div className={styles.sectionHeading}>
            <div><span>TODAY'S RACE</span><h2>本日の出走</h2></div>
            <div style={{ textAlign: "right" }}>
              <time dateTime={today}>{today.replaceAll("-", ".")}</time>
              {updatedLabel ? (
                <div style={{ marginTop: 5, fontSize: 10, color: "#76d8ff", fontWeight: 800 }}>
                  データ更新 {updatedLabel}
                </div>
              ) : null}
            </div>
          </div>
          {races.length ? (
            <>
              <div style={{ padding: "10px 16px 0", fontSize: 11, color: "#8fc5dd", fontWeight: 800 }}>
                ← 横にスワイプして出走を確認 →
              </div>
              <div
                className={styles.raceGrid}
                style={{
                  display: "flex",
                  overflowX: "auto",
                  scrollSnapType: "x mandatory",
                  WebkitOverflowScrolling: "touch",
                  scrollbarWidth: "thin",
                  paddingBottom: 18,
                }}
              >
                {races.map((race) => (
                  <article
                    className={styles.raceCard}
                    key={`${race.course_code}-${race.race_no}`}
                    style={{
                      flex: "0 0 min(82vw, 320px)",
                      minWidth: 0,
                      scrollSnapAlign: "start",
                    }}
                  >
                    <div className={styles.raceTop}>
                      <div><strong>{race.courseName} {race.race_no}R</strong>{race.raceName ? <small>{race.raceName}</small> : null}</div>
                      <span className={`${styles.boatBadge} ${boatClass(race.boat_no)}`}>{race.boat_no}</span>
                    </div>
                    <div className={styles.raceMeta}>
                      <span>{race.boat_no}号艇</span>
                      {shortTime(race.closingTime) ? <span>締切 {shortTime(race.closingTime)}</span> : <span>{race.resultAvailable ? "結果確定" : "出走予定"}</span>}
                    </div>
                    <Link href={`/races/${Number(race.course_code)}/${Number(race.race_no)}?date=${today}`} prefetch={false} className={styles.raceLink}>レースを見る <span>›</span></Link>
                  </article>
                ))}
                {races.some((race) => Number(race.boat_no) === 1) ? (
                  <aside
                    className={styles.ichikaNote}
                    style={{
                      flex: "0 0 min(76vw, 300px)",
                      minWidth: 0,
                      scrollSnapAlign: "start",
                    }}
                  >
                    <b>一果の注目</b><strong>今日は1号艇の出走あり</strong><p>この選手のイン成績と合わせてチェック。</p>
                  </aside>
                ) : null}
              </div>
            </>
          ) : <div className={styles.emptyRace}>本日の出走はありません。</div>}
        </section>

        <section className={styles.quickSection}>
          <div className={styles.sectionHeading}><div><span>QUICK DATA</span><h2>3秒でわかる{racer.name}</h2></div></div>
          <div className={styles.metricGrid}>
            <article className={`${styles.metricCard} ${styles.redMetric}`}><span>1コース1着率</span><strong>{pct(c1.winRate)}</strong><small>{c1.starts ? `${c1.starts}走 ${c1.wins}勝` : "データなし"}</small></article>
            <article className={`${styles.metricCard} ${styles.blueMetric}`}><span>2連対率</span><strong>{pct(stats.top2Rate)}</strong><small>{stats.completed ? `${stats.completed}走集計` : "データなし"}</small></article>
            <article className={`${styles.metricCard} ${styles.greenMetric}`}><span>3連対率</span><strong>{pct(stats.top3Rate)}</strong><small>{stats.completed ? `${stats.completed}走集計` : "データなし"}</small></article>
            <article className={`${styles.metricCard} ${styles.goldMetric}`}><span>平均ST</span><strong>{latestAverageSt == null ? "--" : latestAverageSt.toFixed(2)}</strong><small>最新出走表データ</small></article>
          </div>
        </section>

        <section className={styles.courseSection}>
          <div className={styles.sectionHeading}><div><span>COURSE DATA</span><h2>コース別成績 <small>（実進入コース）</small></h2></div></div>
          <div className={styles.courseTableWrap}>
            <div className={styles.courseTable} role="table" aria-label="コース別成績">
              <div className={`${styles.courseRow} ${styles.courseHeader}`} role="row"><span>コース</span><span>1着率</span><span>2連対率</span><span>3連対率</span><span className={styles.graphHead}>傾向</span></div>
              {stats.courses.map((item) => (
                <div className={styles.courseRow} role="row" key={item.course}>
                  <span className={`${styles.courseNumber} ${boatClass(item.course)}`}>{item.course}</span>
                  <strong>{pct(item.winRate)}</strong><span>{pct(item.top2Rate)}</span><span>{pct(item.top3Rate)}</span>
                  <div className={styles.barTrack} title={`1着率 ${pct(item.winRate)}`}><i style={{ width: `${Math.min(100, item.winRate ?? 0)}%` }} /></div>
                </div>
              ))}
            </div>
          </div>
          <p className={styles.dataNote}>※ BoatStrikers保有データのうち、着順と実進入コースを確認できるレースを集計しています。</p>
        </section>

        <section className={styles.analysisSection}>
          <div className={styles.sectionHeading}><div><span>BOATSTRIKERS VIEW</span><h2>BoatStrikersの視点</h2></div></div>
          <div className={styles.characterGrid}>
            <CharacterCard character="ichika" title="一果の分析">{c1.starts ? `1コースは${c1.starts}走で1着率${pct(c1.winRate)}。イン戦では最初に確認したいデータです。` : "イン戦データを蓄積中です。"}</CharacterCard>
            {String(racer.gender || "").includes("女") ? <CharacterCard character="hatsune" title="初音の分析">女子戦での出走時は、コース別成績と当地成績を合わせて確認。</CharacterCard> : null}
            <CharacterCard character="kiina" title="キイナの分析">{stats.courses.slice(3).some((x) => (x.winRate ?? 0) >= 12) ? `外枠でも1着率が残るコースがあります。4〜6コースの数字も穴目線でチェック。` : "外枠時は内枠時との成績差を見ながら慎重にチェック。"}</CharacterCard>
          </div>
        </section>

        <section className={styles.conditionGrid}>
          <article className={styles.strengthCard}><h2>狙いたい条件 <small>強み</small></h2>{insights.strengths.length ? <ul>{insights.strengths.map((item) => <li key={item}>{item}</li>)}</ul> : <p>条件別データを蓄積中です。</p>}</article>
          <article className={styles.cautionCard}><h2>注意したい条件 <small>弱み</small></h2>{insights.cautions.length ? <ul>{insights.cautions.map((item) => <li key={item}>{item}</li>)}</ul> : <p>明確な注意条件は現在の集計では未抽出です。</p>}</article>
        </section>

        <section className={styles.profileGrid}>
          <article className={styles.detailCard}><h2>基本プロフィール</h2><dl><div><dt>登録番号</dt><dd>{displayRegistration}</dd></div><div><dt>級別</dt><dd>{racer.racer_class || "--"}</dd></div><div><dt>支部</dt><dd>{racer.branch || "--"}</dd></div><div><dt>出身地</dt><dd>{racer.birthplace || "--"}</dd></div><div><dt>生年月日</dt><dd>{racer.birthday || "--"}</dd></div><div><dt>登録期</dt><dd>{racer.registration_term ? `${racer.registration_term}期` : "--"}</dd></div><div><dt>身長</dt><dd>{racer.height_cm ? `${racer.height_cm}cm` : "--"}</dd></div><div><dt>体重</dt><dd>{racer.weight_kg ? `${racer.weight_kg}kg` : "--"}</dd></div></dl></article>
          <article className={styles.detailCard}><h2>最新データ</h2><dl><div><dt>全国勝率</dt><dd>{latestNational == null ? "--" : latestNational.toFixed(2)}</dd></div><div><dt>当地勝率</dt><dd>{latestLocal == null ? "--" : latestLocal.toFixed(2)}</dd></div><div><dt>平均ST</dt><dd>{latestAverageSt == null ? "--" : latestAverageSt.toFixed(2)}</dd></div><div><dt>集計完走数</dt><dd>{stats.completed}走</dd></div><div><dt>1着</dt><dd>{stats.wins}回</dd></div><div><dt>1着率</dt><dd>{pct(stats.winRate)}</dd></div>{updatedLabel ? <div><dt>データ更新</dt><dd>{updatedLabel}</dd></div> : null}</dl></article>
        </section>

        <section className={styles.relatedSection}>
          <div className={styles.sectionHeading}><div><span>RELATED</span><h2>関連コンテンツ</h2></div></div>
          <div className={styles.relatedGrid}>
            <Link href="/races" prefetch={false}><b>今日の出走表</b><span>全開催場を見る ›</span></Link>
            <Link href="/today" prefetch={false}><b>BoatStrikers TODAY</b><span>今日の情報を見る ›</span></Link>
            <Link href="/library" prefetch={false}><b>攻略ライブラリ</b><span>研究書を読む ›</span></Link>
          </div>
        </section>
      </div>
    </main>
  );
}
