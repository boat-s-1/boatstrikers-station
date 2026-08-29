import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

const CHARACTER_META = {
  ichika: { label: "一果", icon: "🍓" },
  hatsune: { label: "初音", icon: "🌸" },
  kiina: { label: "キイナ", icon: "⚡" },
  boatstrikers: { label: "BoatStrikers", icon: "🚤" },
};

const STATUS_META = {
  unreviewed: { label: "未確認", tone: "pending" },
  approved: { label: "採用", tone: "approved" },
  rejected: { label: "不採用", tone: "rejected" },
};

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function validFilter(value, allowed, fallback = "all") {
  return allowed.includes(value) ? value : fallback;
}

function jstDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

async function loadNews(character, status) {
  const client = getClient();
  if (!client) return { rows: [], error: "Supabase環境変数がありません。" };

  let query = client
    .from("bs_news_candidates")
    .select("id,collected_at,published_at,title,category,summary,source_name,source_url,importance,target_character,status,collected_by,raw_payload")
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("collected_at", { ascending: false })
    .limit(100);

  if (character !== "all") query = query.eq("target_character", character);
  if (status !== "all") query = query.eq("status", status);

  const { data, error } = await query;
  return { rows: data || [], error: error?.message || null };
}

async function updateStatus(formData) {
  "use server";
  const id = Number(formData.get("id"));
  const nextStatus = String(formData.get("status") || "unreviewed");
  const character = validFilter(String(formData.get("character") || "all"), ["all", ...Object.keys(CHARACTER_META)]);
  const filterStatus = validFilter(String(formData.get("filterStatus") || "all"), ["all", ...Object.keys(STATUS_META)]);

  if (!Number.isFinite(id) || !STATUS_META[nextStatus]) {
    redirect(`/admin/editorial?character=${character}&status=${filterStatus}&error=invalid`);
  }

  const client = getClient();
  if (!client) redirect(`/admin/editorial?character=${character}&status=${filterStatus}&error=missing_supabase`);

  const { error } = await client
    .from("bs_news_candidates")
    .update({ status: nextStatus, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) redirect(`/admin/editorial?character=${character}&status=${filterStatus}&error=save_failed`);

  revalidatePath("/admin/editorial");
  redirect(`/admin/editorial?character=${character}&status=${filterStatus}&saved=1`);
}

export default async function EditorialPage({ searchParams }) {
  const params = await searchParams;
  const character = validFilter(params?.character, ["all", ...Object.keys(CHARACTER_META)]);
  const status = validFilter(params?.status, ["all", ...Object.keys(STATUS_META)]);
  const { rows, error } = await loadNews(character, status);

  const counts = rows.reduce((acc, row) => {
    acc[row.status] = (acc[row.status] || 0) + 1;
    return acc;
  }, { unreviewed: 0, approved: 0, rejected: 0 });

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.hero}>
          <div>
            <span className={styles.eyebrow}>BOATSTRIKERS AI EDITORIAL DESK</span>
            <h1>AI編集部</h1>
            <p>Geminiが集めたニュース候補を確認し、採用・不採用を決めます。</p>
          </div>
          <Link href="/admin" className={styles.backButton}>管理トップへ</Link>
        </header>

        <section className={styles.summaryGrid}>
          <article><span>表示中</span><strong>{rows.length}</strong><small>件</small></article>
          <article><span>未確認</span><strong>{counts.unreviewed}</strong><small>件</small></article>
          <article><span>採用</span><strong>{counts.approved}</strong><small>件</small></article>
          <article><span>不採用</span><strong>{counts.rejected}</strong><small>件</small></article>
        </section>

        <section className={styles.filterCard}>
          <form method="get" className={styles.filters}>
            <label><span>担当</span><select name="character" defaultValue={character}>
              <option value="all">すべて</option>
              {Object.entries(CHARACTER_META).map(([key, meta]) => <option key={key} value={key}>{meta.label}</option>)}
            </select></label>
            <label><span>状態</span><select name="status" defaultValue={status}>
              <option value="all">すべて</option>
              {Object.entries(STATUS_META).map(([key, meta]) => <option key={key} value={key}>{meta.label}</option>)}
            </select></label>
            <button type="submit">絞り込む</button>
          </form>
        </section>

        {params?.saved === "1" && <div className={styles.success}>✓ 判定を保存しました。</div>}
        {(error || params?.error) && <div className={styles.error}>取得・保存時にエラーが発生しました。{error ? ` ${error}` : ""}</div>}

        <section className={styles.newsList}>
          {rows.length === 0 ? <div className={styles.empty}>該当するニュース候補はありません。</div> : rows.map((row) => {
            const char = CHARACTER_META[row.target_character] || CHARACTER_META.boatstrikers;
            const stat = STATUS_META[row.status] || STATUS_META.unreviewed;
            const rule = row.raw_payload?.classification_rule;
            return (
              <article className={styles.newsCard} key={row.id}>
                <div className={styles.cardTop}>
                  <div className={styles.badges}>
                    <span className={styles.characterBadge}>{char.icon} {char.label}</span>
                    <span className={`${styles.statusBadge} ${styles[stat.tone]}`}>{stat.label}</span>
                    <span className={styles.importance}>{"★".repeat(Math.max(1, Math.min(5, Number(row.importance || 1))))}</span>
                  </div>
                  <time>{jstDate(row.published_at || row.collected_at)}</time>
                </div>

                <h2>{row.title}</h2>
                {row.summary && <p className={styles.summary}>{row.summary}</p>}

                <div className={styles.meta}>
                  {row.category && <span>カテゴリ：{row.category}</span>}
                  {row.source_name && <span>出典：{row.source_name}</span>}
                  {rule && <span>分類：{rule}</span>}
                </div>

                <div className={styles.actions}>
                  <a href={row.source_url} target="_blank" rel="noreferrer" className={styles.sourceButton}>元記事を見る ↗</a>
                  <form action={updateStatus}>
                    <input type="hidden" name="id" value={row.id} />
                    <input type="hidden" name="character" value={character} />
                    <input type="hidden" name="filterStatus" value={status} />
                    <button name="status" value="approved" className={styles.approveButton}>採用</button>
                    <button name="status" value="rejected" className={styles.rejectButton}>不採用</button>
                    <button name="status" value="unreviewed" className={styles.resetButton}>未確認へ戻す</button>
                  </form>
                </div>
              </article>
            );
          })}
        </section>
      </div>
    </main>
  );
}
