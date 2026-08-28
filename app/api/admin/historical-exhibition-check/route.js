import {fetchHistoricalOriginalTenji,validHistoricalRace} from '../../../../lib/historicalOriginalTenji.js';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=15;
const cache=new Map();
let lastStart=0;
export async function GET(request){
 const q=new URL(request.url).searchParams,race={courseCode:Number(q.get('course')),raceDate:q.get('date'),raceNo:Number(q.get('race'))};
 const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
 if(!validHistoricalRace(race))return reply({ok:false,error:'invalid_race'},400);
 const key=JSON.stringify(race),hit=cache.get(key);if(hit&&hit.until>Date.now())return reply({...hit.body,cached:true});
 if(Date.now()-lastStart<1000)return reply({ok:false,error:'retry_later'},429);lastStart=Date.now();
 const body={readOnly:true,requested:race,...await fetchHistoricalOriginalTenji(race)};
 if(cache.size>=24)cache.delete(cache.keys().next().value);cache.set(key,{body,until:Date.now()+60000});return reply(body);
}
