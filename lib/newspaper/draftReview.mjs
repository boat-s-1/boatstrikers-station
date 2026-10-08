// 管理画面「前日版 自動下書き」用の読み取り専用データ取得。
import { AUTO_DRAFT_GENERATOR, AUTO_DRAFT_LOG_TYPE, EDITION } from "./autoDraft.mjs";
import { NEWSPAPER_TABLE } from "./publicationStore.mjs";

export const OUTCOME_LABELS = {
  created: "下書きを作成",
  would_generate: "作成予定（dry-run）",
  limit_reached: "本日分は作成済み",
  no_candidates: "候補なし",
  no_eligible_race: "条件を満たすレースなし",
  ai_failed: "AI生成に失敗",
  fact_guard_rejected: "数値の照合で不合格",
  save_failed: "保存に失敗",
  exists_concurrent: "同時実行で作成済み",
  deferred_time_budget: "時間切れで次回へ",
};

export const SKIP_LABELS = {
  invalid_probability: "確率が不正",
  invalid_course: "場コードが不正",
  invalid_race_no: "レース番号が不正",
  invalid_rank: "順位が不正",
  exists: "既に新聞あり",
  race_finished: "結果確定済み",
  race_event_missing: "レース情報なし",
  closing_time_unknown: "締切時刻が不明",
  race_closed: "締切済み・締切直前",
  retry_limit: "失敗回数の上限",
  entries_incomplete: "出走表が6艇揃っていない",
  insights_fallback: "艇別データ不足",
  insights_unverifiable: "艇別データを照合できない",
};

export async function loadDraftReview(supabase, date) {
  const [newspapers, logs] = await Promise.all([
    supabase.from(NEWSPAPER_TABLE)
      .select("id,slug,race_date,course_name,race_no,character_key,edition,title,summary,article_body,note_title,note_body,x_post,shorts_script,status,published_at,updated_at,source_payload")
      .eq("race_date", date).eq("edition", EDITION)
      .order("character_key", { ascending: true }).order("race_no", { ascending: true }),
    supabase.from("bs_news_sync_logs")
      .select("id,run_at,found_count,verified_count,rejected_count,error_count,details")
      .eq("run_type", AUTO_DRAFT_LOG_TYPE)
      .order("run_at", { ascending: false })
      .limit(100),
  ]);
  if (newspapers.error) throw new Error(`新聞の取得に失敗しました: ${newspapers.error.message}`);
  if (logs.error) throw new Error(`実行ログの取得に失敗しました: ${logs.error.message}`);
  return {
    newspapers: (newspapers.data || []).map((row) => ({ ...row, isAuto: row.source_payload?.generator === AUTO_DRAFT_GENERATOR })),
    runs: (logs.data || []).filter((log) => log.details?.date === date).slice(0, 30),
  };
}
