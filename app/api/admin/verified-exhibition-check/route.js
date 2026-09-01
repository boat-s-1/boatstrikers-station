import { fetchBestOriginalTenji } from '../../../../lib/verifiedOriginalTenjiSource.js';
import { validMarugameRace } from '../../../../lib/marugameVerifiedOriginalTenji.js';
import { validVerifiedRace } from '../../../../lib/narutoKaratsuVerifiedTenji.js';
import { validTamagawaRace } from '../../../../lib/tamagawaVerifiedTenji.js';
import { validTokuyamaRace } from '../../../../lib/tokuyamaVerifiedOriginalTenji.js';
import { validShimonosekiWakamatsuRace } from '../../../../lib/shimonosekiWakamatsuVerifiedOriginalTenji.js';
import { validSuminoeOmuraRace } from '../../../../lib/suminoeOmuraVerifiedOriginalTenji.js';
import { validHamanakoAshiyaRace } from '../../../../lib/hamanakoAshiyaVerifiedOriginalTenji.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 25;
let lastRequest = 0;

function validCurrentDayVenue(race) {
  return [9,10,13].includes(Number(race?.courseCode))
    && Number.isInteger(Number(race?.raceNo)) && Number(race.raceNo) >= 1 && Number(race.raceNo) <= 12
    && /^20\d{2}-\d{2}-\d{2}$/.test(race?.raceDate || '');
}

export async function GET(request) {
  const q = new URL(request.url).searchParams;
  const race = { courseCode: Number(q.get('course')), raceDate: q.get('date'), raceNo: Number(q.get('race')) };
  const reply = (body, status=200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
  // Fixed verified venues only; no arbitrary URL, credentials, DB, or notifications.
  if (!validMarugameRace(race) && !validVerifiedRace(race) && !validTamagawaRace(race) && !validTokuyamaRace(race) && !validShimonosekiWakamatsuRace(race) && !validSuminoeOmuraRace(race) && !validHamanakoAshiyaRace(race) && !validCurrentDayVenue(race)) return reply({ ok:false, error:'invalid_or_unverified_venue' },400);
  if (Date.now()-lastRequest < 1000) return reply({ok:false,error:'retry_later'},429);
  lastRequest=Date.now();
  return reply({ readOnly:true, requested:race, ...(await fetchBestOriginalTenji(race)) });
}
