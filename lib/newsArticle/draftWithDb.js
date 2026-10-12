// 記事1件ぶんのレースデータを読み取り、試作本文を組み立てる（Preview・検証用）。DB への書き込みはしない。
// cache を渡すと、同じ場・期間の記事でレースデータを使い回す。

import { buildNewsArticleDraft } from "./draft.js";
import { dataCheckRequest } from "./dataCheck.js";
import { extractNewsFacts } from "./newsFacts.js";
import { loadNewsRaceData, raceDataKey } from "./raceDataLoader.js";

export async function buildNewsArticleDraftWithDb(row, supabase, { cache = new Map() } = {}) {
  // 場・日付の判定には選手名の DB 照合が要らないため、まず DB なしで事実を取り出して読み取り範囲を決める。
  const request = dataCheckRequest(row, extractNewsFacts(row));
  const key = raceDataKey(request);
  let raceData = { entries: [], races: [] };
  let loadError = "";
  if (request) {
    try {
      if (!cache.has(key)) cache.set(key, loadNewsRaceData(supabase, request));
      raceData = await cache.get(key);
    } catch (error) {
      cache.delete(key);
      loadError = error?.message || String(error);
    }
  }
  const draft = buildNewsArticleDraft(row, raceData);
  return { draft, request, loadError, raceDataMeta: raceData.meta || null };
}
