import { parseOfficialRacelist } from "../../app/lib/trinityOfficialRacelist.js";

const officialOrigin = "https://www.boatrace.jp";
const racelistPath = "/owpc/pc/race/racelist";

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

  const parsed = parseOfficialRacelist(html, race);
  const registrations = parsed.entries.map(entry => Number(entry.racer_registration_no));
  if (registrations.some(number => number < 1) || new Set(registrations).size !== 6) {
    throw new Error("Official racer registrations must be unique and positive");
  }
  return parsed;
}
