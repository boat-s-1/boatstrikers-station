import { createClient } from "@supabase/supabase-js";

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase環境変数がありません。");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function jstToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function normalizeDate(value) {
  const s = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error("date は YYYY-MM-DD 形式で指定してください。");
  return s;
}

export async function generateXNightCandidateSnapshot({ date } = {}) {
  const client = getClient();
  const raceDate = normalizeDate(date || jstToday());

  const [{ data: news, error: newsError }, { data: results, error: resultError }] = await Promise.all([
    client
      .from("bs_news_candidates")
      .select("id,event_date,title,category,summary,venue,race_no,event_type,target_character,x_character,x_post_text,x_hashtags,source_name,verification_status,verified,result_status")
      .eq("event_date", raceDate)
      .eq("verified", true)
      .eq("verification_status", "verified")
      .or("result_status.is.null,result_status.neq.future_or_unconfirmed_result_claim")
      .order("importance", { ascending: false, nullsFirst: false })
      .order("id", { ascending: false }),
    client
      .from("v_bs_x_night_candidates")
      .select("*")
      .eq("race_date", raceDate)
      .eq("effective_result_available", true)
      .in("result_confirmation_reason", ["source_result_available", "complete_result_payload_after_close"])
      .order("trifecta_payout", { ascending: false }),
  ]);

  if (newsError) throw newsError;
  if (resultError) throw resultError;

  const safeNews = news || [];
  const safeResults = results || [];

  const payload = {
    race_date: raceDate,
    generated_at: new Date().toISOString(),
    news: safeNews,
    results: safeResults,
    groups: {
      ichika: safeResults.filter((x) => x.ichika_candidate),
      hatsune: safeResults.filter((x) => x.hatsune_candidate),
      kiina: safeResults.filter((x) => x.kiina_candidate),
      manshu: safeResults.filter((x) => x.is_man_shu),
      outer_wins: safeResults.filter((x) => x.is_outer_win),
      boat5_wins: safeResults.filter((x) => x.is_boat5_win),
      boat1_wins: safeResults.filter((x) => x.is_boat1_win),
      boat1_losses: safeResults.filter((x) => x.is_boat1_loss),
    },
  };

  const { error: upsertError } = await client
    .from("bs_x_night_snapshots")
    .upsert({
      race_date: raceDate,
      news_count: safeNews.length,
      result_count: safeResults.length,
      payload,
      generated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "race_date" });

  if (upsertError) throw upsertError;

  return {
    ok: true,
    race_date: raceDate,
    news_count: safeNews.length,
    result_count: safeResults.length,
    ichika_count: payload.groups.ichika.length,
    hatsune_count: payload.groups.hatsune.length,
    kiina_count: payload.groups.kiina.length,
    manshu_count: payload.groups.manshu.length,
  };
}
