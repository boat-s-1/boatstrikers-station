import { NextResponse } from "next/server";
import { buildPhase2Predictions } from "../../../lib/phase2PredictionEngine";
import {
  fetchExistingPredictionKeys,
  predictionKey,
  predictionToDatabaseRow,
  upsertPredictionRows,
} from "../../../lib/aiPredictionPersistence";
import {
  assertAiAdminRequest,
  getAiAdminSupabase,
} from "../../../../lib/aiAdminSupabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function jstDateString() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function normalizeDate(value) {
  const text = String(value ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : jstDateString();
}

function hasValue(value) {
  return value !== null && value !== undefined && value !== "";
}

function numberOrNull(value) {
  if (!hasValue(value)) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function intOrNull(value) {
  const n = numberOrNull(value);
  return n === null ? null : Math.trunc(n);
}

function firstValue(...values) {
  return values.find(hasValue) ?? null;
}

function mapEvent(row) {
  return {
    ...row,
    race_date: row.race_date,
    course_code: Number(row.course_code),
    race_no: Number(row.race_no),
    wind_speed: numberOrNull(row.wind_speed),
  };
}

function mapEntry(row) {
  const boatNo = intOrNull(firstValue(row.boat_no, row.teiban));

  return {
    ...row,
    boat_no: boatNo,
    racer_name: String(firstValue(row.racer_name, row.shimei) ?? "")
      .replace(/\u3000/g, " ")
      .replace(/\s+/g, " ")
      .trim(),

    national_win_rate: numberOrNull(row.national_win_rate),
    local_win_rate: numberOrNull(row.local_win_rate),
    motor_2_rate: numberOrNull(
      firstValue(row.motor_top2_rate, row.motor_2_rate)
    ),
    boat_2_rate: numberOrNull(
      firstValue(row.race_boat_top2_rate, row.boat_2_rate)
    ),
    average_st: numberOrNull(row.average_st),

    exhibition_time: numberOrNull(
      firstValue(row.official_exhibition_time, row.exhibition_time)
    ),
    exhibition_st: numberOrNull(
      firstValue(row.official_exhibition_st, row.exhibition_st)
    ),
    exhibition_fl: String(
      firstValue(
        row.official_exhibition_symbol,
        row.exhibition_fl,
        row.show_fl,
        row.start_exhibition_fl,
        row.exhibition_f_mark,
        row.exhibition_mark,
        row.start_mark,
        row.st_mark,
        row.flying_flag,
        row.is_flying,
        row.fl,
        row.mark,
        row.note
      ) ?? ""
    )
      .trim()
      .toUpperCase(),

    official_lap: numberOrNull(firstValue(row.official_lap, row.lap_time)),
    lap_time: numberOrNull(firstValue(row.official_lap, row.lap_time)),
    official_turn: numberOrNull(firstValue(row.official_turn, row.turn_time)),
    turn_time: numberOrNull(firstValue(row.official_turn, row.turn_time)),
    official_straight: numberOrNull(
      firstValue(row.official_straight, row.straight_time)
    ),
    straight_time: numberOrNull(
      firstValue(row.official_straight, row.straight_time)
    ),
  };
}

function raceKey(courseCode, raceNo) {
  return `${Number(courseCode)}:${Number(raceNo)}`;
}

function hasCompleteExhibition(entries) {
  if (!Array.isArray(entries)) return false;

  const boats = new Map(
    entries
      .filter((entry) => Number(entry?.boat_no) >= 1 && Number(entry?.boat_no) <= 6)
      .map((entry) => [Number(entry.boat_no), entry])
  );

  if (boats.size !== 6) return false;

  return [1, 2, 3, 4, 5, 6].every((boatNo) => {
    const value = boats.get(boatNo)?.exhibition_time;
    return value !== null && value !== undefined && Number.isFinite(Number(value));
  });
}

function normalizeClosingTime(value) {
  if (!hasValue(value)) return null;
  const text = String(value).trim();

  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(text)) {
    const [hour, minute, second = "00"] = text.split(":");
    return {
      hour: Number(hour),
      minute: Number(minute),
      second: Number(second),
    };
  }

  if (/^\d{3,4}$/.test(text)) {
    const padded = text.padStart(4, "0");
    return {
      hour: Number(padded.slice(0, 2)),
      minute: Number(padded.slice(2, 4)),
      second: 0,
    };
  }

  return null;
}

