import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { isAdminAuthenticated } from "../../../sync/_lib/adminAuth";
import { regenerateHatsuneNewsArticle, saveHatsuneNewsArticle } from "../actions";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function loadArticle(id) {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data } = await supabase
    .from("hatsune_news")
    .select("id,title,summary,article_body,article_body_source,image_url,source_url,source_name,category,place,published_at,is_published,article_ai_model,article_ai_generated_at")
    .eq("id", id)
    .maybeSingle();
  return data || null;
}

export default async function HatsuneNewsEditPage({ params, searchParams }) {
  if (!(await isAdminAuthenticated())) redirect("/admin/sync/login");
  const { id } = await params;
  const query = await searchParams;
  const item = await loadArticle(id);
  if (!item) notFound();

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.topbar}>
          <Link href="/admin/hatsune-news/editor">← 記事一覧</Link>
          <div>
            <Link href={`/hatsune/news/${item.id}`} target="_blank">公開ページを見る ↗</Link>
            <Link href="/admin">管理TOP</Link>
          </div>
        </header>

        {(query?.saved === "1" || query?.regenerated === "1") && (
          <div className={styles.success}>
            {query?.regenerated === "1" ? "AI本文を再生成しました。" : "記事を保存しました。"}
          </div>
        )}

        <section className={styles.hero}>
          <span>HATSUNE NEWS CMS</span>
          <h1>記事を編集</h1>
          <p>{item.category} ・ {item.place || "開催場なし"} ・ ID {item.id}</p>
        </section>

        <form action={saveHatsuneNewsArticle} className={styles.form}>
          <input type="hidden" name="id" value={item.id} />

          <section className={styles.card}>
            <div className={styles.cardTitle}>
              <span>TEXT</span>
              <h2>本文編集</h2>
            </div>
            <label>
              <span>タイトル</span>
              <input name="title" defaultValue={item.title || ""} required />
            </label>
            <label>
              <span>概要</span>
              <textarea name="summary" rows={4} defaultValue={item.summary || ""} />
            </label>
            <label>
              <span>記事本文</span>
              <textarea name="article_body" rows={16} defaultValue={item.article_body || ""} />
              <small>手動保存すると、本文は「manual」扱いになり、自動AI更新で上書きされません。</small>
            </label>
          </section>

          <section className={styles.card}>
            <div className={styles.cardTitle}>
              <span>PHOTO</span>
              <h2>記事内写真</h2>
            </div>
            <label>
              <span>画像URL</span>
              <input name="image_url" type="url" placeholder="https://..." defaultValue={item.image_url || ""} />
              <small>画像URLを入れると、公開記事の本文内にも写真を表示します。</small>
            </label>
            {item.image_url && (
              <div className={styles.preview}>
                <img src={item.image_url} alt="記事画像プレビュー" />
              </div>
            )}
          </section>

          <section className={styles.card}>
            <div className={styles.cardTitle}>
              <span>LINK</span>
              <h2>URL・出典リンク</h2>
            </div>
            <label>
              <span>リンクURL</span>
              <input name="source_url" type="url" placeholder="https://..." defaultValue={item.source_url || ""} />
            </label>
            <label>
              <span>リンク表示名</span>
              <input name="source_name" placeholder="BOAT RACE公式 / 詳細はこちら など" defaultValue={item.source_name || ""} />
            </label>
          </section>

          <section className={styles.card}>
            <div className={styles.cardTitle}>
              <span>PUBLISH</span>
              <h2>公開設定</h2>
            </div>
            <label className={styles.checkRow}>
              <input name="is_published" type="checkbox" defaultChecked={Boolean(item.is_published)} />
              <span>この記事を公開する</span>
            </label>
            <p className={styles.meta}>本文状態: {item.article_body_source || "未生成"}{item.article_ai_model ? ` / ${item.article_ai_model}` : ""}</p>
          </section>

          <div className={styles.saveBar}>
            <Link href="/admin/hatsune-news/editor">キャンセル</Link>
            <button type="submit">変更を保存</button>
          </div>
        </form>

        <form action={regenerateHatsuneNewsArticle} className={styles.aiCard}>
          <input type="hidden" name="id" value={item.id} />
          <div>
            <span>AI REWRITE</span>
            <h2>初音ちゃん口調で再生成</h2>
            <p>タイトル・概要などの事実データから本文だけをAIで作り直します。手動編集した本文は置き換わります。</p>
          </div>
          <button type="submit">AI本文を再生成</button>
        </form>
      </div>
    </main>
  );
}
