// 一果・初音・キイナ新聞の「AI候補一覧」「AI予想取得」の共通処理。
// 既存APIの応答（JSON・ステータス・エラーコード）を変えないことが前提。
// 認証はここでは行わず、呼び出し側のAPIルートで確認する。

export const STADIUMS = ["桐生","戸田","江戸川","平和島","多摩川","浜名湖","蒲郡","常滑","津","三国","びわこ","住之江","尼崎","鳴門","丸亀","児島","宮島","徳山","下関","若松","芦屋","福岡","唐津","大村"];

export const NEWS_CHARACTERS = ["ichika", "hatsune", "kiina"];

export const CANDIDATE_TYPES = {
  ichika: ["ichika_escape_best10"],
  hatsune: ["hatsune_dominant_best3", "hatsune_risky_best3"],
  kiina: ["kiina_boat5_best5"],
};

export const CANDIDATE_LABELS = {
  ichika_escape_best10: "イン逃げ期待 BEST10",
  hatsune_dominant_best3: "イン逃げが圧倒的",
  hatsune_risky_best3: "インが不安",
  kiina_boat5_best5: "5アタマ期待 BEST5",
};

export function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

export function normalizeTiming(value) {
  return value === "after_exhibition" ? "after_exhibition" : "previous_day";
}

// 既存ルートと同じ接続設定（Service Role優先、無ければanon）。未設定時はnull。
export function newsSupabaseFromEnv(createClient, env = process.env) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function reply(body, status = 200) {
  return { status, body };
}

// ---- 候補一覧 ----

export async function loadNewsCandidates(supabase, character, { date, timing }) {
  const types = CANDIDATE_TYPES[character];
  const { data, error } = await supabase.from("ai_v2_daily_rankings")
    .select("ranking_type,rank_no,course_code,race_no,probability,selected_for_social")
    .eq("ranking_date", date).eq("character_code", character).eq("data_timing", timing)
    .in("ranking_type", types).order("ranking_type", { ascending: true }).order("rank_no", { ascending: true });
  if (error) return { error };
  return {
    candidates: (data || []).map((r) => ({
      rankingType: r.ranking_type,
      category: CANDIDATE_LABELS[r.ranking_type] || r.ranking_type,
      rankNo: Number(r.rank_no),
      courseCode: Number(r.course_code),
      courseName: STADIUMS[Number(r.course_code) - 1] || String(r.course_code),
      raceNo: Number(r.race_no),
      probability: Number.isFinite(Number(r.probability)) ? (Number(r.probability) * 100).toFixed(1) : "",
      selectedForSocial: Boolean(r.selected_for_social),
    })),
  };
}

export async function handleCandidatesRequest(character, searchParams, createSupabase) {
  const date = searchParams.get("date");
  const timing = normalizeTiming(searchParams.get("timing"));
  if (!validDate(date)) return reply({ ok: false, error: "invalid_date" }, 400);
  const supabase = createSupabase();
  if (!supabase) return reply({ ok: false, error: "supabase_config_missing" }, 500);
  const result = await loadNewsCandidates(supabase, character, { date, timing });
  if (result.error) return reply({ ok: false, error: "candidate_read_failed" }, 500);
  return reply({ ok: true, candidates: result.candidates });
}

// ---- 予想取得 ----

function parsePredictionParams(searchParams) {
  const date = searchParams.get("date");
  const course = searchParams.get("course");
  const raceNo = Number(searchParams.get("raceNo"));
  const timing = normalizeTiming(searchParams.get("timing"));
  const courseCode = STADIUMS.indexOf(course) + 1;
  const valid = validDate(date) && courseCode >= 1 && Number.isInteger(raceNo) && raceNo >= 1 && raceNo <= 12;
  return { valid, date, course, raceNo, timing, courseCode };
}

const PREDICTION_COLUMNS = "tickets,unit_stake,investment,prediction_label,published_at,ranking_type,rank_no,source_table";

