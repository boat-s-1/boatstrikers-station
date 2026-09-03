import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import styles from "../page.module.css";

export const dynamic = "force-dynamic";

const CHARACTER_META = {
  ichika: { label: "一果", icon: "🍓" },
  hatsune: { label: "初音", icon: "🌸" },
  kiina: { label: "キイナ", icon: "⚡" },
  boatstrikers: { label: "BoatStrikers", icon: "🚤" },
};

const VERIFY_META = {
  pending: { label: "検証待ち", color: "#b7791f", bg: "#fff8e1" },
  verified: { label: "検証済み", color: "#147d45", bg: "#e9f8ef" },
  rejected: { label: "自動ブロック", color: "#b42318", bg: "#fff0ee" },
};

const RESULT_META = {
  scheduled: "予定・未開催",
  running: "開催中",
  confirmed: "結果確定",
  cancelled: "中止",
  unknown: "結果状態不明",
};

function getClient(write = false) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = write ? process.env.SUPABASE_SERVICE_ROLE_KEY : (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function jstDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).format(new Date(value));
}

async function loadRows() {
  const client = getClient(false);
  if (!client) return { rows: [], error: "Supabase環境変数がありません。" };
  const { data, error } = await client
    .from("bs_news_candidates")
    .select("id,collected_at,published_at,title,summary,source_name,source_url,importance,target_character,verification_status,result_status,verified,verified_at,verification_note,verification_evidence,event_date,venue,race_no,race_deadline,x_candidate,x_character,x_post_text,x_hashtags,x_status")
    .gte("collected_at", new Date(Date.now() - 7 * 86400000).toISOString())
    .order("collected_at", { ascending: false })
    .limit(150);
  return { rows: data || [], error: error?.message || null };
}

async function updateXStatus(formData) {
  "use server";
  const id = Number(formData.get("id"));
  const xStatus = String(formData.get("xStatus") || "draft");
  if (!Number.isFinite(id) || !["draft", "approved", "posted", "rejected"].includes(xStatus)) redirect("/admin/editorial/x?error=invalid");
  const client = getClient(true);
  if (!client) redirect("/admin/editorial/x?error=missing_service_key");
  const { error } = await client.from("bs_news_candidates").update({ x_status: xStatus, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) redirect(`/admin/editorial/x?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/admin/editorial/x");
  redirect("/admin/editorial/x?saved=1");
}

export default async function EditorialXPage({ searchParams }) {
  const params = await searchParams;
  const { rows, error } = await loadRows();
  const verified = rows.filter((r) => r.verification_status === "verified").length;
  const blocked = rows.filter((r) => r.verification_status === "rejected").length;
  const drafts = rows.filter((r) => r.x_status === "draft").length;

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.hero}>
          <div>
            <span className={styles.eyebrow}>BOATSTRIKERS VERIFIED X DESK</span>
            <h1>検証済みX投稿候補</h1>
            <p>Geminiの収集候補を自動検証し、検証を通過した事実だけからX投稿案を作ります。</p>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link href="/admin/editorial" className={styles.backButton}>AI編集部へ</Link>
            <Link href="/admin" className={styles.backButton}>管理トップへ</Link>
          </div>
        </header>

        <section className={styles.summaryGrid}>
          <article><span>直近7日</span><strong>{rows.length}</strong><small>件</small></article>
          <article><span>検証済み</span><strong>{verified}</strong><small>件</small></article>
          <article><span>自動ブロック</span><strong>{blocked}</strong><small>件</small></article>
          <article><span>X下書き</span><strong>{drafts}</strong><small>件</small></article>
        </section>

        {params?.saved === "1" && <div className={styles.success}>✓ X投稿候補の状態を保存しました。</div>}
        {(error || params?.error) && <div className={styles.error}>{error || `保存エラー：${params.error}`}</div>}

        <section className={styles.newsList}>
          {rows.length === 0 ? <div className={styles.empty}>候補はありません。</div> : rows.map((row) => {
            const verify = VERIFY_META[row.verification_status] || VERIFY_META.pending;
            const char = CHARACTER_META[row.x_character || row.target_character] || CHARACTER_META.boatstrikers;
            const hashtags = Array.isArray(row.x_hashtags) ? row.x_hashtags.join(" ") : "";
            return (
              <article className={styles.newsCard} key={row.id}>
                <div className={styles.cardTop}>
                  <div className={styles.badges}>
                    <span className={styles.characterBadge}>{char.icon} {char.label}</span>
                    <span style={{ color: verify.color, background: verify.bg, borderRadius: 999, padding: "6px 10px", fontWeight: 800, fontSize: 12 }}>{verify.label}</span>
                    <span style={{ borderRadius: 999, padding: "6px 10px", background: "#eef4ff", color: "#2b5aa5", fontWeight: 800, fontSize: 12 }}>{RESULT_META[row.result_status] || row.result_status}</span>
                    {row.x_status && row.x_status !== "none" && <span className={`${styles.statusBadge} ${row.x_status === "approved" || row.x_status === "posted" ? styles.approved : styles.pending}`}>X: {row.x_status}</span>}
                  </div>
                  <time>{jstDate(row.published_at || row.collected_at)}</time>
                </div>

                <h2>{row.title}</h2>
                {row.summary && <p className={styles.summary}>{row.summary}</p>}

                <div className={styles.meta}>
                  {row.event_date && <span>対象日：{row.event_date}</span>}
                  {row.venue && <span>場：{row.venue}</span>}
                  {row.race_no && <span>R：{row.race_no}R</span>}
                  {row.race_deadline && <span>締切：{jstDate(row.race_deadline)}</span>}
                  {row.verification_note && <span>検証：{row.verification_note}</span>}
                </div>

                {row.x_post_text && (
                  <div style={{ marginTop: 16, padding: 16, borderRadius: 14, background: "#f7f9fc", border: "1px solid #dce4ef" }}>
                    <strong style={{ display: "block", marginBottom: 8 }}>X投稿案</strong>
                    <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.75 }}>{row.x_post_text}</div>
                    {hashtags && <div style={{ marginTop: 8, color: "#3568a8" }}>{hashtags}</div>}
                  </div>
                )}

                <div className={styles.actions}>
                  <div><a href={row.source_url} target="_blank" rel="noreferrer" className={styles.sourceButton}>元記事を見る ↗</a></div>
                  {row.x_post_text && (
                    <form action={updateXStatus}>
                      <input type="hidden" name="id" value={row.id} />
                      <button name="xStatus" value="approved" className={styles.approveButton}>X採用</button>
                      <button name="xStatus" value="rejected" className={styles.rejectButton}>X不採用</button>
                      <button name="xStatus" value="draft" className={styles.resetButton}>下書きへ戻す</button>
                    </form>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      </div>
    </main>
  );
}
