// /news の URL 組み立て。既存の ?category= / ?q= を維持し、担当キャラ絞り込みと2ページ目以降だけ追加パラメーターを付ける。
export function newsListHref({ category = "all", character = "", event = "", q = "", page = 1 } = {}) {
  const params = new URLSearchParams();
  params.set("category", category);
  if (character) params.set("character", character);
  if (event) params.set("event", event);
  if (q) params.set("q", q);
  if (page > 1) params.set("page", String(page));
  return `/news?${params.toString()}`;
}