// ai_v2_daily_rankings から凍結された公式買い目（bsc_official_predictions）を1件取得。
export async function loadFrozenPrediction(supabase, { date, courseCode, raceNo, character, timing, rankingType, rankNo }) {
  return supabase
    .from("bsc_official_predictions")
    .select(PREDICTION_COLUMNS)
    .eq("race_date", date)
    .eq("course_code", courseCode)
    .eq("race_no", raceNo)
    .eq("character_code", character)
    .eq("timing", timing)
    .eq("source_table", "ai_v2_daily_rankings")
    .eq("ranking_type", rankingType)
    .eq("rank_no", rankNo)
    .order("published_at", { ascending: false })
    .limit(1)
    .maybeSingle();
}

function percent(value) {
  const probability = Number(value);
  return Number.isFinite(probability) ? (probability * 100).toFixed(1) : "";
}

function frozenFields(prediction) {
  return {
    tickets: Array.isArray(prediction?.tickets) ? prediction.tickets : [],
    unitStake: Number(prediction?.unit_stake || 0),
    investment: Number(prediction?.investment || 0),
    predictionLabel: prediction?.prediction_label || "",
    publishedAt: prediction?.published_at || null,
  };
}

export async function loadIchikaPrediction(supabase, { date, courseCode, raceNo, timing }) {
  const { data: ranking, error: rankingError } = await supabase
    .from("ai_v2_daily_rankings")
    .select("ranking_date,character_code,ranking_type,rank_no,course_code,race_no,probability,summary,social_comment,metrics,selected_for_social")
    .eq("ranking_date", date)
    .eq("character_code", "ichika")
    .eq("ranking_type", "ichika_escape_best10")
    .eq("data_timing", timing)
    .eq("course_code", courseCode)
    .eq("race_no", raceNo)
    .maybeSingle();
  if (rankingError) return { error: "ranking_read_failed" };
  if (!ranking) return { found: false };

  const { data: prediction, error: predictionError } = await loadFrozenPrediction(supabase, {
    date, courseCode, raceNo, character: "ichika", timing, rankingType: "ichika_escape_best10", rankNo: ranking.rank_no,
  });
  if (predictionError) return { error: "prediction_read_failed" };

  const frozen = frozenFields(prediction);
  return {
    found: true,
    frozen: Boolean(prediction),
    ranking,
    data: {
      rankNo: Number(ranking.rank_no),
      escapeRate: percent(ranking.probability),
      summary: ranking.summary || "",
      socialComment: ranking.social_comment || "",
      selectedForSocial: Boolean(ranking.selected_for_social),
      ...frozen,
      timing,
    },
  };
}

export async function loadKiinaPrediction(supabase, { date, courseCode, raceNo, timing }) {
  const { data: ranking, error: rankingError } = await supabase
    .from("ai_v2_daily_rankings")
    .select("ranking_date,character_code,ranking_type,rank_no,course_code,race_no,probability,summary,social_comment,metrics,selected_for_social,data_timing")
    .eq("ranking_date", date)
    .eq("character_code", "kiina")
    .eq("ranking_type", "kiina_boat5_best5")
    .eq("data_timing", timing)
    .eq("course_code", courseCode)
    .eq("race_no", raceNo)
    .maybeSingle();
  if (rankingError) return { error: "ranking_read_failed" };
  if (!ranking) return { found: false };

  const { data: prediction, error: predictionError } = await loadFrozenPrediction(supabase, {
    date, courseCode, raceNo, character: "kiina", timing, rankingType: "kiina_boat5_best5", rankNo: ranking.rank_no,
  });
  if (predictionError) return { error: "prediction_read_failed" };

  const { tickets, unitStake, investment, predictionLabel, publishedAt } = frozenFields(prediction);
  return {
    found: true,
    frozen: Boolean(prediction),
    ranking,
    data: {
      rankNo: Number(ranking.rank_no),
      chance: percent(ranking.probability),
      summary: ranking.summary || "",
      socialComment: ranking.social_comment || "",
      selectedForSocial: Boolean(ranking.selected_for_social),
      holeBoat: "5",
      tickets,
      unitStake,
      investment,
      predictionLabel,
      publishedAt,
      timing,
    },
  };
}

// ---- 初音：艇別データから注目艇・チェックポイントを作る（既存ロジックそのまま） ----

