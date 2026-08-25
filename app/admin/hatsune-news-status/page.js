import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function formatJst(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

function jobLabel(job) {
  return job === "pipeline" ? "22:20 収集＋AI" : "22:40 AI補完";
}

async function loadRuns() {
  const client = getClient();
  if (!client) return { runs: [], error: "Supabase接続情報がありません" };
  const { data, error } = await client
    .from("hatsune_news_cron_runs")
    .select("id,job_name,status,started_at,finished_at,duration_ms,collected_count,inserted_count,skipped_count,ai_processed_count,ai_generated_count,error_count,error_message")
    .order("started_at", { ascending: false })
    .limit(30);
  return { runs: data || [], error: error?.message || null };
}

export default async function HatsuneNewsStatusPage() {
  const { runs, error } = await loadRuns();
  const pipeline = runs.find((x) => x.job_name === "pipeline");
  const ai = runs.find((x) => x.job_name === "ai");

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div>
            <span className={styles.kicker}>HATSUNE NEWS</span>
            <h1>自動更新ステータス</h1>
            <p>Vercel Proの過去ログを使わず、Cronの実行結果をSupabaseで30件保存・確認します。</p>
          </div>
          <div className={styles.actions}>
            <Link href="/admin" className={styles.secondary}>管理TOP</Link>
            <Link href="/admin/hatsune-news/video" className={styles.secondary}>ヴィーナスNEWS制作</Link>
            <Link href="/hatsune/news" className={styles.primary}>初音NEWSを見る</Link>
          </div>
        </header>

        <section className={styles.summaryGrid}>
          {[pipeline, ai].map((run, index) => (
            <article className={styles.summaryCard} key={index}>
              <div className={styles.cardTop}>
                <strong>{index === 0 ? "22:20 Pipeline" : "22:40 AI"}</strong>
                <span className={`${styles.status} ${styles[run?.status || "none"]}`}>{run?.status || "未記録"}</span>
              </div>
              <div className={styles.latest}>{run ? formatJst(run.started_at) : "まだ履歴がありません"}</div>
              {run && (
                <p>
                  {index === 0
                    ? `収集 ${run.collected_count} / 新規 ${run.inserted_count} / AI ${run.ai_generated_count}`
                    : `処理 ${run.ai_processed_count} / AI生成 ${run.ai_generated_count}`}
                </p>
              )}
            </article>
          ))}
        </section>

        {error && <div className={styles.errorBox}>履歴取得エラー: {error}</div>}

        <section className={styles.panel}>
          <div className={styles.panelHeading}>
            <div>
              <span>EXECUTION HISTORY</span>
              <h2>最近の実行履歴</h2>
            </div>
            <small>最大30件</small>
          </div>

          {runs.length === 0 ? (
            <div className={styles.empty}>次回Cron実行後からここに履歴が表示されます。</div>
          ) : (
            <div className={styles.history}>
              {runs.map((run) => (
                <article key={run.id} className={styles.row}>
                  <div className={styles.rowMain}>
                    <div>
                      <strong>{jobLabel(run.job_name)}</strong>
                      <span>{formatJst(run.started_at)}</span>
                    </div>
                    <span className={`${styles.status} ${styles[run.status]}`}>{run.status}</span>
                  </div>
                  <div className={styles.metrics}>
                    <span>収集 {run.collected_count}</span>
                    <span>新規 {run.inserted_count}</span>
                    <span>AI {run.ai_generated_count}</span>
                    <span>エラー {run.error_count}</span>
                    <span>{run.duration_ms == null ? "—" : `${(run.duration_ms / 1000).toFixed(1)}秒`}</span>
                  </div>
                  {run.error_message && <p className={styles.errorText}>{run.error_message}</p>}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
