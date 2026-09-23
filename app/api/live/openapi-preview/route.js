import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPEN_API_BASE = "https://boatraceopenapi.github.io/api/v1";
const COURSE_NAMES = [
  null,
  "桐生", "戸田", "江戸川", "平和島", "多摩川", "浜名湖", "蒲郡", "常滑",
  "津", "三国", "びわこ", "住之江", "尼崎", "鳴門", "丸亀", "児島",
  "宮島", "徳山", "下関", "若松", "芦屋", "福岡", "唐津", "大村",
];

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase environment variables are missing");
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function jstDate() {
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return now.toISOString().slice(0, 10);
}

function normalizeDate(value) {
  const date = String(value || jstDate()).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("date must be YYYY-MM-DD");
  }
  return date;
}

function endpointFor(date) {
  if (date === jstDate()) return `${OPEN_API_BASE}/today.json`;
  const compact = date.replaceAll("-", "");
  return `${OPEN_API_BASE}/${date.slice(0, 4)}/${compact}.json`;
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toTime(value) {
  if (!value) return null;
  const text = String(value).trim();
  const match = text.match(/(?:T|\s)(\d{2}:\d{2}(?::\d{2})?)/);
  if (match) return match[1].length === 5 ? `${match[1]}:00` : match[1];
  if (/^\d{2}:\d{2}(?::\d{2})?$/.test(text)) return text.length === 5 ? `${text}:00` : text;
  return null;
}

function buildPayload(apiJson, fallbackDate) {
  const stadiums = apiJson?.programs?.stadiums || {};
  const bootstrapEntryRows = [];
  const bootstrapEventRows = [];
  const previewEntryRows = [];
  const previewEventRows = [];

  for (const [stadiumKey, stadium] of Object.entries(stadiums)) {
    const courseCode = Number(stadium?.stadium_number ?? stadiumKey);
    if (!Number.isInteger(courseCode) || courseCode < 1 || courseCode > 24) continue;

    const races = stadium?.races || {};
    for (const [raceKey, race] of Object.entries(races)) {
      const raceNo = Number(race?.race_number ?? raceKey);
      if (!Number.isInteger(raceNo) || raceNo < 1 || raceNo > 12) continue;

      const raceDate = String(race?.date || race?.preview?.date || fallbackDate).slice(0, 10);
      const courseName = COURSE_NAMES[courseCode] || null;
      const raceName = String(race?.subtitle || race?.title || "").trim() || null;

      bootstrapEventRows.push({
        race_date: raceDate,
        course_code: courseCode,
        race_no: raceNo,
        course_name: courseName,
        race_name: raceName,
        closing_time: toTime(race?.closed_at),
        distance: toNumber(race?.distance),
        race_day_no: toNumber(race?.day_number),
      });

      const programRacers = race?.racers || {};
      for (const [boatKey, racer] of Object.entries(programRacers)) {
        const boatNo = Number(racer?.entry_number ?? boatKey);
        if (!Number.isInteger(boatNo) || boatNo < 1 || boatNo > 6) continue;

        bootstrapEntryRows.push({
          race_date: raceDate,
          course_code: courseCode,
          race_no: raceNo,
          boat_no: boatNo,
          racer_registration_no:
            racer?.number === null || racer?.number === undefined ? null : String(racer.number),
          racer_name: racer?.name || null,
          racer_class: racer?.rank_number_source || null,
          national_win_rate: toNumber(racer?.national_win_rate),
          local_win_rate: toNumber(racer?.local_win_rate),
          national_2_rate: toNumber(racer?.national_top_2_percent),
          local_2_rate: toNumber(racer?.local_top_2_percent),
          average_st: toNumber(racer?.average_start_timing),
          flying_count: toNumber(racer?.flying_count),
          late_count: toNumber(racer?.late_count),
          motor_no: toNumber(racer?.motor_number),
          motor_2_rate: toNumber(racer?.motor_top_2_percent),
          boat_machine_no: toNumber(racer?.boat_number),
          boat_2_rate: toNumber(racer?.boat_top_2_percent),
          racer_weight: toNumber(racer?.weight),
        });
      }

      const preview = race?.preview;
      if (!preview || typeof preview !== "object") continue;

      previewEventRows.push({
        race_date: raceDate,
        course_code: courseCode,
        race_no: raceNo,
        wind_speed: toNumber(preview.wind_speed),
        wind_direction_code:
          preview.wind_direction_number === null || preview.wind_direction_number === undefined
            ? null
            : String(preview.wind_direction_number),
        wave_height: toNumber(preview.wave_height),
        weather_code:
          preview.weather_number === null || preview.weather_number === undefined
            ? null
            : String(preview.weather_number),
        air_temperature: toNumber(preview.air_temperature),
        water_temperature: toNumber(preview.water_temperature),
      });

      const previewRacers = preview?.racers || {};
      for (const [boatKey, racer] of Object.entries(previewRacers)) {
        const boatNo = Number(racer?.entry_number ?? boatKey);
        if (!Number.isInteger(boatNo) || boatNo < 1 || boatNo > 6) continue;

        const exhibitionTime = toNumber(racer?.exhibition_time);
        const exhibitionSt = toNumber(racer?.start_timing);
        const exhibitionCourse = toNumber(racer?.course_number);
        const tilt = toNumber(racer?.tilt_adjustment);

        if (
          exhibitionTime === null &&
          exhibitionSt === null &&
          exhibitionCourse === null &&
          tilt === null
        ) {
          continue;
        }

        previewEntryRows.push({
          race_date: raceDate,
          course_code: courseCode,
          race_no: raceNo,
          boat_no: boatNo,
          exhibition_time: exhibitionTime,
          exhibition_st: exhibitionSt,
          exhibition_course: exhibitionCourse,
          tilt,
        });
      }
    }
  }

  return {
    bootstrapEntryRows,
    bootstrapEventRows,
    previewEntryRows,
    previewEventRows,
  };
}

async function syncPreview(date) {
  const endpoint = endpointFor(date);
  const response = await fetch(endpoint, {
    cache: "no-store",
    headers: { "user-agent": "BoatStrikers/1.0" },
  });

  if (!response.ok) {
    throw new Error(`OpenAPI fetch failed: ${response.status}`);
  }

  const apiJson = await response.json();
  const {
    bootstrapEntryRows,
    bootstrapEventRows,
    previewEntryRows,
    previewEventRows,
  } = buildPayload(apiJson, date);
  const syncedAt = new Date().toISOString();
  const supabase = getSupabase();

  // Emergency bootstrap is current-day only. The RPC inserts missing rows only,
  // so existing BRDB/PC-KYOTEI rows are never overwritten.
  let bootstrapResult = null;
  if (date === jstDate() && bootstrapEventRows.length && bootstrapEntryRows.length) {
    const { data, error } = await supabase.rpc("bs_apply_openapi_bootstrap", {
      p_events: bootstrapEventRows,
      p_entries: bootstrapEntryRows,
      p_synced_at: syncedAt,
    });
    if (error) throw error;
    bootstrapResult = data;
  }

  const [{ data: entryResult, error: entryError }, { data: eventResult, error: eventError }] =
    await Promise.all([
      supabase.rpc("bs_apply_openapi_preview", {
        p_rows: previewEntryRows,
        p_synced_at: syncedAt,
      }),
      supabase.rpc("bs_apply_openapi_preview_events", {
        p_rows: previewEventRows,
        p_synced_at: syncedAt,
      }),
    ]);

  if (entryError) throw entryError;
  if (eventError) throw eventError;

  return {
    date,
    endpoint,
    bootstrap: bootstrapResult,
    fetched_program_entry_rows: bootstrapEntryRows.length,
    fetched_program_event_rows: bootstrapEventRows.length,
    fetched_entry_rows: previewEntryRows.length,
    fetched_event_rows: previewEventRows.length,
    entries: entryResult,
    events: eventResult,
    priority: {
      program: "BRDB existing rows > OpenAPI bootstrap for missing rows only",
      preview: "PC-KYOTEI existing values > OpenAPI fallback",
      detailed_exhibition: "verified official / PC-KYOTEI detailed exhibition",
    },
  };
}

async function handler(request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = normalizeDate(searchParams.get("date") || undefined);
    const result = await syncPreview(date);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("OpenAPI preview fallback sync failed", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function GET(request) {
  return handler(request);
}

export async function POST(request) {
  return handler(request);
}
