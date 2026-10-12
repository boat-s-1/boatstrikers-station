import Link from "next/link";
import { notFound } from "next/navigation";
import { INSUFFICIENT_OPTIONS } from "../../../../lib/newsArticle/preview";
import { loadPreviewArticle } from "../previewData";
import styles from "../preview.module.css";

// 管理者限定（app/admin/layout.js の認証）。検索エンジンには載せない。既存の NEWS 画面・記事には反映しない。
export const dynamic = "force-dynamic";
export const metadata = { title: "NEWS 新旧比較 Preview", robots: { index: false, follow: false, noarchive: true, nocache: true } };

function SourceLink({ url, name }) {
  if (!url) return <span>{name || "出典"}</span>;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer nofollow">
      {name || "出典"}で読む ↗
    </a>
  );
}

function Rows({ rows }) {
  return (
    <ul className={styles.rows}>
      {rows.map((r, i) => (
        <li key={`${r.label}-${i}`}>
          <b>{r.label}</b>
          <span>{r.value}</span>
        </li>
      ))}
    </ul>
  );
}

export default async function NewsPreviewDetailPage({ params }) {
  const { id } = await params;
  if (!/^\d+$/.test(String(id))) notFound();
  const { model, error } = await loadPreviewArticle(Number(id));
  if (error) return <main className={styles.page}><p className={styles.error}>取得エラー：{error}</p></main>;
  if (!model) notFound();
  const { article, status, newsFact, dataCheck, editorView, quality, evidence, insufficientOptions } = model;

  return (
    <main className={styles.page}>
      <p className={styles.badge}>PREVIEW（管理者限定・非公開）</p>
      <p><Link href="/admin/news-preview">← 一覧へ</Link></p>
      <h1 className={styles.title}>{article.headline}</h1>
      <p className={styles.meta}>
        ID {article.id}／公開 {article.published} JST／{article.sourceType}・{article.category}／本文の作成元：{article.bodySource || "不明"}／<SourceLink url={article.sourceUrl} name={article.sourceName} />
      </p>

      <section className={styles.verdict}>
        <span className={styles[`tone_${status.tone}`]}>{status.label}</span>
        <span>{status.note}</span>
      </section>

      <div className={styles.compare}>
        <section className={styles.panel}>
          <h2>現在の本文</h2>
          {model.legacyIssues.length ? <p className={styles.issueLine}>問題：{model.legacyIssues.join("・")}</p> : null}
          <div className={styles.body}>{model.currentBody || "（本文なし）"}</div>
        </section>

        <section className={styles.panel}>
          <h2>新しい試作</h2>
          {newsFact?.lead ? <p className={styles.leadText}>{newsFact.lead}</p> : null}
          <h3>NEWS FACT <small>出典の見出し・要約で確認できる事実</small></h3>
          {newsFact?.points?.length ? <Rows rows={newsFact.points} /> : <p className={styles.empty}>{newsFact?.lead ? "リード文のみ" : "確認できる事実なし"}</p>}
          <h3>DATA CHECK <small>BoatStrikers レースDB</small></h3>
          {dataCheck ? <Rows rows={dataCheck.rows} /> : <p className={styles.empty}>省略：{evidence.skipped || "照合できない"}</p>}
          <h3>EDITOR&apos;S VIEW</h3>
          {editorView ? (
            <p className={styles.view}>
              <b>{editorView.name}</b>
              {editorView.text}
            </p>
          ) : (
            <p className={styles.empty}>省略（材料なし、または担当分野に合わない）</p>
          )}
        </section>
      </div>

      <section className={styles.panel}>
        <h2>品質チェック</h2>
        {quality.issues.length ? (
          <ul className={styles.qualityList}>
            {quality.issues.map((i, n) => (
              <li key={n} className={i.severity === "error" ? styles.qError : styles.qWarn}>
                [{i.severity === "error" ? "エラー" : "注意"}] {i.code}：{i.detail}
              </li>
            ))}
          </ul>
        ) : (
          <p>問題なし（出典名・定型文・女子テンプレート混入・丸写し・根拠のない数値・予想表現・未確認の優勝戦/グレード・重複）</p>
        )}
      </section>

      <section className={styles.panel}>
        <h2>照合根拠</h2>
        <p className={styles.note}>読み取り範囲：{evidence.request}</p>
        {evidence.loadError ? <p className={styles.error}>読み取りエラー：{evidence.loadError}（DATA CHECK は省略）</p> : null}
        {evidence.truncated.length ? <p className={styles.error}>取得件数が上限に達した表：{evidence.truncated.join("・")}（照合に使わない）</p> : null}
        {evidence.checks.length ? (
          <table className={styles.table}>
            <thead>
              <tr><th>項目</th><th>記事の記載</th><th>DB</th><th>結果</th></tr>
            </thead>
            <tbody>
              {evidence.checks.map((c, n) => (
                <tr key={n}>
                  <td>{c.item}</td><td>{c.claim}</td><td>{c.db}</td>
                  <td className={c.result === "一致" ? styles.okText : c.result === "不一致" ? styles.ngText : styles.mutedText}>{c.result}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p className={styles.empty}>照合項目なし</p>}
        {evidence.series.length ? (
          <>
            <h3>使用した出走データ（今節）</h3>
            <table className={styles.table}>
              <thead><tr><th>日付</th><th>R</th><th>艇</th><th>進入</th><th>ST</th><th>着</th></tr></thead>
              <tbody>
                {evidence.series.map((e, n) => (
                  <tr key={n}><td>{e.date}</td><td>{e.race}</td><td>{e.boat}</td><td>{e.course}</td><td>{e.st}</td><td>{e.finish}</td></tr>
                ))}
              </tbody>
            </table>
          </>
        ) : null}
      </section>

      {insufficientOptions ? (
        <section className={styles.panel}>
          <h2>材料不足の記事の表示案（比較用・自動では切り替えない）</h2>
          <div className={styles.options}>
            {INSUFFICIENT_OPTIONS.map((o) => (
              <article key={o.key} className={styles.option}>
                <h3>案{o.key}：{o.title}</h3>
                <p className={styles.note}>{o.note}</p>
                <div className={styles.mock}>
                  {o.key === "A" ? (
                    <>
                      <p className={styles.mockHead}>{article.headline}</p>
                      {insufficientOptions.A.facts.length ? <ul>{insufficientOptions.A.facts.map((f, n) => <li key={n}>{f}</li>)}</ul> : <p className={styles.empty}>確認済みの事実なし（見出しと出典リンクのみ）</p>}
                      <p><SourceLink url={insufficientOptions.A.sourceUrl} name={insufficientOptions.A.sourceName} /></p>
                    </>
                  ) : o.key === "B" ? (
                    <>
                      <p className={styles.mockHead}>{article.headline}</p>
                      {insufficientOptions.B.issues.length ? <p className={styles.issueLine}>残る問題：{insufficientOptions.B.issues.join("・")}</p> : null}
                      <div className={styles.bodySmall}>{insufficientOptions.B.body || "（本文なし）"}</div>
                    </>
                  ) : (
                    <>
                      <p className={styles.mockList}>
                        <span>{insufficientOptions.C.headline}</span>
                        <SourceLink url={insufficientOptions.C.sourceUrl} name={insufficientOptions.C.sourceName} />
                      </p>
                      <p className={styles.note}>一覧の行から詳細ページへのリンクを出さない／詳細ページは noindex。</p>
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
