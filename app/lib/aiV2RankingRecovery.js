const GROUPS = [
  { type: "ichika_escape_best10", character: "ichika", limit: 10, specialist: "ichika", label: "イン逃げ期待" },
  { type: "hatsune_dominant_best3", character: "hatsune", limit: 3, specialist: "hatsune", label: "女子戦イン優勢", womenOnly: true },
  { type: "hatsune_risky_best3", character: "hatsune", limit: 3, specialist: "hatsune", label: "女子戦イン不安", womenOnly: true, ascending: true },
  { type: "kiina_boat5_best5", character: "kiina", limit: 5, specialist: "kiina", label: "5号艇1着期待", boatNo: 5 },
];

function candidate(row, group) {
  const rawValue = row.explanation?.specialist_raw?.[group.specialist];
  const probabilityValue = row[`${group.specialist}_probability`];
  if (rawValue == null || probabilityValue == null) return null;
  const raw = Number(rawValue);
  const probability = Number(probabilityValue);
  if (group.womenOnly && Number(row.feature_snapshot?.is_female_race) !== 1) return null;
  if (!Number.isFinite(raw) || !Number.isFinite(probability)) return null;
  return { row, raw, probability, first: Number(row.first_probability) || 0 };
}

export async function recoverMissingAiV2Rankings(supabase, raceDate, dataTiming = "previous_day") {
  const [predictions, rankings] = await Promise.all([
    supabase.from("ai_v2_predictions")
      .select("course_code,race_no,boat_no,first_probability,ichika_probability,hatsune_probability,kiina_probability,model_versions,feature_snapshot,explanation")
      .eq("race_date", raceDate).eq("data_timing", dataTiming).in("boat_no", [1, 5]),
    supabase.from("ai_v2_daily_rankings")
      .select("ranking_type,rank_no")
      .eq("ranking_date", raceDate).eq("data_timing", dataTiming)
      .in("ranking_type", GROUPS.map((group) => group.type)),
  ]);
  if (predictions.error) throw predictions.error;
  if (rankings.error) throw rankings.error;

  const existing = new Map(GROUPS.map((group) => [group.type, 0]));
  for (const ranking of rankings.data || []) existing.set(ranking.ranking_type, (existing.get(ranking.ranking_type) || 0) + 1);

  const now = new Date().toISOString();
  const rows = [];
  const groups = {};
  for (const group of GROUPS) {
    const candidates = (predictions.data || [])
      .filter((row) => Number(row.boat_no) === (group.boatNo || 1))
      .map((row) => candidate(row, group)).filter(Boolean)
      .sort((a, b) => (group.ascending ? a.raw - b.raw : b.raw - a.raw)
        || b.first - a.first || Number(a.row.course_code) - Number(b.row.course_code)
        || Number(a.row.race_no) - Number(b.row.race_no));
    const expected = Math.min(group.limit, candidates.length);
    const count = existing.get(group.type) || 0;
    groups[group.type] = { count, expected };

    // A partially written group needs investigation; don't mix two model snapshots.
    if (count !== 0 || expected === 0) continue;
    for (const [index, item] of candidates.slice(0, expected).entries()) {
      rows.push({
        ranking_date: raceDate, data_timing: dataTiming,
        character_code: group.character, ranking_type: group.type, rank_no: index + 1,
        course_code: Number(item.row.course_code), race_no: Number(item.row.race_no),
        probability: item.probability,
        model_version: item.row.model_versions?.[group.specialist] || "ai-v2-shadow-selected-v1",
        summary: `${group.label} ${(item.probability * 100).toFixed(1)}%`,
        metrics: { shadow: true, bundle_version: "ai-v2-shadow-selected-v1", ranking_rule: "specialist_raw_then_common_first", raw_ranking_score: item.raw, tiebreak_common_first_probability: item.first, recovered_from: "ai_v2_predictions" },
        selected_for_home: false, selected_for_social: false, updated_at: now,
      });
    }
  }

  if (rows.length) {
    // Concurrent recoveries may insert the same slots. Never overwrite editorial selections.
    const { error } = await supabase.from("ai_v2_daily_rankings").upsert(rows, {
      onConflict: "ranking_date,data_timing,ranking_type,rank_no", ignoreDuplicates: true,
    });
    if (error) throw error;
  }
  return { inserted: rows.length, groups };
}
