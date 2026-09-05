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

async function getAlertFlashRows() {
  const supabase = getSupabase();
  if (!supabase) return [];

  const today = jstDateString();

  const [ichikaResult, kiinaResult] = await Promise.all([
    supabase
      .from("bs_ichika_hidden_escape_alerts")
      .select("id,race_date,course_code,course_name,race_no,closing_time,detected_at")
      .eq("race_date", today)
      .order("detected_at", { ascending: false })
      .limit(8),
    supabase
      .from("bs_exhibition_alerts")
      .select("id,race_date,course_code,course_name,race_no,closing_time,exhibition_rank,straight_rank")
      .eq("race_date", today)
      .order("closing_time", { ascending: false })
      .limit(8),
  ]);

  const ichika = (ichikaResult.data || []).map((row) => ({
    ...row,
    key: `ichika-${row.id}`,
    alertLabel: "一果イン逃げアラート",
    character: "一果",
    detail: "条件成立",
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
      detail: `展示${row.exhibition_rank ?? "—"}位＋直線${row.straight_rank ?? "—"}位`,
      sortValue: `${row.race_date}T${row.closing_time || "00:00"}:00+09:00`,
    }));

  return [...ichika, ...kiina]
    .sort((a, b) => new Date(b.sortValue).getTime() - new Date(a.sortValue).getTime())
    .slice(0, 6);
}

export default async function AlertFlash() {
  const alerts = await getAlertFlashRows();

  return (
    <section className={styles.portalSection}>
      <div className={styles.portalSectionHead}>
        <div><span>ALERT FLASH</span><h2>🚨 アラート速報</h2></div>
        <b>{alerts.length}件</b>
      </div>

      {alerts.length ? (
        <div className={styles.hitFlashList}>
          {alerts.map((item) => {
            const code = String(item.course_code ?? "").padStart(2, "0");
            const raceNo = Number(item.race_no);
            return (
              <Link
                key={item.key}
                className={styles.hitFlashCard}
                href={`/races/${code}/${raceNo}?date=${item.race_date}`}
              >
                <div className={styles.hitFlashIcon}>速報</div>
                <div className={styles.hitFlashMain}>
                  <span>{item.character}｜{item.alertLabel}</span>
                  <strong>{item.course_name || `${Number(item.course_code)}場`} {raceNo}R</strong>
                  <small>{item.detail}</small>
                </div>
                <div className={styles.hitFlashMoney}>
                  <small>締切</small>
                  <strong>{shortTime(item.closing_time)}</strong>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className={styles.portalEmpty}>
          <span>🚨</span>
          <strong>現在、成立中のアラートはありません</strong>
          <p>条件成立後、ここに自動で表示されます。</p>
        </div>
      )}
    </section>
  );
}
