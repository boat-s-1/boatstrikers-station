import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { jstDate } from "../../../lib/newspaper/autoDraft.mjs";
import { STADIUMS, validDate } from "../../../lib/newspaper/predictionSources.mjs";
import { loadDraftReview, OUTCOME_LABELS, SKIP_LABELS } from "../../../lib/newspaper/draftReview.mjs";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "前日版 自動下書き | BoatStrikers 管理", robots: { index: false, follow: false } };

// 閲覧専用。このページから保存・公開・削除はできない（編集・公開は既存の新聞作成画面で行う）。
const CHARACTER_NAMES = { ichika: "一果", hatsune: "初音", kiina: "キイナ" };
const STATUS_LABELS = { draft: "下書き", published: "公開中", archived: "アーカイブ" };

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase環境変数がありません。");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function jst(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function raceLabel(result) {
  const course = result.course || STADIUMS[Number(result.courseCode) - 1];
  return course && result.raceNo ? `${course}${result.raceNo}R` : "";
}

export default async function NewspaperDraftsPage({ searchParams }) {
  const query = await searchParams;
  const date = validDate(query?.date) ? query.date : jstDate();
  let review = { newspapers: [], runs: [] };
  let loadError = "";
  try {
    review = await loadDraftReview(getClient(), date);
  } catch (error) {
    loadError = error?.message || "読み込みに失敗しました。";
  }
  const autoDrafts = review.newspapers.filter((row) => row.isAuto);
  const others = review.newspapers.filter((row) => !row.isAuto);

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.hero}>
          <div>
            <span className={styles.eyebrow}>NEWSPAPER AUTO DRAFTS</span>
            <h1>前日版 自動下書き</h1>
            <p>レース当日の展示前予想から自動で作られた新聞の下書きと、実行ログを確認します。この画面は閲覧専用です。</p>
          </div>
          <Link href="/admin" className={styles.back}>管理トップへ</Link>
        </header>

        <form className={styles.filter} method="get">
          <label>日付<input type="date" name="date" defaultValue={date} /></label>
          <button type="submit">表示</button>
        </form>

        <p className={styles.notice}>自動下書きは公開されません。公開する場合は、各キャラの新聞作成画面で内容と数値を確認してから保存してください。</p>
        {loadError && <p className={styles.error}>{loadError}</p>}

        <section className={styles.section}>
          <h2>自動下書き（{autoDrafts.length}件）</h2>
          {autoDrafts.length ? <div className={styles.list}>{autoDrafts.map((row) => <DraftCard key={row.id} row={row} />)}</div> : <p className={styles.empty}>この日の自動下書きはありません。</p>}
        </section>

        <section className={styles.section}>
          <h2>実行ログ（{review.runs.length}件）</h2>
          {review.runs.length ? <div className={styles.list}>{review.runs.map((run) => <RunCard key={run.id} run={run} />)}</div> : <p className={styles.empty}>この日の実行ログはありません。</p>}
        </section>

        {others.length > 0 && <section className={styles.section}>
          <h2>手動で作成した前日版（参考・{others.length}件）</h2>
          <div className={styles.list}>{others.map((row) => <DraftCard key={row.id} row={row} />)}</div>
        </section>}
      </div>
    </main>
  );
}

function DraftCard({ row }) {
  const ranking = row.source_payload?.ranking;
  return (
    <article className={styles.card}>
      <div className={styles.cardTop}>
        <div className={styles.badges}>
          <span className={`${styles.badge} ${row.isAuto ? styles.auto : styles.manual}`}>{row.isAuto ? "自動" : "手動"}</span>
          <span className={styles.badge}>{CHARACTER_NAMES[row.character_key] || row.character_key}</span>
          <span className={`${styles.badge} ${styles[row.status] || ""}`}>{STATUS_LABELS[row.status] || row.status}</span>
        </div>
        <span className={styles.meta}>{row.course_name}{row.race_no}R ・ 更新 {jst(row.updated_at)}</span>
      </div>
      <h3>{row.title}</h3>
      {row.summary && <p className={styles.summary}>{row.summary}</p>}
      {ranking && <p className={styles.meta}>
        <span>ランキング：{ranking.ranking_type} #{ranking.rank_no}</span>
        <span>確率：{Number.isFinite(Number(ranking.probability)) ? `${(Number(ranking.probability) * 100).toFixed(1)}%` : "—"}</span>
        <span>公式買い目：{row.source_payload?.official_prediction ? "あり" : "なし"}</span>
        <span>生成：{jst(row.source_payload?.generated_at)}</span>
      </p>}
      <details><summary>サイト記事</summary><pre>{row.article_body || "—"}</pre></details>
      <details><summary>note記事</summary><pre>{[row.note_title, row.note_body].filter(Boolean).join("\n\n") || "—"}</pre></details>
      <details><summary>X投稿・Shorts台本</summary><pre>{[row.x_post, row.shorts_script].filter(Boolean).join("\n\n---\n\n") || "—"}</pre></details>
    </article>
  );
}

function RunCard({ run }) {
  const results = Array.isArray(run.details?.results) ? run.details.results : [];
  return (
    <div className={styles.run}>
      <div className={styles.runHead}>
        <strong>{jst(run.run_at)}</strong>
        <span>作成 {run.verified_count}</span>
        <span>照合不合格 {run.rejected_count}</span>
        <span>エラー {run.error_count}</span>
        <span>確認したレース {run.found_count}</span>
      </div>
      {run.details?.error && <p className={styles.error}>{run.details.error}</p>}
      <ul className={styles.results}>
        {results.map((result) => (
          <li key={result.character}>
            <strong>{CHARACTER_NAMES[result.character] || result.character}</strong>：{OUTCOME_LABELS[result.outcome] || result.outcome}
            {raceLabel(result) && ` （${raceLabel(result)}）`}
            {result.reason && ` — ${result.reason}`}
            {Array.isArray(result.violations) && result.violations.length > 0 && <div className={styles.skips}>照合できなかった箇所：{result.violations.map((v) => `${v.field}「${v.snippet}」${v.reason}`).join(" / ")}</div>}
            {Array.isArray(result.skipped) && result.skipped.length > 0 && <div className={styles.skips}>見送り：{result.skipped.map((s) => `${raceLabel(s)} ${SKIP_LABELS[s.reason] || s.reason}`).join("、")}</div>}
          </li>
        ))}
      </ul>
    </div>
  );
}
