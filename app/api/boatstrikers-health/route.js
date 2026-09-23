import { NextResponse } from "next/server";
import {
  getAvailableDates,
  getCoursesByDate,
} from "../../lib/boatstrikersPlatform";
import { getAdminSupabase } from "../../admin/sync/_lib/supabaseAdmin";

export const dynamic = "force-dynamic";

function normalizeStepStatus(value) {
  const status = String(value || "").toLowerCase();
  if (["failed", "failure", "error"].includes(status)) return "failed";
  if (["partial_success", "partial", "degraded"].includes(status)) return "degraded";
  if (["waiting_exhibition", "waiting", "pending"].includes(status)) return "waiting";
  if (["success", "ok", "completed"].includes(status)) return "success";
  return status || "unknown";
}

function buildSyncHealth(runtimeRow) {
  if (!runtimeRow) {
    return {
      effectiveStatus: "unknown",
      outerStatus: null,
      components: {},
      heartbeatAt: null,
      lastSuccessAt: null,
    };
  }

  const summary = runtimeRow.last_summary && typeof runtimeRow.last_summary === "object"
    ? runtimeRow.last_summary
    : {};
  const steps = Array.isArray(summary.steps) ? summary.steps : [];
  const components = {};

  for (const step of steps) {
    const name = String(step?.step || "unknown");
    components[name] = normalizeStepStatus(step?.status);
  }

  const outerStatus = normalizeStepStatus(summary.status || runtimeRow.last_status);
  const brdbStatus = components.brdb || "unknown";
  const failedComponents = Object.values(components).filter((status) => status === "failed").length;
  const degradedComponents = Object.values(components).filter((status) => status === "degraded").length;

  let effectiveStatus = outerStatus;
  if (brdbStatus === "failed") effectiveStatus = "failed";
  else if (brdbStatus === "degraded") effectiveStatus = "degraded";
  else if (failedComponents > 0) effectiveStatus = "degraded";
  else if (degradedComponents > 0) effectiveStatus = "degraded";
  else if (outerStatus === "unknown" && Object.values(components).some((status) => status === "success")) {
    effectiveStatus = "success";
  }

  return {
    effectiveStatus,
    outerStatus,
    components,
    heartbeatAt: runtimeRow.heartbeat_at || null,
    lastSuccessAt: runtimeRow.last_success_at || null,
    workerName: runtimeRow.worker_name || null,
    state: runtimeRow.state || null,
  };
}

async function getDataHealth(db, raceDate) {
  if (!raceDate) return null;

  try {
    const [bootstrapEntries, bootstrapEvents, unknownResults, unknownPayouts] = await Promise.all([
      db.from("bs_race_entries")
        .select("id", { count: "exact", head: true })
        .eq("race_date", raceDate)
        .eq("data_source", "BOATRACE_OPEN_API_BOOTSTRAP"),
      db.from("bs_race_events")
        .select("id", { count: "exact", head: true })
        .eq("race_date", raceDate)
        .eq("data_source", "BOATRACE_OPEN_API_BOOTSTRAP"),
      db.from("bs_race_events")
        .select("id", { count: "exact", head: true })
        .eq("race_date", raceDate)
        .eq("result_available", true)
        .is("result_source", null),
      db.from("bs_race_events")
        .select("id", { count: "exact", head: true })
        .eq("race_date", raceDate)
        .not("trifecta_payout", "is", null)
        .is("payout_source", null),
    ]);

    const errors = [bootstrapEntries.error, bootstrapEvents.error, unknownResults.error, unknownPayouts.error].filter(Boolean);
    if (errors.length) return { status: "unknown" };

    return {
      status: "ok",
      bootstrapEntryRows: bootstrapEntries.count || 0,
      bootstrapEventRows: bootstrapEvents.count || 0,
      unknownResultSourceRows: unknownResults.count || 0,
      unknownPayoutSourceRows: unknownPayouts.count || 0,
    };
  } catch {
    return { status: "unknown" };
  }
}

export async function GET() {
  try {
    const db = getAdminSupabase();
    const [dates, runtimeResult] = await Promise.all([
      getAvailableDates(3),
      db.from("bs_sync_runtime")
        .select("state,worker_name,heartbeat_at,last_success_at,last_status,last_summary")
        .eq("id", 1)
        .maybeSingle(),
    ]);

    const latestDate = dates[0] ?? null;
    const [courses, dataHealth] = await Promise.all([
      latestDate ? getCoursesByDate(latestDate) : Promise.resolve([]),
      getDataHealth(db, latestDate),
    ]);

    const syncHealth = runtimeResult.error
      ? {
          effectiveStatus: "unknown",
          outerStatus: null,
          components: {},
          heartbeatAt: null,
          lastSuccessAt: null,
        }
      : buildSyncHealth(runtimeResult.data);

    return NextResponse.json({
      status: "success",
      latestDate,
      availableDates: dates,
      courseCount: courses.length,
      raceCount: courses.reduce((sum, course) => sum + course.races.length, 0),
      syncHealth,
      dataHealth,
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
