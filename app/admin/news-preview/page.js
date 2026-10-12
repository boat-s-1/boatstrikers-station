import Link from "next/link";
import { PREVIEW_STATUS_LABELS, summarizePreviewList } from "../../../lib/newsArticle/preview";
import { PREVIEW_PAGE_SIZE, loadPreviewList } from "./previewData";
import styles from "./preview.module.css";

// 管理者限定（app/admin/layout.js の認証）。検索エンジンには載せない。既存の NEWS 画面・記事には反映しない。
export const dynamic = "force-dynamic";
export const metadata = { title: "NEWS 新旧比較 Preview", robots: { index: false, follow: false, noarchive: true, nocache: true } };

const FILTERS = [["all", "すべて"], ["ready", "採用可"], ["needs_review", "要確認"], ["insufficient", "材料不足"]];

export default async function NewsPreviewListPage({ searchParams }) {
  const params = (await searchParams) || {};
  const page = Math.max(1, Math.min(100, Number.parseInt(params.page || "1", 10) || 1));
  const status = FILTERS.some(([key]) => key === params.status) ? params.status : "all";
  const { models, error } = await loadPreviewList({ page });
  const counts = summarizePreviewList(models);
  const shown = status === "all" ? models : models.filter((m) => m.status.key === status);
  const href = (next) => `/admin/news-preview?${new URLSearchParams({ ...(next.status !== "all" ? { status: next.status } : {}), ...(next.page > 1 ? { page: String(next.page) } : {}) })}`;

  return (
    <main className={styles.page}>
      <p className={styles.badge}>PREVIEW（管理者限定・非公開）</p>
      <h1 className={styles.title}>NEWS 新旧比較</h1>
      <p className={styles.lead}>
        公開記事の現在の本文と、PHASE 1 の試作（NEWS FACT／DATA CHECK／EDITOR&apos;S VIEW）を並べて確認します。本番の記事・NEWS 画面には反映しません。レースデータは公開用の読み取りキーで照合しています。
      </p>
      {error ? <p className={styles.error}>取得エラー：{error}</p> : null}
      <nav className={styles.filters}>
        {FILTERS.map(([key, label]) => (
          <Link key={key} href={href({ status: key, page })} className={key === status ? styles.filterOn : styles.filter}>
            {label}
            {key !== "all" ? <small>{counts[key] || 0}</small> : <small>{models.length}</small>}
          </Link>
        ))}
      </nav>
      <p className={styles.note}>このページの{PREVIEW_PAGE_SIZE}件（新しい順・{(page - 1) * PREVIEW_PAGE_SIZE + 1}件目から）を判定しています。</p>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>ID</th>
            <th>公開（JST）</th>
            <th>見出し</th>
            <th>判定</th>
            <th>DATA</th>
            <th>VIEW</th>
            <th>旧本文の問題</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((m) => (
            <tr key={m.article.id}>
              <td>{m.article.id}</td>
              <td className={styles.nowrap}>{m.article.published}</td>
              <td>
                <Link href={`/admin/news-preview/${m.article.id}`}>{m.article.headline}</Link>
                <small className={styles.source}>{m.article.sourceName}</small>
              </td>
              <td>
                <span className={styles[`tone_${m.status.tone}`]}>{m.status.label}</span>
              </td>
              <td>{m.dataCheck ? "照合済" : "—"}</td>
              <td>{m.editorView ? m.editorView.name : "—"}</td>
              <td className={styles.issues}>{m.legacyIssues.join("・") || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className={styles.pager}>
        {page > 1 ? <Link href={href({ status, page: page - 1 })}>← 新しい記事</Link> : <span />}
        {models.length === PREVIEW_PAGE_SIZE ? <Link href={href({ status, page: page + 1 })}>古い記事 →</Link> : <span />}
      </div>
      <dl className={styles.legend}>
        {Object.values(PREVIEW_STATUS_LABELS).map((s) => (
          <div key={s.label}>
            <dt>{s.label}</dt>
            <dd>{s.note}</dd>
          </div>
        ))}
      </dl>
    </main>
  );
}
