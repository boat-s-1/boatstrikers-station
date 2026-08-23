import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPEN_API_BASE = "https://boatraceopenapi.github.io/api/v1";

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

function buildPayload(apiJson, fallbackDate) {
  const stadiums = apiJson?.programs?.stadiums || {};
  const entryRows = [];
  const eventRows = [];

  for (const [stadiumKey, stadium] of Object.entries(stadiums)) {
    const courseCode = Number(stadium?.stadium_number ?? stadiumKey);
    if (!Number.isInteger(courseCode) || courseCode < 1 || courseCode > 24) continue;

    const races = stadium?.races || {};
    for (const [raceKey, race] of Object.entries(races)) {
      const raceNo = Number(race?.race_number ?? raceKey);
      if (!Number.isInteger(raceNo) || raceNo < 1 || raceNo > 12) continue;

      const preview = race?.preview;
      if (!preview || typeof preview !== "object") continue;

      const raceDate = String(race?.date || preview?.date || fallbackDate).slice(0, 10);

      eventRows.push({
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

      const racers = preview?.racers || {};
      for (const [boatKey, racer] of Object.entries(racers)) {
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

        entryRows.push({
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

  return { entryRows, eventRows };
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
  const { entryRows, eventRows } = buildPayload(apiJson, date);
  const syncedAt = new Date().toISOString();
  const supabase = getSupabase();

  const [{ data: entryResult, error: entryError }, { data: eventResult, error: eventError }] =
    await Promise.all([
      supabase.rpc("bs_apply_openapi_preview", {
        p_rows: entryRows,
        p_synced_at: syncedAt,
      }),
      supabase.rpc("bs_apply_openapi_preview_events", {
        p_rows: eventRows,
        p_synced_at: syncedAt,
      }),
    ]);

  if (entryError) throw entryError;
  if (eventError) throw eventError;

  return {
    date,
    endpoint,
    fetched_entry_rows: entryRows.length,
    fetched_event_rows: eventRows.length,
    entries: entryResult,
    events: eventResult,
    priority: {
      preview: "PC-KYOTEI existing values > OpenAPI fallback",
      detailed_exhibition: "PC-KYOTEI only (lap/turn/straight)",
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
