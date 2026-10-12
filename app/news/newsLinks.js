// /news の URL 組み立て。既存の ?category= / ?q= を維持し、2ページ目以降だけ ?page= を付ける。
export function newsListHref({ category = "all", q = "", page = 1 } = {}) {
  const params = new URLSearchParams();
  params.set("category", category);
  if (q) params.set("q", q);
  if (page > 1) params.set("page", String(page));
  return `/news?${params.toString()}`;
}
