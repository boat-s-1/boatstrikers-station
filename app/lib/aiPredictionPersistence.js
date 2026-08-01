import "server-only";

const CHARACTER_CODE = "ichika";
const UPSERT_CONFLICT =
  "race_date,course_code,race_no,character_code,timing";

function hasValue(value) {
  return value !== null && value !== undefined && value !== "";
}

function toIntegerOrNull(value) {
  if (!hasValue(value)) return null;
  const number = Number(value);
  return Number.isInteger(number) ? number : null;
}

function getMarkedBoats(prediction) {
  const marks = Array.isArray(prediction?.marks)
    ? prediction.marks
    : [];

  const boats = marks
    .map((mark) =>
      toIntegerOrNull(
        mark?.boat_no ?? mark?.boatNo ?? mark?.boat ?? mark?.number
      )
    )
    .filter(
      (boatNo, index, values) =>
        boatNo !== null &&
        boatNo >= 1 &&
        boatNo <= 6 &&
        values.indexOf(boatNo) === index
    );

  const directBoats = [
    prediction?.main_boat,
    prediction?.second_boat,
    prediction?.third_boat,
    prediction?.fourth_boat,
  ]
    .map(toIntegerOrNull)
    .filter(
      (boatNo, index, values) =>
        boatNo !== null &&
        boatNo >= 1 &&
        boatNo <= 6 &&
        values.indexOf(boatNo) === index
    );

  return [...new Set([...directBoats, ...boats])];
}

export function predictionToDatabaseRow({
  raceDate,
  courseCode,
  raceNo,
  prediction,
}) {
  if (!prediction?.timing) {
    throw new Error("prediction.timing がありません。");
  }

  const markedBoats = getMarkedBoats(prediction);
  const generatedAt = prediction.generated_at || new Date().toISOString();

  return {
    race_date: raceDate,
    course_code: Number(courseCode),
    race_no: Number(raceNo),
    character_code: CHARACTER_CODE,
    timing: String(prediction.timing),
    model_version: prediction.engine_version || "phase2-v13",
    score:
      prediction.score === null || prediction.score === undefined
        ? null
        : Number(prediction.score),
    rank: prediction.rank || null,
    main_boat:
      toIntegerOrNull(prediction.main_boat) ?? markedBoats[0] ?? null,
    second_boat:
      toIntegerOrNull(prediction.second_boat) ?? markedBoats[1] ?? null,
    third_boat:
      toIntegerOrNull(prediction.third_boat) ?? markedBoats[2] ?? null,
    fourth_boat:
      toIntegerOrNull(prediction.fourth_boat) ?? markedBoats[3] ?? null,
    danger_level: prediction.danger_level || null,
    comment_text: prediction.comment_text || null,
    bet_json: Array.isArray(prediction.bet_json) ? prediction.bet_json : [],
    predicted_at: generatedAt,
    published: true,
    detail_json: {
      marks: Array.isArray(prediction.marks) ? prediction.marks : [],
      factors:
        prediction.factors && typeof prediction.factors === "object"
          ? prediction.factors
          : {},
      danger_score: prediction.danger_score ?? null,
      score_before: prediction.score_before ?? null,
      score_delta: prediction.score_delta ?? null,
      source: prediction.source || "phase2_fallback",
      generated_at: generatedAt,
    },
  };
}

export async function fetchExistingPredictionKeys(supabase, raceDate) {
  const { data, error } = await supabase
    .from("bs_ai_predictions")
    .select("race_date,course_code,race_no,character_code,timing")
    .eq("race_date", raceDate)
    .eq("character_code", CHARACTER_CODE);

  if (error) {
    throw new Error(`既存AI予想の取得に失敗しました: ${error.message}`);
  }

  return new Set(
    (data ?? []).map(
      (row) =>
        `${Number(row.course_code)}:${Number(row.race_no)}:${String(
          row.timing
        )}`
    )
  );
}

export function predictionKey(courseCode, raceNo, timing) {
  return `${Number(courseCode)}:${Number(raceNo)}:${String(timing)}`;
}

export async function upsertPredictionRows(
  supabase,
  rows,
  batchSize = 300
) {
  if (!Array.isArray(rows) || rows.length === 0) return 0;

  let written = 0;

  for (let index = 0; index < rows.length; index += batchSize) {
    const batch = rows.slice(index, index + batchSize);

    const { error } = await supabase.from("bs_ai_predictions").upsert(batch, {
      onConflict: UPSERT_CONFLICT,
      ignoreDuplicates: false,
    });

    if (error) {
      throw new Error(`AI予想の保存に失敗しました: ${error.message}`);
    }

    written += batch.length;
  }

  return written;
}
