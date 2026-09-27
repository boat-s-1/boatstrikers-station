import { createHash } from 'node:crypto';

export const OFFICIAL_SOURCE_VERSION = 'boatrace_official_racelist_v1';
const plain = html => String(html || '').replace(/<br\s*\/?>/gi, '\n')
  .replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
  .replace(/\r/g, '').trim();
const lines = html => plain(html).split(/\n/).map(s => s.trim()).filter(Boolean);
const number = (value, min, max) => {
  const n = Number(String(value).replace(/\s+/g, ''));
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
};
const cells = row => [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(m => m[1]);
const findRaceDate = (html, date) => new RegExp(`(?:hd=${date}|${date.slice(0,4)}[年/.-]0?${Number(date.slice(4,6))}[月/.-]0?${Number(date.slice(6,8))})`).test(html);

export function officialCourses(indexHtml, compactDate) {
  if (!findRaceDate(indexHtml, compactDate)) throw new Error('Official index does not show the target race date');
  const venues = new Set();
  for (const match of indexHtml.matchAll(/href=["']([^"']*\/race\/racelist\?[^"']+)["']/gi)) {
    const url = new URL(match[1].replace(/&amp;/g, '&'), 'https://www.boatrace.jp');
    if (url.searchParams.get('hd') === compactDate && url.searchParams.get('rno') === '1' &&
      /^\d{2}$/.test(url.searchParams.get('jcd') || '')) venues.add(Number(url.searchParams.get('jcd')));
  }
  return [...venues].sort((a, b) => a - b);
}

export function parseOfficialRacelist(html, { raceDate, courseCode, raceNo }) {
  const date = raceDate.replaceAll('-', '');
  if (!findRaceDate(html, date)) throw new Error('Official racelist date does not match');
  const identity = [...html.matchAll(/href=["']([^"']*\/race\/racelist\?[^"']+)["']/gi)]
    .some(m => { const u = new URL(m[1].replace(/&amp;/g, '&'), 'https://www.boatrace.jp');
      return u.searchParams.get('hd') === date && Number(u.searchParams.get('jcd')) === courseCode &&
        Number(u.searchParams.get('rno')) === raceNo; });
  if (!identity) throw new Error('Official racelist race key does not match');
  const schedule = html.match(/<td\b[^>]*>\s*締切予定時刻\s*<\/td>([\s\S]*?)<\/tr>/);
  if (!schedule) throw new Error('Official closing schedule is absent');
  const slots = cells(schedule[1]);
  const closingTime = plain(slots[raceNo - 1]);
  if (!/^\d{1,2}:\d{2}$/.test(closingTime)) throw new Error('Official closing time is absent');
  const groups = [...html.matchAll(/<tbody\b[^>]*class=["'][^"']*is-fs12[^"']*["'][^>]*>([\s\S]*?)<\/tbody>/gi)];
  if (groups.length !== 6) throw new Error(`Official racelist has ${groups.length} boats, expected six`);
  const tables = [...html.matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)].map(m => m[0]);
  const timetable = tables.find(t => t.includes('締切予定時刻'));
  const racelist = tables.find(t => t.includes('is-fs12') && t.includes('is-boatColor'));
  if (!timetable || !racelist) throw new Error('Official evidence tables are absent');
  const entries = groups.map((group, index) => {
    const row = group[1].match(/<tr\b[^>]*>([\s\S]*?)<\/tr>/i)?.[1];
    const fields = cells(row || '');
    const boatNo = number(plain(fields[0]).replace(/[０-９]/g, ch => String(ch.charCodeAt(0) - 0xff10)), 1, 6);
    const racer = plain(fields[2]);
    const registration = racer.match(/^\s*(\d{4,5})\s*\//)?.[1];
    const name = fields[2]?.match(/<div\b[^>]*class=["'][^"']*is-fs18[^"']*["'][^>]*>\s*<a\b[^>]*>([\s\S]*?)<\/a>/i)?.[1];
    const stats = lines(fields[3]);
    const national = lines(fields[4]);
    const local = lines(fields[5]);
    const motor = lines(fields[6]);
    const boat = lines(fields[7]);
    const entry = {
      boat_no: boatNo,
      racer_registration_no: registration?.padStart(5, '0'),
      racer_name: plain(name).replace(/\s+/g, ''),
      average_st: number(stats.at(-1), 0, 0.5),
      national_win_rate: number(national[0], 0, 10),
      local_win_rate: number(local[0], 0, 10),
      motor_2_rate: number(motor[1], 0, 100),
      boat_2_rate: number(boat[1], 0, 100),
    };
    if (entry.boat_no !== index + 1 || !entry.racer_registration_no || !entry.racer_name ||
      Object.values(entry).some(v => v == null || v === '')) {
      throw new Error(`Official racelist boat ${index + 1} is incomplete`);
    }
    return entry;
  });
  // Preserve only the two exact tables used for prediction. The page footer and ads change independently.
  const sourceHtml = `${timetable}\n${racelist}`;
  return { closing_time: closingTime, entries, source_html: sourceHtml,
    source_sha256: createHash('sha256').update(sourceHtml).digest('hex') };
}
