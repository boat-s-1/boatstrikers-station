// One bounded GET to the public official chart. No API credentials or database writes.
import {validDate,jstDate} from '../lib/gamagori-date.mjs';
import {parseGamagoriChart} from '../lib/gamagori-chart-parser.ts';
import {probeGamagoriPublication} from '../lib/gamagori-chart-publication.mjs';
const args=Object.fromEntries(process.argv.slice(2).map(a=>{const i=a.indexOf('=');return [a.slice(0,i),a.slice(i+1)];}));
const date=args['--date']??jstDate(Date.now()),race=Number(args['--race']??1);
if(!validDate(date)||date>jstDate(Date.now())||!Number.isInteger(race)||race<1||race>12||Object.keys(args).some(k=>!['--date','--race'].includes(k)))throw Error('invalid_date_or_race');
console.log(JSON.stringify({collection_permitted:false,collection_executed:false,...await probeGamagoriPublication({date,race,parse:parseGamagoriChart})}));
