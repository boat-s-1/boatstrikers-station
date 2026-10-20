// Which stored official pages a draft was made from, and whether this generation fetched them again (PHASE 5.3).
// The record lives in source_pack.refresh, written once when the draft is made, so it is shown again on every reload.
// It is never sent to the AI (buildInput picks its own fields) and never changes a score or the approval guards.
//
// status, per source:
// - stored_within_7_days: no fetch of this page was tried, and the stored page is under 7 days old. Not "the latest".
// - stored_not_refetched: no fetch of this page was tried, and the stored page is older than 7 days (another page under
//   7 days old meant nothing was fetched, or this URL was not fetched this time).
// - refreshed: fetched again in this generation, and that very fetch is the one used.
// - stored_after_failed_refresh: fetched again in this generation, the fetch failed, and an older stored page was used.
// status, for the draft (the least reassuring case): stored_after_failed_refresh when any source is; else
// refreshed_with_unused_failures when a URL failed that the draft does not use (listed apart in unused_failures, no
// warning); else stored_not_refetched / stored_within_7_days when any source is; else refreshed (every page used was
// fetched in this generation).
// A draft with no record (made before PHASE 5.3) is shown as having none: never as refreshed, never as fine.

export const REFRESH_STATUS = {
  stored_within_7_days: "7日以内の保存済みデータを使用",
  stored_not_refetched: "7日を超える保存済みデータを使用（再取得は試みていない）",
  refreshed: "この生成のときに取得したデータを使用",
  refreshed_with_unused_failures: "使用した出典はこの生成のときに取得（使用しなかったURLの取得に失敗）",
  stored_after_failed_refresh: "再取得に失敗し、保存済みデータを使用",
};
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const jst = iso => new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
const sameTime = (a, b) => Boolean(a && b) && Date.parse(a) === Date.parse(b);

// The reason shown to editors: the fetcher's own fixed wording, never an underlying error text (host names, proxy or
// network details).
const PUBLIC_REASONS = [
  /^時間内に応答がありませんでした。$/, /^取得に失敗しました（HTTP \d{3}）。$/, /^robots\.txt を確認できませんでした。/, /^robots\.txt で取得が許可されていません。/,
  /^転送先があります。/, /^HTMLまたはテキストではありません。$/, /^本文をほとんど取得できませんでした/, /^https の正しいURLではありません。$/, /^登録されていないサイトです。/,
];
export const publicReason = error => {
  const text = String(error ?? "");
  return PUBLIC_REASONS.some(re => re.test(text)) ? text.slice(0, 120) : "取得できませんでした。";
};

// The sources a stored page supplied (official pages; not the repository copy nor manual sources).
const fetchedSources = pack => (pack.sources || []).filter(s => s.kind !== "repository_dataset" && s.kind !== "manual" && s.fetched_at);

// refresh: null when no fetch was tried, else { attempted_at, results: [{ url, ok, fetched_at, error, document_id }] }.
export function refreshRecord({ pack, refresh }) {
  const results = (refresh?.results || []).map(r => ({ url: r.url, ok: Boolean(r.ok), attempted_at: r.fetched_at, document_id: r.document_id ?? null,
    ...(r.ok ? {} : { reason: publicReason(r.error) }) }));
  const byAge = s => Date.parse(pack.built_at) - Date.parse(s.fetched_at) < WEEK_MS ? "stored_within_7_days" : "stored_not_refetched";
  const sources = fetchedSources(pack).map(s => {
    const tried = results.filter(r => r.url === s.url);
    // Fresh only when the page used is the very one this generation fetched (by id where the store gives one, else by time).
    const fresh = tried.some(r => r.ok && (r.document_id && s.document_id ? r.document_id === s.document_id : sameTime(r.attempted_at, s.fetched_at)));
    const failed = tried.filter(r => !r.ok).at(-1);
    const status = fresh ? "refreshed" : failed ? "stored_after_failed_refresh" : byAge(s);
    const period = pack.official?.source_id === s.id ? pack.official.period : null;
    return { source_id: s.id, url: s.url, document_id: s.document_id ?? null, fetched_at: s.fetched_at, content_sha256: s.content_sha256 ?? null, period, status,
      ...(status === "stored_after_failed_refresh" ? { refresh_attempted_at: failed.attempted_at, reason: failed.reason } : {}) };
  });
  // URLs that failed and supplied nothing to the draft (no stored page either): recorded apart, never a source warning.
  const unused_failures = results.filter(r => !r.ok && !sources.some(s => s.url === r.url)).map(r => ({ url: r.url, attempted_at: r.attempted_at, reason: r.reason }));
  // The draft takes the least reassuring case: "refreshed" only when every page used was fetched in this generation.
  const has = status => sources.some(s => s.status === status);
  const status = has("stored_after_failed_refresh") ? "stored_after_failed_refresh" : unused_failures.length ? "refreshed_with_unused_failures"
    : has("stored_not_refetched") ? "stored_not_refetched" : has("stored_within_7_days") || !refresh ? "stored_within_7_days" : "refreshed";
  return { status, attempted_at: refresh?.attempted_at ?? null, results, sources, unused_failures };
}

// Stop before the AI when a fetch failed and the official data the theme needs is not stored either (never falling back
// to the repository copy, which has no retrieval time). requiredUrl: the page the theme's data comes from (the stadium
// data page), when it has one; a theme without it needs at least one official page. A failed URL with nothing stored is
// not in the draft's sources, so it may be left out only when it is not the required page. null when the draft may be made.
export function refreshStop({ pack, refresh, requiredUrl = null }) {
  const failed = (refresh?.results || []).filter(r => !r.ok);
  if (!failed.length) return null;
  const used = fetchedSources(pack);
  const requiredMissing = requiredUrl ? !used.some(s => s.url === requiredUrl) : !used.length;
  if (!requiredMissing) return null;
  const reasons = [...new Set(failed.map(r => publicReason(r.error)))].join("、");
  return `公式情報の再取得に失敗し、使える保存済みの公式データもありません（${reasons}）。時間をおいて「公式情報」から取得してから生成してください。`;
}

// Warnings for the sources used after a failed fetch (shown again on every check of the draft; no score, no block).
export function refreshIssues(pack) {
  const labels = new Map((pack.sources || []).map(s => [s.id, s.label]));
  return (pack.refresh?.sources || []).filter(s => s.status === "stored_after_failed_refresh").map(s => ({ level: "warning", code: "official_refresh_failed",
    message: `最新情報の再取得に失敗しました（${jst(s.refresh_attempted_at)}・${s.reason}）。保存済みの公式データ（${labels.get(s.source_id) ?? s.url}、取得日時 ${jst(s.fetched_at)}${s.period ? `、集計期間 ${s.period}` : ""}）を使って作成しています。承認前に、公式ページの数値と集計期間が変わっていないか確認してください。` }));
}

// One line for the run log (status of the draft's record).
export const refreshNote = status => ({ stored_after_failed_refresh: "（再取得失敗・保存済みデータを使用）", refreshed_with_unused_failures: "（使用しなかったURLの取得失敗あり）" })[status] ?? "";
