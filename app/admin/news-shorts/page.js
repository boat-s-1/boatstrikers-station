import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { isAdminAuthenticated } from "../sync/_lib/adminAuth";
import { generateDailyNewsShort, jstDate } from "../../../lib/newsShortAi";
import styles from "./newsShorts.module.css";

export const dynamic = "force-dynamic";

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function generateAction() {
  "use server";
  if (!(await isAdminAuthenticated())) redirect("/admin/sync/login");
  await generateDailyNewsShort({ date: jstDate(), force: true });
  redirect("/admin/news-shorts?generated=1");
}

async function statusAction(formData) {
  "use server";
  if (!(await isAdminAuthenticated())) redirect("/admin/sync/login");
  const id = Number(formData.get("id"));
  const status = String(formData.get("status") || "");
  if (!Number.isFinite(id) || !["draft", "approved", "published"].includes(status)) return;
  const client = getClient();
  if (!client) throw new Error("Supabase環境変数がありません。");
  const { error } = await client.from("bs_news_short_drafts").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
  redirect("/admin/news-shorts");
}

function characterName(value) {
  return { ichika: "一果", hatsune: "初音", kiina: "キイナ", boatstrikers: "BoatStrikers公式" }[value] || value;
}

function formatDate(value) {
  if (!value) return "—";
  return String(value).replaceAll("-", "/");
}

export default async function NewsShortsPage({ searchParams }) {
  if (!(await isAdminAuthenticated())) redirect("/admin/sync/login");
  const params = await searchParams;
  const client = getClient();
  let drafts = [];
  let error = null;
  if (!client) {
    error = "Supabaseのサーバー環境変数がありません。";
  } else {
    const result = await client.from("bs_news_short_drafts").select("*").order("short_date", { ascending: false }).limit(14);
    drafts = result.data || [];
    error = result.error?.message || null;
  }
  const requestedDate = /^\d{4}-\d{2}-\d{2}$/.test(String(params?.date || "")) ? params.date : null;
  const current = (requestedDate ? drafts.find((item) => item.short_date === requestedDate) : drafts[0]) || null;

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.hero}>
          <div><span>BOATSTRIKERS NEWS SHORTS</span><h1>今日のBOAT NEWS 3</h1><p>検証済みNEWSから上位3件を選び、30〜35秒の台本・字幕・SNS文を自動生成します。</p></div>
          <Link href="/admin" className={styles.back}>管理トップへ</Link>
        </header>

        <section className={styles.toolbar}>
          <div><strong>毎日 22:50 JST 自動生成</strong><span>NEWS検証後に1日1本。必要なときだけ手動で再生成できます。</span></div>
          <form action={generateAction}><button type="submit">今日分を再生成</button></form>
        </section>

        {params?.generated === "1" && <div className={styles.success}>今日分を再生成しました。</div>}
        {error && <div className={styles.error}>取得エラー：{error}</div>}

        <section className={styles.history}>
          <h2>生成履歴</h2>
          <div className={styles.historyRow}>
            {drafts.map((item) => <Link key={item.id} href={`/admin/news-shorts?date=${item.short_date}`} className={current?.id === item.id ? styles.activeDate : styles.dateChip}>{formatDate(item.short_date)}<small>{item.status}</small></Link>)}
          </div>
        </section>

        {!current ? <section className={styles.empty}><strong>まだNEWSショートは生成されていません。</strong><p>「今日分を再生成」または22:50の自動生成後に表示されます。</p></section> : <>
          <section className={styles.summary}>
            <div><span>対象日</span><strong>{formatDate(current.short_date)}</strong></div>
            <div><span>担当</span><strong>{characterName(current.character)}</strong></div>
            <div><span>状態</span><strong>{current.status}</strong></div>
            <div><span>AI</span><strong>{current.ai_model || "—"}</strong></div>
          </section>

          <section className={styles.statusBar}>
            <form action={statusAction}><input type="hidden" name="id" value={current.id}/><button name="status" value="draft">下書き</button><button name="status" value="approved">承認</button><button name="status" value="published">公開済み</button></form>
          </section>

          <section className={styles.newsGrid}>
            {(current.selected_news || []).map((news, index) => <article className={styles.newsCard} key={news.id || index}>
              <span>NEWS {index + 1}・SCORE {news.score}</span>
              <h3>{news.title}</h3>
              <p>{news.summary || "要約なし"}</p>
              <footer>{news.category || "未分類"} / {news.source_name || "source"}</footer>
            </article>)}
          </section>

          <section className={styles.outputCard}><h2>🎙️ AivisSpeech用ナレーション</h2><textarea readOnly value={current.narration || ""} rows={7}/></section>

          <section className={styles.segmentList}><h2>📱 画面・字幕構成</h2>{(current.segments || []).map((segment) => <article key={segment.rank}><b>NEWS {segment.rank}</b><h3>{segment.headline}</h3><p>{segment.caption}</p><small>{segment.narration}</small></article>)}</section>

          <section className={styles.twoCol}>
            <div className={styles.outputCard}><h2>▶ YouTube Shorts</h2><label>タイトル</label><textarea readOnly value={current.youtube_title || ""} rows={2}/><label>概要欄</label><textarea readOnly value={current.description || ""} rows={5}/></div>
            <div className={styles.outputCard}><h2>𝕏 投稿文</h2><textarea readOnly value={current.x_post || ""} rows={6}/><p className={styles.tags}>{(current.hashtags || []).join(" ")}</p></div>
          </section>

          <section className={styles.outputCard}><h2>⏱️ 固定タイムライン</h2><div className={styles.timeline}>{(current.captions || []).map((caption, index) => <div key={index}><b>{caption.start}–{caption.end}s</b><span>{caption.text}</span></div>)}</div></section>
        </>}
      </div>
    </main>
  );
}