function createClosingAt(raceDate, closingTime) {
  if (!hasValue(closingTime)) return null;
  const text = String(closingTime).trim();

  if (text.includes("T")) {
    const date = new Date(text);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const time = normalizeClosingTime(text);
  if (!time) return null;

  const date = new Date(
    `${raceDate}T${String(time.hour).padStart(2, "0")}:${String(
      time.minute
    ).padStart(2, "0")}:${String(time.second).padStart(2, "0")}+09:00`
  );

  return Number.isNaN(date.getTime()) ? null : date;
}

function isRaceClosed(event, raceDate, now = new Date()) {
  const today = jstDateString();

  if (raceDate < today) return true;
  if (raceDate > today) return false;

  const closingAt = createClosingAt(raceDate, event?.closing_time);
  if (!closingAt) return false;

  return now.getTime() >= closingAt.getTime();
}

async function safeUpdateJob(supabase, jobId, patch) {
  if (!jobId) return;

  const { error } = await supabase
    .from("ai_jobs")
    .update(patch)
    .eq("id", jobId);

  if (error) {
    console.warn(`ai_jobs更新をスキップ: ${error.message}`);
  }
}

async function createJob(supabase, raceDate) {
  const { data, error } = await supabase
    .from("ai_jobs")
    .insert({
      job_type: "run_product_daily",
      status: "running",
      progress: 5,
      requested_by: "prediction-api",
      worker_name: "vercel-phase2-worker",
      message: `AI予想生成中 ${raceDate}`,
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`AIジョブ作成に失敗しました: ${error.message}`);
  }

  return data?.id ?? null;
}

export async function GET(request) {
  try {
    assertAiAdminRequest(request);

    return NextResponse.json({
      status: "ok",
      endpoint: "/api/ai/generate-predictions",
      engine: "phase2-v13",
      safety: [
        "結果確定済みレースは生成しない",
        "締切時刻を過ぎたレースは生成しない",
        "前日版は既存データを上書きしない",
        "直前版は6艇すべての展示タイム取得後のみ生成する",
      ],
    });
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || "認証に失敗しました" },
      { status: error?.status || 500 }
    );
  }
}

