import { guardAdminRead } from "../../../../lib/adminApiGuard.js";
import { fetchNationalBeforeInfo } from "../../../../lib/nationalBeforeInfoIdentity.js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 15;

const reply = (body, status = 200) => Response.json(body, {
  status, headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" },
});

function todayJst() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export async function GET(request) {
  const denied = await guardAdminRead(request);
  if (denied) return denied;
  // Disabled until a bounded provider test and deployment have their own approval.
  if (process.env.BS_ADMIN_NATIONAL_BEFOREINFO_CHECK_ENABLED !== "true") return reply({ ok: false, error: "disabled" }, 404);
  const q = new URL(request.url).searchParams;
  const date = q.get("date"), course = q.get("course"), raceNo = q.get("race");
  if (date !== todayJst() || !/^(?:[1-9]|1\\d|2[0-4])$/.test(course || "") ||
      !/^(?:[1-9]|1[0-2])$/.test(raceNo || "") || q.getAll("date").length !== 1 ||
      q.getAll("course").length !== 1 || q.getAll("race").length !== 1) return reply({ ok: false, error: "invalid_race" }, 400);
  const race = { raceDate: date, courseCode: Number(course), raceNo: Number(raceNo) };
  // Exactly one upstream GET, with redirect handling and timeout in the existing identity verifier.
  const found = await fetchNationalBeforeInfo(race, { timeoutMs: 8000 });
  return reply({ ok: found.ok, requested: race, rows: found.ok ? found.rows : [], error: found.error || null,
    checkedAt: new Date().toISOString(), source: "boatrace.jp/beforeinfo", readOnly: true });
}
