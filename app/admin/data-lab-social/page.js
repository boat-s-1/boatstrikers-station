
import EditorialCopyReview from "../components/EditorialCopyReview";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { generateDataLabSocialOutputs } from "../../../lib/dataLabSocialGenerator";
import { claimDataLabGeneration, releaseDataLabClaim, GENERATING_STATUS, STALE_MS } from "../../../lib/dataLabSocialClaim";
import { getHatsuneNews } from "../../hatsune/newsData";
import { isAdminAuthenticated } from "../sync/_lib/adminAuth";
import ClientActions from "./ClientActions";
import GenerateButton from "./GenerateButton";
import PromptBuilder from "./PromptBuilder";
import XPostImagePromptBuilder from "./XPostImagePromptBuilder";
import MinamoComicPromptBuilder from "./MinamoComicPromptBuilder";
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

function jstDate(value) {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
  } catch {
    return "";
  }
}

function hasCharacterDetails(item) {
  const p = item?.image_payload || {};
  const d = p.character_details;
  return Boolean(d?.ichika && d?.hatsune?.detection_method === "six_entries_gender_code_priority" && d?.kiina && p.template === "data_lab_yesterday_numbers_v3");
}

const OUTPUT_COLUMNS = "id,race_date,status,x_post_text,short_script,image_payload,hashtags,generated_at,updated_at";

// 表示は読み取りのみ。生成は下の generateOutput（ボタン）からだけ行う。
async function loadOutput(date) {
  const client = getClient();
  if (!client) return { item: null, digest: null, history: [], error: "Supabase環境変数がありません。" };
  const [{ data: item, error }, { data: digest }, { data: history }] = await Promise.all([
    client.from("bs_data_lab_social_outputs").select(OUTPUT_COLUMNS).eq("race_date", date).maybeSingle(),
    client.from("bs_daily_result_digests").select("id,status,generated_at").eq("race_date", date).maybeSingle(),
    client.from("bs_data_lab_social_outputs").select("race_date").order("race_date", { ascending: false }).limit(14),
  ]);
  return { item: item || null, digest: digest || null, history: history || [], error: error?.message || null };
}

async function generateOutput(formData) {
  "use server";
  if (!(await isAdminAuthenticated())) redirect("/admin-login");
  const date = String(formData.get("date") || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) redirect("/admin/data-lab-social");
  const back = `/admin/data-lab-social?date=${date}`;
  if (formData.get("confirm") !== "yes") redirect(`${back}&gen=unconfirmed`);
  const client = getClient();
  if (!client) redirect(`${back}&gen=error&msg=${encodeURIComponent("Supabase環境変数がありません。")}`);
  const { data: digest } = await client.from("bs_daily_result_digests").select("status").eq("race_date", date).maybeSingle();
  if (digest?.status !== "complete") redirect(`${back}&gen=error&msg=${encodeURIComponent(`${date} の日次まとめ（digest）が完了していません。`)}`);
  // 同時実行・二重実行の防止：DB の行を「生成中」にできた要求だけが生成する（lib/dataLabSocialClaim.js）
  const claim = await claimDataLabGeneration(client, date);
  if (!claim.ok) redirect(`${back}&gen=${claim.reason}${claim.message ? `&msg=${encodeURIComponent(claim.message.slice(0, 200))}` : ""}`);
  let message = "";
  try {
    // 日次まとめ（記事）はここでは作らない。digest が無ければエラーで止まる。
    await generateDataLabSocialOutputs({ date, generateDigestIfMissing: false });
  } catch (e) {
    message = e?.message || String(e);
    await releaseDataLabClaim(client, claim).catch(() => {});
  }
  redirect(message ? `${back}&gen=error&msg=${encodeURIComponent(message.slice(0, 200))}` : `${back}&gen=ok`);
}

async function loadNewsForDate(date) {
  try {
    const items = await getHatsuneNews({ limit: 60, category: "all" });
    const sameDay = items.filter((item) => jstDate(item?.published_at) === date);
    if (sameDay.length) return sameDay.slice(0, 12);
    const target = new Date(`${date}T12:00:00+09:00`).getTime();
    return items.filter((item) => {
      const published = new Date(item?.published_at || 0).getTime();
      return Number.isFinite(published) && Math.abs(published - target) <= 36 * 60 * 60 * 1000;
    }).slice(0, 12);
  } catch { return []; }
}

