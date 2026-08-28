import Link from "next/link";
import { loadStatus, formatJst, countText } from "../../../lib/adminDashboardStatus";
import styles from "../adminHome.module.css";

export default async function NotificationCenter() {
 const status = await loadStatus();
 return (
        <section className={styles.notificationCenter} id="notifications">
          <div className={styles.panelHeading}>
            <div><span>LINE ALERT CENTER</span><h2>LINE通知センター</h2></div>
            <Link href="/members" className={styles.miniLink}>会員側を見る →</Link>
          </div>
          <div className={styles.theoryGrid}>
            {(status.theories || []).map((theory) => (
              <Link href={theory.href} className={styles.theoryCard} key={theory.key}>
                <div className={styles.theoryHead}><b>{theory.icon}</b><div><strong>{theory.name}</strong><small>詳細・成績を見る</small></div><i>›</i></div>
                <div className={styles.theoryStats}>
                  <span><small>今日成立</small><strong>{countText(theory.today)}</strong></span>
                  <span><small>通知済</small><strong>{countText(theory.notified)}</strong></span>
                  <span><small>直近30日</small><strong>{countText(theory.last30)}</strong></span>
                </div>
              </Link>
            ))}
          </div>
          <div className={styles.recentWrap}>
            <div className={styles.recentTitle}><strong>直近の成立・通知</strong><small>最新5件</small></div>
            {status.recentAlerts?.length ? (
              <div className={styles.recentList}>
                {status.recentAlerts.map((row, index) => (
                  <Link href={row.href} className={styles.recentItem} key={`${row.theoryKey}-${row.race_date}-${row.course_code}-${row.race_no}-${index}`}>
                    <b>{row.icon}</b>
                    <span><strong>{row.course_name || `場コード${row.course_code}`} {row.race_no}R</strong><small>{row.theoryName} ・ {formatJst(row.detected_at)}</small></span>
                    <em className={row.notified ? styles.sent : styles.pending}>{row.notified ? "通知済" : "未通知"}</em>
                  </Link>
                ))}
              </div>
            ) : <div className={styles.emptyRecent}>まだ表示できる成立履歴がありません。</div>}
          </div>
        </section>


 );
}

