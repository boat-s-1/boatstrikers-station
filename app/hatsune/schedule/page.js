import Link from "next/link";
import styles from "./page.module.css";
import {
  HATSUNE_SCHEDULE_SOURCE,
  HATSUNE_WOMEN_SCHEDULE,
  formatScheduleRange,
  getScheduleStatus,
} from "../scheduleData";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "女子戦スケジュール | 初音 | BoatStrikers",
  description: "オールレディース、ヴィーナスシリーズなど女子ボートレースの開催予定を見やすくまとめています。",
};

const MONTHS = [8, 9, 10, 11];

function monthOf(item) {
  return Number(item.start.slice(5, 7));
}

export default async function HatsuneSchedulePage({ searchParams }) {
  const params = await searchParams;
  const requested = Number(params?.month || 9);
  const month = MONTHS.includes(requested) ? requested : 9;
  const items = HATSUNE_WOMEN_SCHEDULE.filter((item) => monthOf(item) === month);

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.topLinks}>
          <Link href="/hatsune">← 初音TOP</Link>
          <Link href="/hatsune/news">初音NEWS</Link>
        </div>

        <header className={styles.header}>
          <span>HATSUNE / WOMEN'S RACE</span>
          <h1>🌸 女子戦スケジュール</h1>
          <p>オールレディース・ヴィーナスシリーズを中心に、今後の女子戦を一覧で確認できます。</p>
        </header>

        <nav className={styles.tabs} aria-label="月を選択">
          {MONTHS.map((value) => (
            <Link key={value} href={`/hatsune/schedule?month=${value}`} className={value === month ? styles.active : ""}>
              {value}月
            </Link>
          ))}
        </nav>

        <section className={styles.list}>
          {items.length ? items.map((item) => {
            const status = getScheduleStatus(item);
            return (
              <article key={item.id} className={`${styles.card} ${status === "running" ? styles.running : ""}`}>
                <div className={styles.date}>
                  <strong>{formatScheduleRange(item)}</strong>
                  <span className={status === "running" ? styles.live : styles.planned}>
                    {status === "running" ? "開催中" : status === "finished" ? "終了" : "開催予定"}
                  </span>
                </div>
                <div className={styles.main}>
                  <div className={styles.badges}>
                    <span>{item.type}</span>
                    <b>{item.place}</b>
                  </div>
                  <h2>{item.title}</h2>
                </div>
              </article>
            );
          }) : <div className={styles.empty}>この月の登録済み女子戦はありません。</div>}
        </section>

        <aside className={styles.sourceBox}>
          <div>
            <strong>スケジュール情報について</strong>
            <p>開催変更・中止・順延などがある場合があります。最終確認は公式情報をご確認ください。</p>
          </div>
          <a href={HATSUNE_SCHEDULE_SOURCE} target="_blank" rel="noopener noreferrer">Ladies Information 年間レース一覧 ↗</a>
        </aside>
      </div>
    </main>
  );
}
