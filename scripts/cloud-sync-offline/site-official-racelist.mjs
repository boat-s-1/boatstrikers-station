import { createHash } from "node:crypto";
import { parseOfficialRacelist, OfficialRacelistIncompleteError } from "../../app/lib/trinityOfficialRacelist.js";

const officialOrigin = "https://www.boatrace.jp";
const racelistPath = "/owpc/pc/race/racelist";
const optionalStats = new Set(["average_st", "national_win_rate", "local_win_rate", "motor_2_rate", "boat_2_rate"]);
const text = html => String(html ?? "").replace(/<br\s*\/?>/gi, "\n")
  .replace(/<[^>]*>/g, " ").replace(/&nbsp;|&#160;/gi, " ").replace(/\s+/g, " ").trim();
const cells = row => [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(match => match[1]);
const lines = html => String(html ?? "").replace(/<br\s*\/?>/gi, "\n")
  .replace(/<[^>]*>/g, " ").split("\n").map(value => value.trim()).filter(Boolean);
const optionalNumber = (value, max) => {
  if (!/^\d+(?:\.\d+)?$/.test(value ?? "")) return null;
  const number = Number(value);
  return number <= max ? number : null;
};

// A program may be displayed with a null statistic. This fallback never
// supplies prediction inputs or substitutes a number for an official dash.
function parseDisplayOnlyProgram(html, raceNo) {
  const schedule = html.match(/<td\b[^>]*>\s*締切予定時刻\s*<\/td>([\s\S]*?)<\/tr>/);
  const closingTime = schedule && text(cells(schedule[1])[raceNo - 1]);
  if (!/^\d{1,2}:\d{2}$/.test(closingTime ?? "")) throw new Error("Official closing time is absent");
  const groups = [...html.matchAll(/<tbody\b[^>]*class=["'][^"']*is-fs12[^"']*["'][^>]*>([\s\S]*?)<\/tbody>/gi)];
  if (groups.length !== 6) throw new Error("Official six-boat program is incomplete");
  const registrations = new Set();
  const entries = groups.map((group, index) => {
    const first = group[1].match(/<tr\b[^>]*>([\s\S]*?)<\/tr>/i)?.[1] ?? "";
    const fields = cells(first);
    const boatNo = Number(text(fields[0]).normalize("NFKC"));
    const registration = text(fields[2]).match(/^(\d{4})\s*\//)?.[1];
    const profile = fields[1]?.match(/\/racersearch\/profile\?toban=(\d{4})/i)?.[1];
    const name = fields[2]?.match(/<div\b[^>]*class=["'][^"']*is-fs18[^"']*["'][^>]*>\s*<a\b[^>]*>([\s\S]*?)<\/a>/i)?.[1];
    if (boatNo !== index + 1 || !registration || registration === "0000" ||
        profile !== registration || !text(name) || registrations.has(registration)) {
      throw new Error("Official display program identity is incomplete");
    }
    registrations.add(registration);
    return { boat_no: boatNo, racer_registration_no: registration.padStart(5, "0"),
      racer_name: text(name).replace(/\s+/g, ""),
      average_st: optionalNumber(lines(fields[3]).at(-1), 0.5),
      national_win_rate: optionalNumber(lines(fields[4])[0], 10),
      local_win_rate: optionalNumber(lines(fields[5])[0], 10),
      motor_2_rate: optionalNumber(lines(fields[6])[1], 100),
      boat_2_rate: optionalNumber(lines(fields[7])[1], 100) };
  });
  return { closing_time: closingTime, entries, program_only: true,
    source_sha256: createHash("sha256").update(html).digest("hex") };
}

export function parseSiteOfficialRacelist(html, race) {
  const { raceDate, courseCode, raceNo } = race;
  const date = new Date(raceDate + "T00:00:00Z");
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(raceDate) ||
      !Number.isFinite(date.valueOf()) || date.toISOString().slice(0, 10) !== raceDate ||
      !Number.isInteger(courseCode) || courseCode < 1 || courseCode > 24 ||
      !Number.isInteger(raceNo) || raceNo < 1 || raceNo > 12) {
    throw new Error("Invalid official race key");
  }

  // The schedule links every race. Only the selected race uses a plain th.
  const selected = [...html.matchAll(/<th\s*>\s*<a\s+href="([^"]+)"[^>]*>\s*(\d+)R\s*<\/a>\s*<\/th>/gi)];
  if (selected.length !== 1) throw new Error("Official selected race is ambiguous");

  const [, href, label] = selected[0];
  const url = new URL(href.replaceAll("&amp;", "&"), officialOrigin);
  const venue = String(courseCode).padStart(2, "0");
  const compactDate = raceDate.replaceAll("-", "");
  if (url.origin !== officialOrigin || url.pathname !== racelistPath ||
      url.searchParams.getAll("hd").join(",") !== compactDate ||
      url.searchParams.getAll("jcd").join(",") !== venue ||
      url.searchParams.getAll("rno").join(",") !== String(raceNo) ||
      label !== String(raceNo) ||
      !new RegExp(`<img[^>]*text_place2_${venue}\\.png`, "i").test(html)) {
    throw new Error("Official selected race does not match");
  }

  let parsed;
  try {
    parsed = parseOfficialRacelist(html, race);
  } catch (error) {
    if (!(error instanceof OfficialRacelistIncompleteError) ||
        !error.missing_fields?.length ||
        error.missing_fields.some(item => !optionalStats.has(item.field))) throw error;
    parsed = parseDisplayOnlyProgram(html, raceNo);
  }
  const registrations = parsed.entries.map(entry => Number(entry.racer_registration_no));
  if (registrations.some(number => number < 1) || new Set(registrations).size !== 6) {
    throw new Error("Official racer registrations must be unique and positive");
  }
  return parsed;
}
