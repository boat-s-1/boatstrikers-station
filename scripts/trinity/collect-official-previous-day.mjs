#!/usr/bin/env node
// Run from a network where the public official race list is available.
// Never backdate a capture: only the server's receipt time is recorded.
import { setTimeout as delay } from 'node:timers/promises';
import { officialCourses, parseOfficialRacelist } from '../../app/lib/trinityOfficialRacelist.js';

const root = 'https://www.boatrace.jp';
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const probe = args.includes('--probe');
const option = name => args[args.indexOf(name) + 1];
const localDate = offset => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date(Date.now() + offset * 86_400_000));
const raceDate = args.includes('--date') ? option('--date') : localDate(1);
const maxRaces = args.includes('--max-races') ? Number(option('--max-races')) : 288;
const hour = Number(new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Tokyo', hour: '2-digit', hourCycle: 'h23',
}).format(new Date()));

if (!/^\d{4}-\d{2}-\d{2}$/.test(raceDate) || !Number.isInteger(maxRaces) || maxRaces < 1 || maxRaces > 288) {
  throw new Error('Invalid --date or --max-races');
}
if (probe && !dryRun) throw new Error('--probe requires --dry-run');
if (!dryRun && (raceDate !== localDate(1) || hour < 21 || hour > 23)) {
  throw new Error('Submission requires tomorrow JST and 21:00–23:59 JST');
}
const target = process.env.TRINITY_SHADOW_ORIGIN || 'https://www.boat-strike.online';
if (!/^https:\/\/[a-z0-9.-]+(?::443)?$/.test(target) ||
    (!dryRun && !process.env.TRINITY_CRON_SECRET)) {
  throw new Error('Set a HTTPS TRINITY_SHADOW_ORIGIN and TRINITY_CRON_SECRET');
}

async function getHtml(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(20000), redirect: 'error' });
  if (!response.ok || !/text\/html/i.test(response.headers.get('content-type') || '')) {
    throw new Error(`Official HTML unavailable: HTTP ${response.status}`);
  }
  const content = await response.text();
  if (content.length > 500000) throw new Error('Official HTML exceeds limit');
  return content;
}

const compact = raceDate.replaceAll('-', '');
const index = await getHtml(`${root}/owpc/pc/race/index?hd=${compact}`).catch(async error => {
  if (error.name !== 'TimeoutError') throw error;
  await delay(3000);
  return getHtml(`${root}/owpc/pc/race/index?hd=${compact}`);
});
const courses = officialCourses(index, compact);
if (!courses.length) throw new Error('No official venue links for the requested date');
const report = { race_date: raceDate, venues: courses.length, expected_races: courses.length * 12,
  examined: 0, valid: 0, submitted: 0, already_saved: 0,
  incomplete: [], source_changed: [], failed: [] };
let blocked = false;
for (const course of courses) {
  for (let no = 1; no <= 12 && report.examined < maxRaces; no++) {
    const url = `${root}/owpc/pc/race/racelist?hd=${compact}&jcd=${String(course).padStart(2, '0')}&rno=${no}`;
    report.examined++;
    try {
      const html = await getHtml(url);
      if (html.length > 250000) throw new Error('Race page exceeds intake size limit');
      // Validate before submission. The server parses and validates independently.
      parseOfficialRacelist(html, { raceDate, courseCode: course, raceNo: no });
      report.valid++;
      if (!dryRun) {
        const response = await fetch(`${target}/api/cron/trinity-official-previous-day`, {
          method: 'POST', signal: AbortSignal.timeout(15000),
          headers: { authorization: `Bearer ${process.env.TRINITY_CRON_SECRET}`,
            'content-type': 'application/json' },
          body: JSON.stringify({ race_date: raceDate, course_code: course, race_no: no, html }),
        });
        const outcome = await response.json();
        if (response.status === 409 && outcome.error === 'immutable_source_differs') {
          report.source_changed.push({ course_code: course, race_no: no });
        } else {
          if (!response.ok) throw new Error(`Intake HTTP ${response.status}: ${outcome.error || outcome.status}`);
          if (outcome.status === 'saved') report.submitted++;
          else if (outcome.status === 'already_saved') report.already_saved++;
          else throw new Error(`Unexpected intake status ${outcome.status}`);
        }
      }
    } catch (error) {
      const item = { course_code: course, race_no: no, error: error.message };
      if (/^Official racelist boat [1-6] is incomplete$/.test(error.message)) report.incomplete.push(item);
      else report.failed.push(item);
      if (/Official HTML unavailable: HTTP (403|429)/.test(error.message)) blocked = true;
    }
    if (blocked) break;
    await delay(350); // Make sequential requests; do not evade publisher access controls.
  }
  console.error(JSON.stringify({ progress: 'venue_complete', course_code: course,
    examined: report.examined, valid: report.valid, incomplete: report.incomplete.length,
    source_changed: report.source_changed.length, failed: report.failed.length }));
  if (report.examined >= maxRaces || blocked) break;
}
console.log(JSON.stringify(report));
if (probe) {
  // A blank official average-ST cell is a genuine source-data gap, not an access failure.
  if (!report.valid || report.failed.length) process.exitCode = 1;
} else if (report.failed.length || (!dryRun && !report.submitted && !report.already_saved && !report.source_changed.length)) {
  process.exitCode = 1;
}
