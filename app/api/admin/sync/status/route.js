import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "../../../../admin/sync/_lib/adminAuth";
import { getAdminSupabase } from "../../../../admin/sync/_lib/supabaseAdmin";
export const dynamic = "force-dynamic";
export async function GET() {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sb = getAdminSupabase();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const [runtime, commands, logs, events, entries] = await Promise.all([
    sb.from("bs_sync_runtime").select("*").eq("id", 1).maybeSingle(),
    sb.from("bs_sync_commands").select("*").order("requested_at", { ascending: false }).limit(15),
    sb.from("bs_sync_logs").select("*").order("started_at", { ascending: false }).limit(15),
    sb.from("bs_race_events").select("course_code,race_no,result_available").eq("race_date", today),
    sb.from("bs_race_entries").select("course_code,race_no,exhibition_time,exhibition_st,arrival_order").eq("race_date", today),
  ]);
  for (const result of [runtime, commands, logs, events, entries]) {
    if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });
  }
  const eventRows = events.data || [];
  const entryRows = entries.data || [];
  const courseMap = new Map();
  for (const event of eventRows) {
    const course = courseMap.get(event.course_code) || { course_code: event.course_code, event_count: 0, exhibition_count: 0, result_count: 0 };
    course.event_count += 1;
    courseMap.set(event.course_code, course);
  }
  const exhibitionRaces = new Set();
  const resultRaces = new Set();
  for (const row of entryRows) {
    const key = `${row.course_code}-${row.race_no}`;
    if (row.exhibition_time != null || row.exhibition_st != null) exhibitionRaces.add(key);
    if (row.arrival_order != null) resultRaces.add(key);
  }
  for (const course of courseMap.values()) {
    course.exhibition_count = [...exhibitionRaces].filter((key) => key.startsWith(`${course.course_code}-`)).length;
    course.result_count = [...resultRaces].filter((key) => key.startsWith(`${course.course_code}-`)).length;
  }
  return NextResponse.json({
    today, runtime: runtime.data, commands: commands.data || [], logs: logs.data || [],
    counts: { events: eventRows.length, entries: entryRows.length, exhibition: exhibitionRaces.size, results: resultRaces.size },
    courses: [...courseMap.values()].sort((a, b) => a.course_code - b.course_code),
  });
}
