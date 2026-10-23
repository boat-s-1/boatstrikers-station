// NEWS 記事の本文を自動で書き換えてよいかの判定（依存なし）。

// 日次結果まとめ（dailyResultDigest が作る記事）の source_key 接頭辞
export const DAILY_RESULT_KEY_PREFIX = "bs-daily-result-";

// 日次結果まとめの再生成で上書きしてよい本文の出どころ（自動生成テンプレートのみ）。
// manual・ai・NULL や未知の値はすべて保護側に倒す（本番の article_body_source は NOT NULL）。
// UPDATE の WHERE にも in() で同じ条件を付け、競合時もDB側で保護する。
export const DAILY_RESULT_UPDATABLE_SOURCES = ["bs_data_template", "template"];

export function isDailyResultSourceKey(sourceKey) {
  return typeof sourceKey === "string" && sourceKey.startsWith(DAILY_RESULT_KEY_PREFIX);
}

// 通常の AI 本文リライト（generatePendingHatsuneArticles）の対象か。
// 手入力（manual）・AI 生成済み（ai）に加え、日次結果まとめも対象外にする
// （AI 要約にすると決まり手・事故などのデータが失われ、訂正内容も上書きされるため）。
export function isAiRewriteTarget(row) {
  if (!row) return false;
  if (["manual", "ai"].includes(row.article_body_source)) return false;
  if (isDailyResultSourceKey(row.source_key)) return false;
  return true;
}

// 日次結果まとめの自動再生成で、既存記事を書き換えてはいけない理由（なければ null）。
// manual：人が手で直した（訂正済みを含む）記事。ai：AI 本文の記事。unpublished：非公開にした記事（再公開しない）。
export function dailyResultProtectionReason(row) {
  if (!row) return null;
  const source = row.article_body_source;
  if (source === "manual") return "manual";
  if (source === "ai") return "ai";
  if (!DAILY_RESULT_UPDATABLE_SOURCES.includes(source)) return "protected_source";
  if (row.is_published !== true) return "unpublished";
  return null;
}
