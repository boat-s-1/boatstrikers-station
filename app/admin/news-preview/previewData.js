// NEWS 新旧比較 Preview のデータ取得（読み取り専用）。公開用の anon クライアントだけを使う（RLS で書き込み不可）。
import { supabase } from "../../bsc2/lib/supabaseClient";
import { buildNewsArticleDraftWithDb } from "../../../lib/newsArticle/draftWithDb";
import { buildPreviewModel } from "../../../lib/newsArticle/preview";

export const PREVIEW_PAGE_SIZE = 40;
const SELECT = "id,title,list_headline,summary,article_body,article_body_source,category,source_type,source_name,source_url,place,published_at";

export async function loadPreviewList({ page = 1 } = {}) {
  if (!supabase) return { models: [], error: "Supabase の公開設定がありません" };
  const from = (page - 1) * PREVIEW_PAGE_SIZE;
  const { data, error } = await supabase
    .from("hatsune_news")
    .select(SELECT)
    .eq("is_published", true)
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("id", { ascending: false })
    .range(from, from + PREVIEW_PAGE_SIZE - 1);
  if (error) return { models: [], error: error.message };
  const cache = new Map();
  const models = [];
  for (const row of data || []) models.push(buildPreviewModel(row, await buildNewsArticleDraftWithDb(row, supabase, { cache })));
  return { models, error: "" };
}

export async function loadPreviewArticle(id) {
  if (!supabase) return { model: null, error: "Supabase の公開設定がありません" };
  const { data, error } = await supabase.from("hatsune_news").select(SELECT).eq("is_published", true).eq("id", id).maybeSingle();
  if (error) return { model: null, error: error.message };
  if (!data) return { model: null, error: "" };
  return { model: buildPreviewModel(data, await buildNewsArticleDraftWithDb(data, supabase)), error: "" };
}