export async function POST(request) {
  let supabase;
  let jobId = null;

  try {
    assertAiAdminRequest(request);

    const body = await request.json().catch(() => ({}));
    const raceDate = normalizeDate(body?.date || body?.race_date);

    supabase = getAiAdminSupabase();
    jobId = body?.job_id ? String(body.job_id) : null;

    if (jobId) {
      await safeUpdateJob(supabase, jobId, {
        status: "running",
        progress: 5,
        message: `AI予想生成中 ${raceDate}`,
        worker_name: "vercel-phase2-worker",
        started_at: new Date().toISOString(),
        error_message: null,
      });
    } else {
      jobId = await createJob(supabase, raceDate);
    }

    const [eventsResult, entriesResult, resultsResult] = await Promise.all([
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
        .select("course_code,race_no")
        .eq("race_date", raceDate),
    ]);

    if (eventsResult.error) {
      throw new Error(`レース取得失敗: ${eventsResult.error.message}`);
    }
    if (entriesResult.error) {
      throw new Error(`出走表取得失敗: ${entriesResult.error.message}`);
    }
    if (resultsResult.error) {
      throw new Error(`結果取得失敗: ${resultsResult.error.message}`);
    }

    const events = (eventsResult.data ?? []).map(mapEvent);
    const entries = (entriesResult.data ?? []).map(mapEntry);

    const resultKeys = new Set(
      (resultsResult.data ?? []).map((row) =>
        raceKey(row.course_code, row.race_no)
      )
    );

    const entriesByRace = new Map();

    for (const entry of entries) {
      const key = raceKey(entry.course_code, entry.race_no);

      if (!entriesByRace.has(key)) {
        entriesByRace.set(key, []);
      }

      entriesByRace.get(key).push(entry);
    }

    const existingKeys = await fetchExistingPredictionKeys(
      supabase,
      raceDate
    );

    const rows = [];
    const now = new Date();

    let eligibleRaces = 0;
    let skippedResultRaces = 0;
    let skippedClosedRaces = 0;
    let skippedNoEntries = 0;
    let skippedIncompleteExhibition = 0;
    let previousCreated = 0;
    let liveCreatedOrUpdated = 0;

    const canCreateMissingPrevious = resultKeys.size === 0;

    for (const event of events) {
      const key = raceKey(event.course_code, event.race_no);

      if (resultKeys.has(key)) {
        skippedResultRaces += 1;
        continue;
      }

      if (isRaceClosed(event, raceDate, now)) {
        skippedClosedRaces += 1;
        continue;
      }

      const raceEntries = entriesByRace.get(key) ?? [];

      if (raceEntries.length < 2) {
        skippedNoEntries += 1;
        continue;
      }

      eligibleRaces += 1;

      const { previousPrediction, livePrediction } =
        buildPhase2Predictions({
          event,
          entries: raceEntries,
        });

      if (
        canCreateMissingPrevious &&
        previousPrediction &&
        !existingKeys.has(
          predictionKey(
            event.course_code,
            event.race_no,
            previousPrediction.timing
          )
        )
      ) {
        rows.push(
          predictionToDatabaseRow({
            raceDate,
            courseCode: event.course_code,
            raceNo: event.race_no,
            prediction: previousPrediction,
          })
        );

        previousCreated += 1;
      }

      const exhibitionReady = hasCompleteExhibition(raceEntries);

      if (livePrediction && exhibitionReady) {
        rows.push(
          predictionToDatabaseRow({
            raceDate,
            courseCode: event.course_code,
            raceNo: event.race_no,
            prediction: livePrediction,
          })
        );

        liveCreatedOrUpdated += 1;
      } else if (!exhibitionReady) {
        skippedIncompleteExhibition += 1;
      }
    }

    const writtenRows = await upsertPredictionRows(supabase, rows);

    const summary = {
      status: "success",
      target_date: raceDate,
      job_id: jobId,
      events_found: events.length,
      entries_found: entries.length,
      result_races_found: resultKeys.size,
      eligible_races: eligibleRaces,
      skipped_result_races: skippedResultRaces,
      skipped_closed_races: skippedClosedRaces,
      skipped_no_entries: skippedNoEntries,
      skipped_incomplete_exhibition: skippedIncompleteExhibition,
      previous_created: previousCreated,
      live_created_or_updated: liveCreatedOrUpdated,
      written_rows: writtenRows,
      engine_version: "phase2-v13",
    };

    await safeUpdateJob(supabase, jobId, {
      status: "completed",
      progress: 100,
      message: `AI予想生成完了 ${raceDate} / ${writtenRows}行`,
      completed_at: new Date().toISOString(),
      error_message: null,
    });

    return NextResponse.json(summary);
  } catch (error) {
    if (supabase && jobId) {
      await safeUpdateJob(supabase, jobId, {
        status: "failed",
        message: "AI予想生成失敗",
        error_message: String(error?.message || error).slice(0, 1800),
        completed_at: new Date().toISOString(),
      });
    }

    return NextResponse.json(
      {
        status: "failed",
        job_id: jobId,
        error: error?.message || "AI予想生成に失敗しました",
      },
      { status: error?.status || 500 }
    );
  }
}
