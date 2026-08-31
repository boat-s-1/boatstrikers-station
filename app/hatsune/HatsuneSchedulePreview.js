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
      <div className={styles.bannerHeading}>
        <img
          src="/top/IMG_7836.jpeg?v=20260831-2142"
          alt="女子戦スケジュール"
          className={styles.bannerImage}
        />
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
