"use client";

import { useState } from "react";
import Link from "next/link";
import { NewsDatedList } from "./NewsHeadlineRow";
import { newsListHref } from "./newsLinks";
import styles from "./newsTheme.module.css";

// 「もっと見る」で次のページを同じ画面に追記する。JS が無い環境では通常のページ送りリンクとして動く。
export default function NewsLoadMore({ category, character, q, initialPage, totalPages, lastDayKey }) {
  const [items, setItems] = useState([]);
  const [lastPage, setLastPage] = useState(initialPage);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const nextPage = lastPage + 1;
  const hasMore = lastPage < totalPages;
  const nextHref = newsListHref({ category, character, q, page: nextPage });

  async function loadMore(event) {
    event.preventDefault();
    if (loading || !hasMore) return;
    setLoading(true);
    setFailed(false);
    try {
      const params = new URLSearchParams({ category, page: String(nextPage) });
      if (character) params.set("character", character);
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

  return (
    <>
      {items.length > 0 && <NewsDatedList items={items} now={Date.now()} previousDayKey={lastDayKey} />}
      {hasMore && (
        <a href={nextHref} onClick={loadMore} className={styles.moreButton} aria-busy={loading}>
          {loading ? "読み込み中…" : "もっと見る"}
        </a>
      )}
      {failed && <p className={styles.moreError}>読み込みに失敗しました。<Link href={nextHref}>次のページを開く</Link></p>}
      {totalPages > 1 && (
        <nav className={styles.pager} aria-label="ニュース一覧のページ送り">
          {initialPage > 1 ? <Link href={newsListHref({ category, character, q, page: initialPage - 1 })}>‹ 前のページ</Link> : <span />}
          <span>{initialPage === lastPage ? `${lastPage} / ${totalPages}ページ` : `${initialPage}〜${lastPage} / ${totalPages}ページ`}</span>
          {hasMore ? <Link href={nextHref}>次のページ ›</Link> : <span />}
        </nav>
      )}
    </>
  );
}
