// 日次結果まとめ記事（hatsune_news, source_key = bs-daily-result-YYYY-MM-DD）の保存。
// ・新しい日付：公開状態で新規作成（従来どおり）
// ・既存の公開記事：本文などの内容だけ更新し、published_at と is_published は変えない
// ・manual 記事・ai 記事・非公開記事：一切書き換えない（再公開もしない）
// 読み取りから更新までの間に manual / ai 化・非公開化されても上書きしないよう、更新の WHERE 条件でも保護条件を確かめる。

import { DAILY_RESULT_UPDATABLE_SOURCES, dailyResultProtectionReason } from "./newsRewritePolicy.js";

const UNIQUE_VIOLATION = "23505";
const MAX_ATTEMPTS = 3;

// content: title, list_headline, summary, article_body, category, source_type, source_name, source_url, place, is_featured, priority
export async function saveDailyResultArticle(client, { sourceKey, content, now }) {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const { data: existing, error: readError } = await client
      .from("hatsune_news")
      .select("id,is_published,published_at,article_body_source")
      .eq("source_key", sourceKey)
      .maybeSingle();
    if (readError) throw readError;

    if (!existing) {
      const { data: inserted, error: insertError } = await client
        .from("hatsune_news")
        .insert({
          ...content,
          source_key: sourceKey,
          article_body_source: "bs_data_template",
          published_at: now,
          collected_at: now,
          is_published: true,
          updated_at: now,
        })
        .select("id")
        .single();
      if (!insertError) return { action: "inserted", id: inserted.id };
      // 同じ日付の記事が同時に作られた：既存記事として判定し直す
      if (insertError.code === UNIQUE_VIOLATION) continue;
      throw insertError;
    }

    const reason = dailyResultProtectionReason(existing);
    if (reason) return { action: "skipped", reason, id: existing.id };

    const { data: updated, error: updateError } = await client
      .from("hatsune_news")
      .update({ ...content, article_body_source: "bs_data_template", updated_at: now })
      .eq("id", existing.id)
      .eq("is_published", true)
      .in("article_body_source", DAILY_RESULT_UPDATABLE_SOURCES)
      .select("id");
    if (updateError) throw updateError;
    if ((updated || []).length === 1) return { action: "updated", id: existing.id };
    // 読み取り後に manual 化・非公開化・削除された：読み直して判定する（上書きはしない）
  }
  return { action: "skipped", reason: "concurrent_change", id: null };
}

// 日次結果集計（bs_daily_result_digests）の保存。
// 記事IDが取れたときは従来どおり upsert する。取れなかったとき（競合が続いた場合）は
// 既存行の news_id を null で消さないよう、news_id を含めずに UPDATE し、行がなければ news_id なしで INSERT する。
// row には news_id を含めない。
export async function saveDailyResultDigestRow(client, row, newsId) {
  if (newsId != null) {
    const { error } = await client.from("bs_daily_result_digests").upsert({ ...row, news_id: newsId }, { onConflict: "race_date" });
    if (error) throw error;
    return { action: "upserted" };
  }
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const { data: updated, error: updateError } = await client
      .from("bs_daily_result_digests")
      .update(row)
      .eq("race_date", row.race_date)
      .select("id");
    if (updateError) throw updateError;
    if ((updated || []).length > 0) return { action: "updated_keep_news_id" };
    const { error: insertError } = await client.from("bs_daily_result_digests").insert(row);
    if (!insertError) return { action: "inserted_without_news_id" };
    // 同じ日付の集計が同時に作られた：UPDATE からやり直す
    if (insertError.code !== UNIQUE_VIOLATION) throw insertError;
  }
  throw new Error(`${row.race_date} の日次結果集計を保存できませんでした（競合が続きました）。`);
}
