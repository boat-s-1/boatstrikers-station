// Offline-only quarantine planner. NOT connected to a database or Cron.
// Caller must validate the entire source program before calling this.
import { classifyResultLayer } from './openapi-result-quarantine.prototype.mjs';

const KEY=/^(?:[1-9]|1[0-9]|2[0-4])$/;
const RACE=/^(?:[1-9]|1[0-2])$/;
function fail(reason) { throw new Error('snapshot program invalid: '+reason); }

export function planQuarantinedResults(snapshot, capture) {
  if (!capture || typeof capture !== 'object' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(capture.raceDate ?? '') ||
      !/^[a-f0-9]{64}$/.test(capture.sourceSha256 ?? '') ||
      !Number.isFinite(Date.parse(capture.capturedAt ?? ''))) fail('capture metadata');
  const stadiums=snapshot?.programs?.stadiums;
  if (!stadiums || typeof stadiums !== 'object' || Array.isArray(stadiums)) fail('stadiums');
  const accepted=[], quarantine=[], pending=[], programs=[];
  const seen=new Set();
  for (const [stadiumKey, stadium] of Object.entries(stadiums)) {
    if (!KEY.test(stadiumKey) || !stadium || typeof stadium !== 'object' ||
        Array.isArray(stadium) || !stadium.races ||
        typeof stadium.races !== 'object' || Array.isArray(stadium.races)) fail('stadium identity');
    for (const [raceKey,race] of Object.entries(stadium.races)) {
      if (!RACE.test(raceKey) || !race || typeof race !== 'object' || Array.isArray(race) ||
          String(race.stadium_number)!==stadiumKey ||
          String(race.race_number)!==raceKey ||
          race.date!==capture.raceDate) fail('race identity');
      const boats=race.racers;
      if (!boats || typeof boats !== 'object' || Array.isArray(boats) ||
          Object.keys(boats).length!==6) fail('six boats');
      const registrations=new Set();
      for(let boat=1;boat<=6;boat++){
        const racer=boats[String(boat)];
        if (!racer || typeof racer!=='object' || Array.isArray(racer) ||
            String(racer.entry_number)!==String(boat) ||
            !/^(?:[0-9]{4}|0[0-9]{4})$/.test(String(racer.number??'')) ||
            /^0+$/.test(String(racer.number))) fail('boat identity');
        registrations.add(String(racer.number));
      }
      if(registrations.size!==6) fail('duplicate racer');
      const key=[capture.raceDate,stadiumKey,raceKey].join(':');
      if(seen.has(key)) fail('duplicate race');
      seen.add(key);
      programs.push({raceDate:capture.raceDate,courseCode:Number(stadiumKey),raceNo:Number(raceKey)});
      const status=classifyResultLayer(race);
      const record={...programs.at(-1),sourceSha256:capture.sourceSha256,
        capturedAt:capture.capturedAt,status:status.status,reason:status.reason};
      if(status.status==='ACCEPT') accepted.push(record);
      else if(status.status==='QUARANTINE') quarantine.push({...record,field:status.field??null});
      else pending.push(record);
    }
  }
  if(programs.length===0 || programs.length>288) fail('race count');
  return {programs,accepted,quarantine,pending};
}
