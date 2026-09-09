import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { generateDataLabSocialOutputs } from "../../../lib/dataLabSocialGenerator";
import ClientActions from "./ClientActions";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function jstYesterday() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const obj = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  const d = new Date(`${obj.year}-${obj.month}-${obj.day}T12:00:00+09:00`);
  d.setUTCDate(d.getUTCDate() - 1);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

async function loadOutput(date) {
  const client = getClient();
  if (!client) return { item: null, history: [], error: "Supabase環境変数がありません。" };

  let { data: item, error } = await client
    .from("bs_data_lab_social_outputs")
    .select("id,race_date,status,x_post_text,short_script,image_payload,hashtags,generated_at")
    .eq("race_date", date)
    .maybeSingle();

  if (!error && !item) {
    try {
      await generateDataLabSocialOutputs({ date });
      const retry = await client
        .from("bs_data_lab_social_outputs")
        .select("id,race_date,status,x_post_text,short_script,image_payload,hashtags,generated_at")
        .eq("race_date", date)
        .maybeSingle();
      item = retry.data;
      error = retry.error;
    } catch (e) {
      error = { message: e?.message || String(e) };
    }
  }

  const { data: history } = await client
    .from("bs_data_lab_social_outputs")
    .select("race_date")
    .order("race_date", { ascending: false })
    .limit(14);

  return { item: item || null, history: history || [], error: error?.message || null };
}

export default async function DataLabSocialAdmin({ searchParams }) {
  const params = await searchParams;
  const selectedDate = /^\d{4}-\d{2}-\d{2}$/.test(String(params?.date || "")) ? String(params.date) : jstYesterday();
  const { item, history, error } = await loadOutput(selectedDate);
  const p = item?.image_payload || {};
  const stats = Array.isArray(p.stats) ? p.stats : [];
  const ranking = Array.isArray(p.venue_manshu_ranking) ? p.venue_manshu_ranking : [];
  const imageUrl = `/api/admin/data-lab-social-image?date=${encodeURIComponent(selectedDate)}`;

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.topbar}>
          <Link href="/admin" className={styles.back}>← 管理TOPへ</Link>
          <Link href="/news?category=result" className={styles.back}>今日の結果を見る →</Link>
        </div>

        <section className={styles.hero}>
          <div>
            <span>BOATSTRIKERS CONTENT STUDIO</span>
            <h1>DATA LAB SNS</h1>
            <p>前日の結果データから、X・ショート台本・9:16画像をまとめて確認できます。</p>
          </div>
          <form className={styles.dateForm} method="get">
            <input type="date" name="date" defaultValue={selectedDate} />
            <button type="submit">表示</button>
          </form>
        </section>

        {!item ? (
          <section className={styles.empty}>
            <h2>{selectedDate} のSNS素材を生成できませんでした</h2>
            <p>{error || "日次結果集計がまだ完了していない可能性があります。"}</p>
            <p className={styles.note}>結果が全レース確定してから再度開くと、自動生成を試みます。</p>
          </section>
        ) : (
          <>
            <div className={styles.grid}>
              <section className={styles.previewCard}>
                <h2>9:16 SNS画像</h2>
                <div className={styles.previewFrame}><img src={imageUrl} alt={`${selectedDate} DATA LAB SNS画像`} /></div>
                <ClientActions xText={item.x_post_text || ""} shortScript={item.short_script || ""} imageUrl={imageUrl} filename={`boatstrikers-data-lab-${selectedDate}.png`} />
                <p className={styles.note}>画像は1080×1920で自動描画されます。数値が変われば画像も自動で更新されます。</p>
              </section>

              <section className={styles.contentCard}>
                <h2>{p.title || "昨日のボートレースを数字で見る"}</h2>
                <div className={styles.statsGrid}>
                  {stats.map((s, i) => <div className={styles.stat} key={`${s.label}-${i}`}><span>{s.label}</span><strong>{s.value}</strong></div>)}
                </div>

                <div className={styles.section}>
                  <label>万舟が多かった場 TOP5</label>
                  <div className={styles.ranking}>
                    {ranking.length ? ranking.map((r, i) => <div className={styles.rankRow} key={`${r.venue}-${i}`}><span>{i + 1}. {r.venue}</span><strong>{r.count}本</strong></div>) : <div className={styles.rankRow}><span>該当なし</span><strong>0本</strong></div>}
                  </div>
                </div>

                <div className={styles.section}>
                  <label>X投稿文</label>
                  <textarea readOnly value={item.x_post_text || ""} />
                </div>

                <div className={`${styles.section} ${styles.short}`}>
                  <label>ショート動画 30秒台本</label>
                  <textarea readOnly value={item.short_script || ""} />
                </div>
              </section>
            </div>
          </>
        )}

        {history.length > 0 && (
          <section className={styles.history}>
            <h2>最近のDATA LAB</h2>
            <div className={styles.historyList}>{history.map((row) => <Link href={`/admin/data-lab-social?date=${row.race_date}`} key={row.race_date}>{row.race_date}</Link>)}</div>
          </section>
        )}
      </div>
    </main>
  );
}
