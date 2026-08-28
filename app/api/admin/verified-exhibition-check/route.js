import { fetchBestOriginalTenji } from '../../../../lib/verifiedOriginalTenjiSource.js';
import { validMarugameRace } from '../../../../lib/marugameVerifiedOriginalTenji.js';
import { validVerifiedRace } from '../../../../lib/narutoKaratsuVerifiedTenji.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 15;
let lastRequest = 0;

export async function GET(request) {
  const q = new URL(request.url).searchParams;
  const race = { courseCode: Number(q.get('course')), raceDate: q.get('date'), raceNo: Number(q.get('race')) };
  const reply = (body, status=200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
  // Fixed verified venues only; no arbitrary URL, credentials, DB, or notifications.
  if (!validMarugameRace(race) && !validVerifiedRace(race)) return reply({ ok:false, error:'invalid_or_unverified_venue' },400);
  if (Date.now()-lastRequest < 1000) return reply({ok:false,error:'retry_later'},429);
  lastRequest=Date.now();
  return reply({ readOnly:true, requested:race, ...(await fetchBestOriginalTenji(race)) });
}
