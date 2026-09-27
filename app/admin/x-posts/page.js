import Link from "next/link";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

const ACCOUNTS = [
  { id: "official", name: "BoatStrikers", role: "総合・NEWS・DATA LAB", target: 6 },
  { id: "ichika", name: "一果", role: "イン逃げ・1号艇", target: 2 },
  { id: "hatsune", name: "初音", role: "女子戦・女子レーサー", target: 2 },
  { id: "kiina", name: "キイナ", role: "穴・5アタマ・万舟", target: 2 },
];

const SLOTS = [
  { time: "07:30", account: "official", category: "NEWS", title: "今日のボートレース", status: "draft" },
  { time: "09:00", account: "official", category: "予想", title: "今日の注目BEST3", status: "draft" },
  { time: "10:30", account: "ichika", category: "キャラ", title: "一果のイン逃げ視点", status: "draft" },
  { time: "12:00", account: "official", category: "予想", title: "無料予想", status: "draft" },
  { time: "13:30", account: "hatsune", category: "キャラ", title: "初音の女子戦視点", status: "draft" },
  { time: "15:00", account: "kiina", category: "キャラ", title: "キイナの穴候補", status: "draft" },
  { time: "18:30", account: "official", category: "結果", title: "予想の答え合わせ", status: "draft" },
  { time: "20:30", account: "official", category: "DATA LAB", title: "今日の数字", status: "draft" },
  { time: "21:30", account: "official", category: "会話", title: "3人の会話・明日予告", status: "draft" },
];

function jstToday() {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default function XPostsAdmin() {
  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.hero}>
          <div>
            <span className={styles.eyebrow}>BOATSTRIKERS SOCIAL STUDIO</span>
            <h1>X投稿センター</h1>
            <p>{jstToday()}｜4アカウントの役割を分け、投稿案を確認してから運用するPHASE 1です。</p>
          </div>
          <Link href="/admin" className={styles.back}>← 管理TOP</Link>
        </header>

        <section className={styles.notice}>
          <strong>安全運用モード</strong>
          <p>この画面からXへ自動投稿はしません。予想・結果・数値は確認済みデータだけを使用し、TRINITY本体は変更しません。</p>
        </section>

        <section className={styles.accounts}>
          {ACCOUNTS.map((account) => (
            <article key={account.id} className={styles.accountCard} data-account={account.id}>
              <span>{account.name}</span>
              <strong>{account.target}投稿/日</strong>
              <small>{account.role}</small>
            </article>
          ))}
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <div><span>TODAY'S PLAN</span><h2>今日の投稿予定</h2></div>
            <div className={styles.count}>{SLOTS.length}件</div>
          </div>
          <div className={styles.list}>
            {SLOTS.map((slot, index) => {
              const account = ACCOUNTS.find((item) => item.id === slot.account);
              return (
                <article className={styles.postRow} key={`${slot.time}-${index}`}>
                  <time>{slot.time}</time>
                  <div className={styles.postMain}>
                    <div className={styles.meta}><span>{account?.name}</span><em>{slot.category}</em></div>
                    <strong>{slot.title}</strong>
                    <p>投稿本文は確定データ接続後にここで編集・確認できるようにします。</p>
                  </div>
                  <div className={styles.actions}>
                    <button type="button" disabled>編集</button>
                    <button type="button" disabled>コピー</button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className={styles.next}>
          <h2>次の接続</h2>
          <p><code>ai_v2_daily_rankings</code> / <code>bsc_official_predictions</code> / <code>bs_race_events</code> / DATA LAB出力から、公開可能な確定データだけを投稿案へ接続します。</p>
          <div className={styles.links}>
            <Link href="/admin/ai-candidates">AI候補を確認 →</Link>
            <Link href="/admin/data-lab-social">DATA LAB SNS →</Link>
          </div>
        </section>
      </div>
    </main>
  );
}
