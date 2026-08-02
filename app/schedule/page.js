import Link from "next/link";
import BottomNav from "../BottomNav";
import { getPublicScheduleSupabase } from "../../lib/scheduleSupabase";
import ScheduleClient from "./ScheduleClient";
import styles from "./schedule.module.css";

export const dynamic = "force-dynamic";

function getJstToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function mondayOf(value) {
  const date = new Date(`${value}T12:00:00+09:00`);
  const day = date.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + diff);
  return date.toISOString().slice(0, 10);
}

function addDays(value, days) {
  const date = new Date(`${value}T12:00:00+09:00`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

async function getItems(start, end) {
  const supabase = getPublicScheduleSupabase();
  if (!supabase) return { items: [], error: "Supabase環境変数が未設定です。" };

  const { data, error } = await supabase
    .from("weekly_schedule_items")
    .select("*")
    .eq("status", "published")
    .gte("event_date", start)
    .lt("event_date", end)
    .order("event_date", { ascending: true })
    .order("start_time", { ascending: true });

  return {
    items: data || [],
    error: error?.message || null,
  };
}

export default async function SchedulePage({ searchParams }) {
  const query = await searchParams;
  const requested = /^\d{4}-\d{2}-\d{2}$/.test(query?.week || "")
    ? query.week
    : getJstToday();
  const weekStart = mondayOf(requested);
  const weekEnd = addDays(weekStart, 7);
  const previousWeek = addDays(weekStart, -7);
  const nextWeek = addDays(weekStart, 7);
  const { items, error } = await getItems(weekStart, weekEnd);

  return (
    <main className={styles.page}>
      <header className={styles.siteHeader}>
        <Link href="/" className={styles.logo}>BOAT<br /><span>STRIKERS</span></Link>
        <a className={styles.lineButton} href="https://lin.ee/Pf3FEEQ">LINE登録</a>
      </header>

      <section className={styles.hero} aria-label="BoatStrikers週間番組表">
        <img
          src="/schedule-banners/weekly-schedule-banner.jpg"
          alt="BoatStrikers週間番組表 今週の配信をひと目でチェック"
        />
      </section>

      <nav className={styles.weekNav} aria-label="週の移動">
        <Link href={`/schedule?week=${previousWeek}`}>← 前の週</Link>
        <strong>{weekStart}〜{addDays(weekStart, 6)}</strong>
        <Link href={`/schedule?week=${nextWeek}`}>次の週 →</Link>
      </nav>

      {error && (
        <div className={styles.setupNotice}>
          番組表を読み込めませんでした。管理画面用SQLと環境変数を確認してください。
        </div>
      )}

      <ScheduleClient
        items={items}
        weekStart={weekStart}
        today={getJstToday()}
      />

      <BottomNav />
    </main>
  );
}
