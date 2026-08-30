import Link from "next/link";
import styles from "./HatsuneSchedulePreview.module.css";
import {
  formatScheduleRange,
  getScheduleStatus,
  getUpcomingWomenSchedule,
} from "./scheduleData";

const TYPE_CLASS = {
  "オールレディース": styles.allLadies,
  "ヴィーナスシリーズ": styles.venus,
};

export default function HatsuneSchedulePreview() {
  const items = getUpcomingWomenSchedule(3);

  return (
    <section className={styles.section}>
      <div className={styles.heading}>
        <div>
          <span>WOMEN'S RACE SCHEDULE</span>
          <h2>🌸 女子戦スケジュール</h2>
          <p>開催中と、これから始まる女子戦をまとめています。</p>
        </div>
        <Link href="/hatsune/schedule" className={styles.moreTop}>一覧を見る →</Link>
      </div>

      <div className={styles.list}>
        {items.map((item) => {
          const status = getScheduleStatus(item);
          return (
            <article key={item.id} className={`${styles.item} ${status === "running" ? styles.running : ""}`}>
              <div className={styles.dateBox}>
                <strong>{formatScheduleRange(item)}</strong>
                {status === "running" ? <span>開催中</span> : <span>予定</span>}
              </div>
              <div className={styles.body}>
                <div className={styles.badges}>
                  <span className={TYPE_CLASS[item.type] || styles.other}>{item.type}</span>
                  <b>{item.place}</b>
                </div>
                <h3>{item.title}</h3>
              </div>
            </article>
          );
        })}
      </div>

      <Link href="/hatsune/schedule" className={styles.moreBottom}>女子戦スケジュールをもっと見る →</Link>
    </section>
  );
}
