import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import styles from "../phase2.module.css";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function jstDateString() {
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return now.toISOString().slice(0, 10);
}

function shortTime(value) {
  const match = String(value ?? "").match(/(\d{1,2}):(\d{2})/);
  if (!match) return "--:--";
  return `${String(match[1]).padStart(2, "0")}:${match[2]}`;
}

function raceKey(row) {
  return `${Number(row.course_code)}:${Number(row.race_no)}`;
}

async function getAlertFlashRows() {
  const supabase = getSupabase();
  if (!supabase) return [];

  const today = jstDateString();

  const [ichikaResult, kiinaResult, hatsuneResult] = await Promise.all([
    supabase
      .from("bs_ichika_hidden_escape_alerts")
      .select("id,race_date,course_code,course_name,race_no,closing_time,detected_at")
      .eq("race_date", today)
      .order("detected_at", { ascending: false })
      .limit(8),
    supabase
      .from("bs_exhibition_alerts")
      .select("id,race_date,course_code,course_name,race_no,closing_time,exhibition_rank,straight_rank,detected_at")
      .eq("race_date", today)
      .order("detected_at", { ascending: false })
      .limit(8),
    supabase
      .from("bs_hatsune_box_alerts")
      .select("id,race_date,course_code,course_name,race_no,closing_time,box_234_rating,box_235_rating,box_345_rating,detected_at")
      .eq("race_date", today)
      .order("detected_at", { ascending: false })
      .limit(8),
  ]);

  const ichika = (ichikaResult.data || []).map((row) => ({
    ...row,
    key: `ichika-${row.id}`,
    alertLabel: "隠れイン理論",
    character: "一果",
    characterMark: "🍎",
    detail: "イン逃げ条件成立",
    sortValue: row.detected_at || `${row.race_date}T${row.closing_time || "00:00"}:00+09:00`,
  }));

  const kiina = (kiinaResult.data || [])
    .filter((row) => {
      const ex = Number(row.exhibition_rank);
      const straight = Number(row.straight_rank);
      return (ex === 1 && straight === 1) || (ex === 1 && straight === 2) || (ex === 2 && straight === 1);
    })
    .map((row) => ({
      ...row,
      key: `kiina-${row.id}`,
      alertLabel: "カド攻め理論",
      character: "キイナ",
      characterMark: "💛",
      detail: `展示${row.exhibition_rank ?? "—"}位 × 直線${row.straight_rank ?? "—"}位`,
      sortValue: row.detected_at || `${row.race_date}T${row.closing_time || "00:00"}:00+09:00`,
    }));

  const hatsune = (hatsuneResult.data || [])
    .filter((row) => [row.box_234_rating, row.box_235_rating, row.box_345_rating].some((v) => ["◎", "○"].includes(String(v))))
    .map((row) => {
      const boxes = [
        ["234", row.box_234_rating],
        ["235", row.box_235_rating],
        ["345", row.box_345_rating],
      ].filter(([, rating]) => ["◎", "○"].includes(String(rating)));
      return {
        ...row,
        key: `hatsune-${row.id}`,
        alertLabel: "女子イン崩れ理論",
        character: "初音",
        characterMark: "🔮",
        detail: boxes.map(([box, rating]) => `${rating}${box}BOX`).join(" / "),
        sortValue: row.detected_at || `${row.race_date}T${row.closing_time || "00:00"}:00+09:00`,
      };
    });

  return [...ichika, ...hatsune, ...kiina]
    .sort((a, b) => new Date(b.sortValue).getTime() - new Date(a.sortValue).getTime())
    .slice(0, 9);
}

function AlertCard({ item, matched = false }) {
  const code = String(item.course_code ?? "").padStart(2, "0");
  const raceNo = Number(item.race_no);
  return (
    <Link
      key={item.key}
      className={styles.hitFlashCard}
      href={`/races/${code}/${raceNo}?date=${item.race_date}`}
      style={matched ? { border: "2px solid #f4b400", background: "linear-gradient(135deg,#fff9dd,#fff)" } : undefined}
    >
      <div className={styles.hitFlashIcon}>{matched ? "W" : item.characterMark}</div>
      <div className={styles.hitFlashMain}>
        <span>{matched ? "AI × 理論 Wヒット" : `${item.character}｜${item.alertLabel}`}</span>
        <strong>{item.course_name || `${Number(item.course_code)}場`} {raceNo}R</strong>
        <small>{item.detail}</small>
      </div>
      <div className={styles.hitFlashMoney}>
        <small>締切</small>
        <strong>{shortTime(item.closing_time)}</strong>
      </div>
    </Link>
  );
}

export default async function AlertFlash({ aiRaceKeys = [] }) {
  const alerts = await getAlertFlashRows();
  const aiSet = new Set(Array.isArray(aiRaceKeys) ? aiRaceKeys : []);
  const matched = alerts.filter((item) => aiSet.has(raceKey(item)));

  return (
    <>
      <section id="theory-alerts" className={`${styles.portalSection} ${styles.portalAnchorTarget}`}>
        <div className={styles.portalSectionHead}>
          <div><span>THEORY ALERT</span><h2>🚨 今日の理論アラート</h2></div>
          <b>{alerts.length}件</b>
        </div>

        {alerts.length ? (
          <div className={styles.hitFlashList}>
            {alerts.map((item) => <AlertCard key={item.key} item={item} />)}
          </div>
        ) : (
          <div className={styles.portalEmpty}>
            <span>🚨</span>
            <strong>現在、成立中の理論アラートはありません</strong>
            <p>一果・初音・キイナの理論条件が成立すると、ここに自動で表示されます。</p>
          </div>
        )}
      </section>

      <section id="ai-theory-match" className={`${styles.portalSection} ${styles.portalAnchorTarget}`}>
        <div className={styles.portalSectionHead}>
          <div><span>DOUBLE SIGNAL</span><h2>✨ AI × 理論一致レース</h2></div>
          <b>{matched.length}件</b>
        </div>

        {matched.length ? (
          <div className={styles.hitFlashList}>
            {matched.map((item) => <AlertCard key={`match-${item.key}`} item={item} matched />)}
          </div>
        ) : (
          <div className={styles.portalEmpty}>
            <span>✨</span>
            <strong>現在、AIと理論の一致レースはありません</strong>
            <p>AI注目レースと理論アラートが同じレースで重なると、ここにWヒットとして表示します。</p>
          </div>
        )}
      </section>
    </>
  );
}
