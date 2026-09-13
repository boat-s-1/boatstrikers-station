import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import CopyPostCard from "./CopyPostCard";
import styles from "./xNightPosts.module.css";

export const dynamic = "force-dynamic";

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase環境変数がありません。");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function jst(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function textOf(item) {
  if (typeof item === "string") return item;
  return item?.text || "";
}

function Section({ title, subtitle, items, badge, top5 = false }) {
  const safeItems = Array.isArray(items) ? items.filter((item) => textOf(item)) : [];
  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <h2>{title}</h2>
        <span>{subtitle || `${safeItems.length}件`}</span>
      </div>
      {safeItems.length ? (
        <div className={styles.grid}>
          {safeItems.map((item, index) => (
            <div className={top5 ? styles.top5 : undefined} key={`${title}-${index}`}>
              <CopyPostCard
                label={`${title} ${index + 1}`}
                badge={top5 ? (item?.character || badge || "TOP") : badge}
                text={textOf(item)}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.empty}>候補はありません。</div>
      )}
    </section>
  );
}

export default async function XNightPostsAdminPage() {
  const client = getClient();
  const { data, error } = await client
    .from("bs_x_night_posts")
    .select("race_date,snapshot_news_count,snapshot_result_count,posts,generated_at,updated_at")
    .order("race_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  const posts = data?.posts || {};
  const top5 = Array.isArray(posts.top5) ? posts.top5 : [];

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <Link href="/admin" className={styles.back}>← 管理トップへ戻る</Link>

        <header className={styles.hero}>
          <div>
            <span className={styles.eyebrow}>NIGHT X CONTROL</span>
            <h1>今夜のX投稿候補</h1>
            <p>22:35に自動生成された候補を、キャラ別・TOP5別にそのままコピーできます。</p>
          </div>
        </header>

        {!data ? (
          <div className={styles.empty}>まだ夜X投稿候補が生成されていません。</div>
        ) : (
          <>
            <div className={styles.meta}>
              <div className={styles.metaCard}><span>対象日</span><strong>{data.race_date}</strong></div>
              <div className={styles.metaCard}><span>元データ</span><strong>{data.snapshot_news_count || 0} NEWS / {data.snapshot_result_count || 0}R</strong></div>
              <div className={styles.metaCard}><span>生成時刻</span><strong>{jst(data.generated_at)} JST</strong></div>
            </div>

            <Section title="今夜のTOP5" subtitle={`${top5.length}候補`} items={top5} top5 />
            <Section title="一果" items={posts.ichika} badge="イン逃げ" />
            <Section title="初音" items={posts.hatsune} badge="女子戦" />
            <Section title="キイナ" items={posts.kiina} badge="穴狙い" />
            <Section title="BoatStrikers公式" items={posts.boatstrikers} badge="公式" />
            <Section title="ニュース投稿" items={posts.news_posts} badge="NEWS" />
            <Section title="リアクションTOP3" items={posts.reaction_top3} badge="REACTION" />
          </>
        )}
      </div>
    </main>
  );
}
