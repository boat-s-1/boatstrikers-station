"use client";

import { useState } from "react";
import Link from "next/link";
import NewsHeadlineRow from "./NewsHeadlineRow";
import { newsListHref } from "./newsLinks";
import styles from "./page.module.css";

// 「もっと見る」で次のページを同じ画面に追記する。JS が無い環境では通常のページ送りリンクとして動く。
export default function NewsLoadMore({ category, q, initialPage, totalPages }) {
  const [items, setItems] = useState([]);
  const [lastPage, setLastPage] = useState(initialPage);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const nextPage = lastPage + 1;
  const hasMore = lastPage < totalPages;

  async function loadMore(event) {
    event.preventDefault();
    if (loading || !hasMore) return;
    setLoading(true);
    setFailed(false);
    try {
      const params = new URLSearchParams({ category, page: String(nextPage) });
      if (q) params.set("q", q);
      const response = await fetch(`/api/news/list?${params.toString()}`);
      if (!response.ok) throw new Error(String(response.status));
      const data = await response.json();
      setItems((current) => {
        const seen = new Set(current.map((item) => String(item.id)));
        return [...current, ...(data.items || []).filter((item) => !seen.has(String(item.id)))];
      });
      setLastPage(data.page || nextPage);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  const now = Date.now();
  return (
    <>
      {items.length > 0 && <div className={styles.headlineList}>{items.map((item) => <NewsHeadlineRow key={item.id} item={item} now={now} />)}</div>}
      {hasMore && (
        <a href={newsListHref({ category, q, page: nextPage })} onClick={loadMore} className={styles.loadMore} aria-busy={loading}>
          {loading ? "読み込み中…" : "もっと見る"}
        </a>
      )}
      {failed && <p className={styles.loadMoreError}>読み込みに失敗しました。<Link href={newsListHref({ category, q, page: nextPage })}>次のページを開く</Link></p>}
      {totalPages > 1 && (
        <nav className={styles.pager} aria-label="ニュース一覧のページ送り">
          {initialPage > 1 ? <Link href={newsListHref({ category, q, page: initialPage - 1 })}>‹ 前のページ</Link> : <span />}
          <span className={styles.pagerStatus}>{initialPage === lastPage ? `${lastPage} / ${totalPages}ページ` : `${initialPage}〜${lastPage} / ${totalPages}ページ`}</span>
          {hasMore ? <Link href={newsListHref({ category, q, page: nextPage })}>次のページ ›</Link> : <span />}
        </nav>
      )}
    </>
  );
}