function num(v, { allowZero = false, allowNegative = false } = {}) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  if (!allowNegative && n < 0) return null;
  if (!allowZero && n === 0) return null;
  return n;
}
function fixed(v, digits = 2) {
  return Number(v).toFixed(digits).replace(/\.00$/, "");
}
function normalize(values, value, lowerIsBetter = false) {
  const valid = values.filter((v) => v !== null);
  if (!valid.length || value === null) return null;
  const min = Math.min(...valid);
  const max = Math.max(...valid);
  if (max === min) return 0.5;
  const ratio = (value - min) / (max - min);
  return lowerIsBetter ? 1 - ratio : ratio;
}
function bestEntry(entries, key, { lower = false, allowZero = false, allowNegative = false, boats = null } = {}) {
  const pool = entries
    .filter((e) => !boats || boats.includes(Number(e.boat_no)))
    .map((e) => ({ entry: e, value: num(e[key], { allowZero, allowNegative }) }))
    .filter((x) => x.value !== null)
    .sort((a, b) => lower ? a.value - b.value : b.value - a.value);
  return pool[0] || null;
}
function compositeScore(entries, entry, timing) {
  const metrics = [
    ["national_win_rate", 0.30, false, false],
    ["local_win_rate", 0.25, false, false],
    ["motor_top2_rate", 0.20, false, false],
    ["race_boat_top2_rate", 0.10, false, false],
    ["average_st", 0.15, true, false],
  ];
  if (timing === "after_exhibition") {
    metrics.push(["official_exhibition_time", 0.20, true, false]);
    metrics.push(["official_exhibition_st", 0.10, true, true]);
  }

  let weighted = 0;
  let totalWeight = 0;
  for (const [key, weight, lowerIsBetter, allowZero] of metrics) {
    const value = num(entry[key], { allowZero, allowNegative: false });
    if (value === null) continue;
    const values = entries.map((e) => num(e[key], { allowZero, allowNegative: false }));
    const normalized = normalize(values, value, lowerIsBetter);
    if (normalized === null) continue;
    weighted += normalized * weight;
    totalWeight += weight;
  }
  return totalWeight ? weighted / totalWeight : 0;
}

export const HATSUNE_FALLBACK_CHECKPOINTS = ["艇別データを確認", "スタートデータを確認", "モーター気配を確認"];

export function buildRaceInsights(entries, category, timing) {
  if (!entries.length) {
    return {
      featuredBoat: "1",
      checkpoints: [...HATSUNE_FALLBACK_CHECKPOINTS],
    };
  }

  let featured;
  if (category === "イン逃げが圧倒的") {
    featured = entries.find((e) => Number(e.boat_no) === 1) || entries[0];
  } else {
    const challengers = entries.filter((e) => Number(e.boat_no) !== 1);
    featured = (challengers.length ? challengers : entries)
      .map((entry) => ({ entry, score: compositeScore(entries, entry, timing) }))
      .sort((a, b) => b.score - a.score)[0]?.entry || entries[0];
  }

  const points = [];
  const push = (text) => {
    if (text && !points.includes(text) && points.length < 3) points.push(text);
  };

  if (timing === "after_exhibition") {
    const exTime = bestEntry(entries, "official_exhibition_time", { lower: true });
    if (exTime) push(`${exTime.entry.boat_no}号艇 展示タイム${fixed(exTime.value, 2)}`);
    const exSt = bestEntry(entries, "official_exhibition_st", { lower: true, allowZero: true });
    if (exSt) push(`${exSt.entry.boat_no}号艇 展示ST${fixed(exSt.value, 2)}`);
    const straight = bestEntry(entries, "official_straight", { lower: true });
    if (straight) push(`${straight.entry.boat_no}号艇 直線${fixed(straight.value, 2)}`);
  }

  const featuredLocal = num(featured.local_win_rate);
  const featuredNational = num(featured.national_win_rate);
  if (featuredLocal !== null) push(`${featured.boat_no}号艇 当地勝率${fixed(featuredLocal, 2)}`);
  else if (featuredNational !== null) push(`${featured.boat_no}号艇 全国勝率${fixed(featuredNational, 2)}`);

  const avgSt = bestEntry(entries, "average_st", { lower: true });
  if (avgSt) push(`${avgSt.entry.boat_no}号艇 平均ST${fixed(avgSt.value, 2)}`);

  const motor = bestEntry(entries, "motor_top2_rate");
  if (motor) push(`${motor.entry.boat_no}号艇 モーター2連率${fixed(motor.value, 1)}%`);

  const local = bestEntry(entries, "local_win_rate");
  if (local) push(`${local.entry.boat_no}号艇 当地勝率${fixed(local.value, 2)}`);

  const national = bestEntry(entries, "national_win_rate");
  if (national) push(`${national.entry.boat_no}号艇 全国勝率${fixed(national.value, 2)}`);

  while (points.length < 3) {
    const fallback = HATSUNE_FALLBACK_CHECKPOINTS[points.length];
    push(fallback);
  }

  return {
    featuredBoat: String(featured.boat_no || 1),
    checkpoints: points.slice(0, 3),
  };
}