export default async function DataLabSocialAdmin({ searchParams }) {
  const params = await searchParams;
  const selectedDate = /^\d{4}-\d{2}-\d{2}$/.test(String(params?.date || "")) ? String(params.date) : jstYesterday();
  const [{ item, digest, history, error }, newsItems] = await Promise.all([loadOutput(selectedDate), loadNewsForDate(selectedDate)]);
  const p = item?.image_payload || {};
  const stats = Array.isArray(p.stats) ? p.stats : [];
  const ranking = Array.isArray(p.venue_manshu_ranking) ? p.venue_manshu_ranking : [];
  const imageUrl = `/api/admin/data-lab-social-image?date=${encodeURIComponent(selectedDate)}`;
  // 「生成中」の仮の行（中身なし）は未生成として扱う
  const hasContent = Boolean(item?.x_post_text);
  const busy = item?.status === GENERATING_STATUS && Date.now() - new Date(item.updated_at).getTime() < STALE_MS;
  const outdated = hasContent && !hasCharacterDetails(item);
  const genResult = { ok: "DATA LAB の下書きを生成しました。", unconfirmed: "確認のチェックが入っていないため、生成しませんでした。", recent: "直前に生成済みのため、作り直しませんでした（1分後に再度お試しください）。", busy: "ほかの操作で生成中のため、実行しませんでした。", locked: "下書き以外の状態のため、作り直しませんでした。", error: `生成できませんでした：${String(params?.msg || "")}` }[params?.gen] || "";
  const digestReady = digest?.status === "complete";
  const generateForm = (
    <form action={generateOutput} className={styles.empty}>
      <input type="hidden" name="date" value={selectedDate} />
      <p>{digest ? `日次まとめ（digest）：${digestReady ? "完了" : `${digest.status}（完了後に作成できます）`}` : "日次まとめ（digest）：未生成。DATA LAB は日次まとめの後に作成できます（ここでは日次まとめを作りません）。"}</p>
      <label><input type="checkbox" name="confirm" value="yes" /> {selectedDate} の DATA LAB 下書きを{hasContent ? "作り直す" : "生成する"}（X投稿・台本は下書き保存で、公開はしません）</label>
      <p><GenerateButton disabled={!digestReady || busy}>DATA LAB 下書きを{hasContent ? "再生成" : "生成"}</GenerateButton></p>
    </form>
  );

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.topbar}>
          <Link href="/admin" className={styles.back}>← 管理TOPへ</Link>
          <Link href="/news?category=result" className={styles.back}>今日の結果を見る →</Link>
        </div>
        <section className={styles.hero}>
          <div><span>BOATSTRIKERS CONTENT STUDIO</span><h1>DATA LAB SNS</h1><p>前日の結果データから作った 9:16画像・X投稿・ショート台本・キャラ別2枚目用の専門集計を確認します。生成はページ下のボタンから行います。</p></div>
          <form className={styles.dateForm} method="get"><input type="date" name="date" defaultValue={selectedDate} /><button type="submit">表示</button></form>
        </section>

        {genResult && <section className={styles.empty}><p>{genResult}</p></section>}
        {busy && <section className={styles.empty}><p>この日の DATA LAB は生成中です。しばらくしてから開き直してください。</p></section>}
        {outdated && <section className={styles.empty}><p>この DATA LAB は旧テンプレートで作られています。必要なら下のボタンで作り直してください。</p></section>}

        {!hasContent ? (
          <>
            <section className={styles.empty}><h2>{selectedDate} のSNS素材はまだありません</h2><p>{error || "このページを開いただけでは生成しません。"}</p></section>
            {generateForm}
          </>
        ) : (
          <>
            <div className={styles.grid}>
              <section className={styles.previewCard}>
                <h2>9:16 SNS画像</h2>
                <div className={styles.previewFrame}><img src={imageUrl} alt={`${selectedDate} DATA LAB SNS画像`} /></div>
                <ClientActions xText={item.x_post_text || ""} shortScript={item.short_script || ""} imageUrl={imageUrl} filename={`boatstrikers-data-lab-${selectedDate}.png`} />
                <p className={styles.note}>左の画像は数値確認用の自動描画版です。右側のDATA LAB画像生成プロンプトでは、共通表紙＋一果/初音/キイナの専門2枚目を作成できます。</p>
              </section>
              <section className={styles.contentCard}>
                <h2>{p.title || "昨日のボートレースを数字で見る"}</h2>
                <div className={styles.statsGrid}>{stats.map((s, i) => <div className={styles.stat} key={`${s.label}-${i}`}><span>{s.label}</span><strong>{s.value}</strong></div>)}</div>
                <div className={styles.section}>
                  <label>万舟が多かった場 TOP5</label>
                  <div className={styles.ranking}>{ranking.length ? ranking.map((r, i) => <div className={styles.rankRow} key={`${r.venue}-${i}`}><span>{i + 1}. {r.venue}</span><strong>{r.count}本</strong></div>) : <div className={styles.rankRow}><span>該当なし</span><strong>0本</strong></div>}</div>
                </div>
                <EditorialCopyReview fields={{ x_post_text: item.x_post_text, short_script: item.short_script }} />
                <PromptBuilder payload={p} />
                <XPostImagePromptBuilder payload={p} />
                <div className={styles.section}><label>X投稿文</label><textarea readOnly value={item.x_post_text || ""} /></div>
                <div className={`${styles.section} ${styles.short}`}><label>ショート動画 30秒台本</label><textarea readOnly value={item.short_script || ""} /></div>
              </section>
            </div>
            <MinamoComicPromptBuilder payload={p} newsItems={newsItems} />
            {generateForm}
          </>
        )}

        {history.length > 0 && <section className={styles.history}><h2>最近のDATA LAB</h2><div className={styles.historyList}>{history.map((row) => <Link href={`/admin/data-lab-social?date=${row.race_date}`} key={row.race_date}>{row.race_date}</Link>)}</div></section>}
      </div>
    </main>
  );
}
