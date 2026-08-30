import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { generateEditorialMaterials } from "../../../../../lib/editorialProductionAi";
import CopyButton from "./CopyButton";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

const CHARACTER_META = {
  ichika: { label: "一果", icon: "🍓" },
  hatsune: { label: "初音", icon: "🌸" },
  kiina: { label: "キイナ", icon: "⚡" },
  boatstrikers: { label: "BoatStrikers", icon: "🚤" },
};

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function loadItem(id) {
  const client = getClient();
  if (!client) return null;
  const { data } = await client
    .from("bs_news_candidates")
    .select("id,title,summary,category,source_name,source_url,published_at,importance,target_character,status,raw_payload")
    .eq("id", Number(id))
    .maybeSingle();
  return data || null;
}

async function generateMaterials(formData) {
  "use server";
  const id = Number(formData.get("id"));
  if (!Number.isFinite(id)) redirect("/admin/editorial?error=invalid");

  const client = getClient();
  if (!client) redirect(`/admin/editorial/produce/${id}?error=missing_supabase`);

  const { data: item, error: readError } = await client
    .from("bs_news_candidates")
    .select("id,title,summary,category,source_name,source_url,published_at,importance,target_character,status,raw_payload")
    .eq("id", id)
    .maybeSingle();

  if (readError || !item) redirect(`/admin/editorial/produce/${id}?error=not_found`);
  if (item.status !== "adopted") redirect(`/admin/editorial/produce/${id}?error=not_adopted`);

  try {
    const materials = await generateEditorialMaterials(item);
    const rawPayload = { ...(item.raw_payload || {}), editorial_materials: materials };
    const { error } = await client
      .from("bs_news_candidates")
      .update({ raw_payload: rawPayload, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
  } catch (error) {
    redirect(`/admin/editorial/produce/${id}?error=${encodeURIComponent(error?.message || "generate_failed")}`);
  }

  revalidatePath(`/admin/editorial/produce/${id}`);
  redirect(`/admin/editorial/produce/${id}?generated=1`);
}

async function sendToHatsune(formData) {
  "use server";
  const id = Number(formData.get("id"));
  if (!Number.isFinite(id)) redirect("/admin/editorial?error=invalid");

  const client = getClient();
  if (!client) redirect(`/admin/editorial/produce/${id}?error=missing_supabase`);

  const { data: item } = await client
    .from("bs_news_candidates")
    .select("id,title,summary,category,source_name,source_url,published_at,target_character,raw_payload")
    .eq("id", id)
    .maybeSingle();
  if (!item) redirect(`/admin/editorial/produce/${id}?error=not_found`);
  if (item.target_character !== "hatsune") redirect(`/admin/editorial/produce/${id}?error=hatsune_only`);

  const sourceKey = `editorial:${id}`;
  const { data: existing } = await client.from("hatsune_news").select("id").eq("source_key", sourceKey).maybeSingle();
  if (existing?.id) redirect(`/admin/hatsune-news/editor/${existing.id}`);

  const materials = item.raw_payload?.editorial_materials || {};
  const autoHeadline = item.raw_payload?.editorial_list_headline?.headline || null;
  const { data, error } = await client
    .from("hatsune_news")
    .insert({
      source_key: sourceKey,
      source_type: "news",
      title: materials.news_title || item.title,
      list_headline: materials.list_headline || autoHeadline,
      summary: item.summary,
      category: item.category || "women",
      source_name: item.source_name,
      source_url: item.source_url,
      published_at: item.published_at || new Date().toISOString(),
      article_body: materials.news_body || null,
      article_body_source: materials.news_body ? "manual" : "template",
      is_published: false,
      collected_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error || !data?.id) redirect(`/admin/editorial/produce/${id}?error=hatsune_send_failed`);
  redirect(`/admin/hatsune-news/editor/${data.id}`);
}

export default async function EditorialProducePage({ params, searchParams }) {
  const { id } = await params;
  const query = await searchParams;
  const item = await loadItem(id);
  if (!item) notFound();

  const char = CHARACTER_META[item.target_character] || CHARACTER_META.boatstrikers;
  const materials = item.raw_payload?.editorial_materials || null;
  const autoHeadline = item.raw_payload?.editorial_list_headline?.headline || null;
  const isAdopted = item.status === "adopted";

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.topbar}>
          <Link href="/admin/editorial">← AI編集部へ戻る</Link>
          <Link href="/admin">管理トップ</Link>
        </header>

        <section className={styles.hero}>
          <span>EDITORIAL PRODUCTION WORKSPACE</span>
          <h1>{char.icon} {char.label} 制作ワークスペース</h1>
          <p>採用ニュース1件から、X・ショート・note・サイトNEWSの下書きをまとめて作ります。</p>
        </section>

        {query?.generated === "1" && <div className={styles.success}>✓ 制作素材と短い一覧見出しを生成して保存しました。</div>}
        {query?.error && <div className={styles.error}>エラー: {decodeURIComponent(String(query.error))}</div>}

        <section className={styles.sourceCard}>
          <div className={styles.sourceTop}>
            <span>{"★".repeat(Math.max(1, Math.min(5, Number(item.importance || 1))))}</span>
            <strong>{isAdopted ? "採用済み" : "未採用"}</strong>
          </div>
          <h2>{item.title}</h2>
          {autoHeadline && <p>一覧用短見出し：{autoHeadline}</p>}
          {item.summary && <p>{item.summary}</p>}
          <div className={styles.sourceMeta}>
            {item.category && <span>カテゴリ：{item.category}</span>}
            {item.source_name && <span>出典：{item.source_name}</span>}
          </div>
          <a href={item.source_url} target="_blank" rel="noreferrer">元記事を確認 ↗</a>
        </section>

        <form action={generateMaterials} className={styles.generateCard}>
          <input type="hidden" name="id" value={item.id} />
          <div>
            <span>AI DRAFT</span>
            <h2>{materials ? "制作素材を再生成" : "4媒体の下書きを一括生成"}</h2>
            <p>ニュースの事実データと担当キャラを引き継ぎ、一覧用短見出し・X・ショート・note・サイトNEWS用の文章を生成します。</p>
          </div>
          <button type="submit" disabled={!isAdopted}>{materials ? "AIで作り直す" : "制作素材を作る"}</button>
        </form>

        {!materials ? (
          <section className={styles.empty}>短見出しは採用時に自動生成済みです。必要に応じて4媒体の制作素材も作成できます。</section>
        ) : (
          <div className={styles.materialGrid}>
            {materials.list_headline && (
              <section className={styles.materialCard}>
                <div className={styles.cardHeading}><div><span>LIST HEADLINE</span><h2>ニュース一覧用見出し</h2></div><CopyButton text={materials.list_headline} /></div>
                <input readOnly value={materials.list_headline} />
              </section>
            )}

            <section className={styles.materialCard}>
              <div className={styles.cardHeading}><div><span>X POST</span><h2>X投稿</h2></div><CopyButton text={materials.x_post} /></div>
              <textarea readOnly rows={7} value={materials.x_post} />
            </section>

            <section className={styles.materialCard}>
              <div className={styles.cardHeading}><div><span>SHORTS</span><h2>ショート台本</h2></div><CopyButton text={materials.shorts_script} /></div>
              <textarea readOnly rows={12} value={materials.shorts_script} />
              <Link className={styles.linkButton} href="/admin/shorts">ショート制作画面へ →</Link>
            </section>

            <section className={styles.materialCard}>
              <div className={styles.cardHeading}><div><span>NOTE</span><h2>note記事</h2></div><CopyButton text={`${materials.note_title}\n\n${materials.note_body}`} /></div>
              <input readOnly value={materials.note_title} />
              <textarea readOnly rows={18} value={materials.note_body} />
            </section>

            <section className={styles.materialCard}>
              <div className={styles.cardHeading}><div><span>SITE NEWS</span><h2>サイトNEWS</h2></div><CopyButton text={`${materials.news_title}\n\n${materials.news_body}`} /></div>
              <input readOnly value={materials.news_title} />
              <textarea readOnly rows={14} value={materials.news_body} />
              {item.target_character === "hatsune" && (
                <form action={sendToHatsune}>
                  <input type="hidden" name="id" value={item.id} />
                  <button className={styles.hatsuneButton} type="submit">初音NEWSへ送る →</button>
                </form>
              )}
            </section>
          </div>
        )}

        {materials?.generated_at && <p className={styles.generatedMeta}>生成モデル: {materials.model || "AI"} / 保存済み</p>}
      </div>
    </main>
  );
}
