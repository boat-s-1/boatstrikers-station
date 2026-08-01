import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildPhase2Predictions } from "../../../lib/phase2PredictionEngine";
import {
  fetchExistingPredictionKeys,
  predictionKey,
  predictionToDatabaseRow,
  upsertPredictionRows,
} from "../../../lib/aiPredictionPersistence";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} が設定されていません。`);
  return value;
}

function getSupabase() {
  return createClient(
    requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  );
}

function getJstDateString() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function normalizeDate(value) {
  const text = String(value ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : getJstDateString();
}

function authorized(request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return process.env.NODE_ENV !== "production";

  const authorization = request.headers.get("authorization") || "";
  const customSecret = request.headers.get("x-cron-secret") || "";

  return authorization === `Bearer ${secret}` || customSecret === secret;
}

function hasValue(value) {
  return value !== null && value !== undefined && value !== "";
}

function hasExhibitionData(entry) {
  return [
    entry.exhibition_time,
    entry.exhibition_st,
    entry.official_lap,
    entry.lap_time,
    entry.official_turn,
    entry.turn_time,
    entry.official_straight,
    entry.straight_time,
  ].some(hasValue);
}

function hasResultData(entry) {
  return [
    entry.arrival_order,
    entry.actual_course,
    entry.actual_start_timing,
    entry.race_time,
  ].some(hasValue);
}

function raceKey(courseCode, raceNo) {
  return `${Number(courseCode)}:${Number(raceNo)}`;
}

function normalizeEntry(row) {
  return {
    ...row,
    boat_no: Number(row.boat_no),
    national_win_rate:
      row.national_win_rate === null ? null : Number(row.national_win_rate),
    local_win_rate:
      row.local_win_rate === null ? null : Number(row.local_win_rate),
    motor_2_rate: row.motor_2_rate ?? row.motor_top2_rate ?? null,
    boat_2_rate: row.boat_2_rate ?? row.race_boat_top2_rate ?? null,
    average_st: row.average_st === null ? null : Number(row.average_st),
  };
}

async function generate(request) {
  if (!authorized(request)) {
    return NextResponse.json(
      { status: "error", message: "Unauthorized" },
      { status: 401 }
    );
  }

  const url = new URL(request.url);
  const raceDate = normalizeDate(url.searchParams.get("date"));
  const mode = String(url.searchParams.get("mode") || "all").toLowerCase();
  const force = url.searchParams.get("force") === "1";

  if (!["all", "previous", "live"].includes(mode)) {
    return NextResponse.json(
      {
        status: "error",
        message: "mode は all / previous / live のいずれかです。",
      },
      { status: 400 }
    );
  }

  const supabase = getSupabase();

  const [
    { data: events, error: eventError },
    { data: entries, error: entryError },
    { data: results, error: resultError },
  ] = await Promise.all([
    supabase
      .from("bs_race_events")
      .select("*")
      .eq("race_date", raceDate)
      .order("course_code", { ascending: true })
      .order("race_no", { ascending: true }),
    supabase
      .from("bs_race_entries")
      .select("*")
      .eq("race_date", raceDate)
      .order("course_code", { ascending: true })
      .order("race_no", { ascending: true })
      .order("boat_no", { ascending: true }),
    supabase
      .from("bs_race_results")
      .select("race_date,course_code,race_no,result_status")
      .eq("race_date", raceDate),
  ]);

  if (eventError) {
    throw new Error(`開催データの取得に失敗しました: ${eventError.message}`);
  }
  if (entryError) {
    throw new Error(`出走データの取得に失敗しました: ${entryError.message}`);
  }
  if (resultError) {
    throw new Error(`結果データの取得に失敗しました: ${resultError.message}`);
  }

  const existingKeys = await fetchExistingPredictionKeys(supabase, raceDate);
  const resultRaceKeys = new Set(
    (results ?? []).map((row) => raceKey(row.course_code, row.race_no))
  );

  const entriesByRace = new Map();
  for (const rawEntry of entries ?? []) {
    const key = raceKey(rawEntry.course_code, rawEntry.race_no);
    const current = entriesByRace.get(key) ?? [];
    current.push(normalizeEntry(rawEntry));
    entriesByRace.set(key, current);
  }

  const rowsToWrite = [];
  let skippedFinished = 0;
  let skippedNoEntries = 0;
  let skippedNoExhibition = 0;
  let skippedExisting = 0;
  let generatedPrevious = 0;
  let generatedLive = 0;

  for (const event of events ?? []) {
    const courseCode = Number(event.course_code);
    const raceNo = Number(event.race_no);
    const key = raceKey(courseCode, raceNo);
    const raceEntries = entriesByRace.get(key) ?? [];

    if (raceEntries.length < 2) {
      skippedNoEntries += 1;
      continue;
    }

    const finished =
      resultRaceKeys.has(key) ||
      Boolean(event.result_available) ||
      raceEntries.some(hasResultData);

    // 結果確定後の新規生成は後知恵になるため禁止します。
    if (finished) {
      skippedFinished += 1;
      continue;
    }

    const { previousPrediction, livePrediction } = buildPhase2Predictions({
      event,
      entries: raceEntries,
    });

    if ((mode === "all" || mode === "previous") && previousPrediction) {
      const previousKey = predictionKey(
        courseCode,
        raceNo,
        previousPrediction.timing
      );

      if (force || !existingKeys.has(previousKey)) {
        rowsToWrite.push(
          predictionToDatabaseRow({
            raceDate,
            courseCode,
            raceNo,
            prediction: previousPrediction,
          })
        );
        generatedPrevious += 1;
      } else {
        skippedExisting += 1;
      }
    }

    if (mode === "all" || mode === "live") {
      const exhibitionReady = raceEntries.some(hasExhibitionData);

      if (!exhibitionReady || !livePrediction) {
        skippedNoExhibition += 1;
        continue;
      }

      const liveKey = predictionKey(courseCode, raceNo, livePrediction.timing);

      if (force || !existingKeys.has(liveKey)) {
        rowsToWrite.push(
          predictionToDatabaseRow({
            raceDate,
            courseCode,
            raceNo,
            prediction: livePrediction,
          })
        );
        generatedLive += 1;
      } else {
        skippedExisting += 1;
      }
    }
  }

  const written = await upsertPredictionRows(supabase, rowsToWrite);

  return NextResponse.json({
    status: "success",
    target_date: raceDate,
    mode,
    force,
    events_found: events?.length ?? 0,
    entries_found: entries?.length ?? 0,
    existing_predictions: existingKeys.size,
    generated_previous: generatedPrevious,
    generated_live: generatedLive,
    written,
    skipped_finished: skippedFinished,
    skipped_no_entries: skippedNoEntries,
    skipped_no_exhibition: skippedNoExhibition,
    skipped_existing: skippedExisting,
    generated_at: new Date().toISOString(),
  });
}

export async function GET(request) {
  try {
    return await generate(request);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "AI予想生成に失敗しました。",
      },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  return GET(request);
}