export async function loadHatsunePrediction(supabase, { date, courseCode, raceNo, timing }) {
  const { data: rankings, error: rankingError } = await supabase
    .from("ai_v2_daily_rankings")
    .select("ranking_date,character_code,ranking_type,rank_no,course_code,race_no,probability,summary,social_comment,selected_for_social,data_timing")
    .eq("ranking_date", date)
    .eq("character_code", "hatsune")
    .eq("data_timing", timing)
    .eq("course_code", courseCode)
    .eq("race_no", raceNo)
    .in("ranking_type", CANDIDATE_TYPES.hatsune)
    .order("rank_no", { ascending: true });
  if (rankingError) return { error: "ranking_read_failed" };
  if (!rankings?.length) return { found: false };

  const ranking = rankings[0];
  const category = ranking.ranking_type === "hatsune_dominant_best3" ? "イン逃げが圧倒的" : "インが不安";

  const { data: prediction, error: predictionError } = await loadFrozenPrediction(supabase, {
    date, courseCode, raceNo, character: "hatsune", timing, rankingType: ranking.ranking_type, rankNo: ranking.rank_no,
  });
  if (predictionError) return { error: "prediction_read_failed" };

  const { data: entries, error: entryError } = await supabase
    .from("bs_race_entries")
    .select("boat_no,national_win_rate,local_win_rate,average_st,motor_top2_rate,race_boat_top2_rate,course1_average_st,course1_top2_rate,course1_race_count,official_exhibition_time,official_exhibition_st,official_half_lap,official_lap,official_turn,official_straight")
    .eq("race_date", date)
    .eq("course_code", courseCode)
    .eq("race_no", raceNo)
    .order("boat_no", { ascending: true });
  if (entryError) return { error: "entry_read_failed" };

  const insights = buildRaceInsights(entries || [], category, timing);
  const frozen = frozenFields(prediction);
  return {
    found: true,
    frozen: Boolean(prediction),
    ranking,
    entries: entries || [],
    data: {
      rankNo: Number(ranking.rank_no),
      rankingType: ranking.ranking_type,
      category,
      expectation: percent(ranking.probability),
      featuredBoat: insights.featuredBoat,
      checkpoints: insights.checkpoints,
      summary: ranking.summary || "",
      socialComment: ranking.social_comment || "",
      selectedForSocial: Boolean(ranking.selected_for_social),
      ...frozen,
      timing,
    },
  };
}

const PREDICTION_LOADERS = {
  ichika: loadIchikaPrediction,
  hatsune: loadHatsunePrediction,
  kiina: loadKiinaPrediction,
};

export async function handlePredictionRequest(character, searchParams, createSupabase) {
  const params = parsePredictionParams(searchParams);
  if (!params.valid) return reply({ ok: false, error: "invalid_params" }, 400);
  const supabase = createSupabase();
  if (!supabase) return reply({ ok: false, error: "supabase_config_missing" }, 500);

  const result = await PREDICTION_LOADERS[character](supabase, params);
  if (result.error) return reply({ ok: false, error: result.error }, 500);
  if (!result.found) return reply({ ok: true, found: false });
  return reply({ ok: true, found: true, frozen: result.frozen, data: result.data });
}
