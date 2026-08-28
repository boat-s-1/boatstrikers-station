import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { isAdminAuthenticated } from "../../sync/_lib/adminAuth";
import HatsuneSnsMaker from "./HatsuneSnsMaker";
import styles from "./editor.module.css";

export const dynamic = "force-dynamic";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
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
  }).format(new Date(value));
}

async function loadArticles() {
  const supabase = getSupabase();
  if (!supabase) return { articles: [], error: "Supabase管理用環境変数がありません。" };
  const { data, error } = await supabase
    .from("hatsune_news")
    .select("id,title,summary,category,place,published_at,is_published,article_body_source,image_url,source_url,source_type,source_name")
    .eq("is_published", true)
    .order("published_at", { ascending: false })
    .limit(100);
  return { articles: data || [], error: error?.message || null };
}

export default async function HatsuneNewsEditorPage() {
  if (!(await isAdminAuthenticated())) redirect("/admin/sync/login");
  const { articles, error } = await loadArticles();

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.hero}>
          <div>
            <span>HATSUNE NEWS CMS</span>
            <h1>初音NEWS 記事編集</h1>
            <p>本文編集・AI再生成・記事内写真・SNS投稿素材まで、この画面でまとめて管理できます。</p>
          </div>
          <div className={styles.actions}>
            <Link href="/admin/hatsune-news-status">自動更新状況</Link>
            <Link href="/hatsune/news">公開NEWS</Link>
            <Link href="/admin" className={styles.primary}>管理TOP</Link>
          </div>
        </header>

        {error && <div className={styles.error}>取得エラー：{error}</div>}

        {!error && <HatsuneSnsMaker articles={articles} />}

        <section className={styles.panel}>
          <div className={styles.panelHeading}>
            <div>
              <span>ARTICLES</span>
              <h2>記事一覧</h2>
            </div>
            <small>新しい順・最大100件</small>
          </div>

          <div className={styles.list}>
            {articles.map((item) => (
              <Link key={item.id} href={`/admin/hatsune-news/editor/${item.id}`} className={styles.card}>
                <div className={styles.cardMain}>
                  <div className={styles.badges}>
                    <span>{item.category || "topic"}</span>
                    <span className={item.is_published ? styles.published : styles.draft}>
                      {item.is_published ? "公開中" : "非公開"}
                    </span>
                    {item.article_body_source && <span>{item.article_body_source}</span>}
                    {item.image_url && <span>📷 写真</span>}
                    {item.source_url && <span>🔗 URL</span>}
                  </div>
                  <h3>{item.title}</h3>
                  <p>{[item.source_name, item.place, formatJst(item.published_at)].filter(Boolean).join(" ・ ")}</p>
                </div>
                <strong>編集 →</strong>
              </Link>
            ))}
            {!articles.length && !error && <p className={styles.empty}>記事がありません。</p>}
          </div>
        </section>
      </div>
    </main>
  );
}
