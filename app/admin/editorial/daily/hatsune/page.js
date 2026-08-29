import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { generateHatsuneDailyDigest } from "../../../../../lib/editorialProductionAi";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function jstToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function formatJst(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

async function loadCandidates() {
  const client = getClient();
  if (!client) return { rows: [], error: "Supabase管理用環境変数がありません。" };

  const { data, error } = await client
    .from("bs_news_candidates")
    .select("id,title,summary,category,source_name,source_url,published_at,collected_at,importance,target_character,status")
    .eq("target_character", "hatsune")
    .in("status", ["adopted", "published"])
    .order("importance", { ascending: false })
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(30);

  return { rows: data || [], error: error?.message || null };
}

async function createDailyNews(formData) {
  "use server";

  const ids = formData.getAll("newsId").map(Number).filter(Number.isFinite);
  if (!ids.length) redirect("/admin/editorial/daily/hatsune?error=no_selection");
  if (ids.length > 8) redirect("/admin/editorial/daily/hatsune?error=too_many");

  const client = getClient();
  if (!client) redirect("/admin/editorial/daily/hatsune?error=missing_supabase");

  const { data: items, error: readError } = await client
    .from("bs_news_candidates")
    .select("id,title,summary,category,source_name,source_url,published_at,collected_at,importance,target_character,status")
    .in("id", ids)
    .eq("target_character", "hatsune")
    .in("status", ["adopted", "published"]);

  if (readError || !items?.length) redirect("/admin/editorial/daily/hatsune?error=read_failed");

  const dateLabel = jstToday();

  try {
    const digest = await generateHatsuneDailyDigest(items, dateLabel);
    const sourceKey = `editorial-daily-hatsune:${dateLabel}:${Date.now()}`;

    const { data: article, error: insertError } = await client
      .from("hatsune_news")
      .insert({
        title: digest.title,
        summary: digest.summary,
        category: "women",
        source_type: "news",
        source_name: "BoatStrikers AI編集部",
        source_url: null,
        published_at: new Date().toISOString(),
        is_published: false,
        article_body: digest.article_body,
        article_body_source: "ai",
        article_ai_model: digest.model,
        article_ai_generated_at: digest.generated_at,
        source_key: sourceKey,
        collected_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (insertError || !article?.id) throw insertError || new Error("初音NEWSの下書きを保存できませんでした。");

    for (const item of items) {
      const { data: current } = await client
        .from("bs_news_candidates")
        .select("raw_payload")
        .eq("id", item.id)
        .maybeSingle();

      const rawPayload = {
        ...(current?.raw_payload || {}),
        daily_hatsune_digest: {
          article_id: article.id,
          source_ids: digest.source_ids,
          shorts_script: digest.shorts_script,
          x_post: digest.x_post,
          generated_at: digest.generated_at,
          model: digest.model,
        },
      };

      await client
        .from("bs_news_candidates")
        .update({ raw_payload: rawPayload, updated_at: new Date().toISOString() })
        .eq("id", item.id);
    }

    redirect(`/admin/hatsune-news/editor/${article.id}?from=editorial_daily`);
  } catch (error) {
    const message = encodeURIComponent(error?.message || "generate_failed");
    redirect(`/admin/editorial/daily/hatsune?error=generate_failed&detail=${message}`);
  }
}

function errorText(code, detail) {
  if (detail) return decodeURIComponent(String(detail));
  switch (code) {
    case "no_selection": return "ニュースを1件以上選択してください。";
    case "too_many": return "一度に選べるニュースは8件までです。";
    case "missing_supabase": return "Supabase管理用環境変数がありません。";
    case "read_failed": return "採用ニュースの読み込みに失敗しました。";
    case "generate_failed": return "初音NEWSの生成に失敗しました。";
    default: return "";
  }
}

export default async function HatsuneDailyEditorialPage({ searchParams }) {
  const query = await searchParams;
  const { rows, error } = await loadCandidates();
  const actionError = errorText(query?.error, query?.detail);

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.topbar}>
          <Link href="/admin/editorial">← AI編集部へ戻る</Link>
          <Link href="/admin/hatsune-news/editor">初音NEWS記事一覧</Link>
        </header>

        <section className={styles.hero}>
          <span>HATSUNE DAILY NEWS BUILDER</span>
          <h1>🌸 今日の初音NEWSをまとめて作る</h1>
          <p>採用済みの初音担当ニュースを複数選び、1本の日次NEWS記事にまとめます。</p>
        </section>

        {(error || actionError) && <div className={styles.error}>{error || actionError}</div>}

        <form action={createDailyNews}>
          <section className={styles.guide}>
            <div>
              <strong>使うニュースを選択</strong>
              <p>1〜5件程度がおすすめです。最大8件まで選択できます。</p>
            </div>
            <button type="submit">選択したニュースで作る →</button>
          </section>

          <div className={styles.list}>
            {rows.map((row) => (
              <label className={styles.card} key={row.id}>
                <input type="checkbox" name="newsId" value={row.id} defaultChecked={Number(row.importance) >= 4} />
                <div className={styles.cardBody}>
                  <div className={styles.badges}>
                    <span>🌸 初音</span>
                    <span>{"★".repeat(Math.max(1, Math.min(5, Number(row.importance || 1))))}</span>
                    <span>{row.status === "published" ? "公開済み" : "採用"}</span>
                  </div>
                  <h2>{row.title}</h2>
                  {row.summary && <p>{row.summary}</p>}
                  <small>{[row.category, row.source_name, formatJst(row.published_at || row.collected_at)].filter(Boolean).join(" ・ ")}</small>
                </div>
              </label>
            ))}
            {!rows.length && <div className={styles.empty}>採用済みの初音担当ニュースがありません。AI編集部でニュースを採用してください。</div>}
          </div>

          {rows.length > 0 && (
            <div className={styles.stickyBar}>
              <div><strong>初音のヴィーナスNEWS</strong><span>選択ニュースを1本の記事へまとめます</span></div>
              <button type="submit">今日の初音NEWSを作る</button>
            </div>
          )}
        </form>
      </div>
    </main>
  );
}
