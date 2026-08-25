import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { isAdminAuthenticated } from "../../sync/_lib/adminAuth";
import VideoStudio from "./VideoStudio";
import styles from "./video.module.css";

export const dynamic = "force-dynamic";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function jstDate(offsetDays = 0) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" })
    .format(new Date(Date.now() + offsetDays * 86400000));
}

async function loadData() {
  const supabase = getSupabase();
  if (!supabase) return { articles: [], videos: [], error: "Supabase管理用環境変数がありません。" };
  const since = new Date(Date.now() - 10 * 86400000).toISOString();
  const [{ data: articles, error: articleError }, { data: videos, error: videoError }] = await Promise.all([
    supabase.from("hatsune_news")
      .select("id,title,summary,category,place,published_at,article_body_source,is_published")
      .eq("is_published", true)
      .gte("published_at", since)
      .order("published_at", { ascending: false })
      .limit(80),
    supabase.from("hatsune_news_videos")
      .select("id,video_type,target_date,period_start,period_end,title,status,ai_model,ai_generated_at,created_at,rendered_at,render_meta,render_error")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  return { articles: articles || [], videos: videos || [], error: articleError?.message || videoError?.message || null };
}

export default async function HatsuneVideoPage() {
  if (!(await isAdminAuthenticated())) redirect("/admin/sync/login");
  const { articles, videos, error } = await loadData();
  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.hero}>
          <div>
            <span>HATSUNE VENUS NEWS STUDIO</span>
            <h1>初音ヴィーナスNEWS 制作</h1>
            <p>NEWS選択 → AI台本 → AivisSpeech音声 → 字幕 → FFmpeg MP4までつなぐ制作画面です。</p>
          </div>
          <div className={styles.heroActions}>
            <Link href="/admin/hatsune-news-status" className={styles.secondary}>自動更新状況</Link>
            <Link href="/admin" className={styles.primary}>管理TOP</Link>
          </div>
        </header>
        {error && <div className={styles.error}>取得エラー：{error}</div>}
        <VideoStudio articles={articles} videos={videos} today={jstDate()} weekStart={jstDate(-6)} />
      </div>
    </main>
  );
}
