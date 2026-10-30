// One explicitly selected date per invocation. Dry-run unless --execute is supplied.
// Use an authenticated, origin-scoped access mechanism for protected previews.
const [date, flag] = process.argv.slice(2);
if (!/^20\d{2}-\d{2}-\d{2}$/.test(date || '') || Number.isNaN(Date.parse(date)) || new Date(date).toISOString().slice(0,10) !== date) throw Error('YYYY-MM-DD required');
const endpoint = process.env.GAMAGORI_COLLECTOR_URL;
if (!endpoint) throw Error('GAMAGORI_COLLECTOR_URL required');
const url = new URL(endpoint);
if (url.protocol !== 'https:' || url.pathname !== '/api/cron/gamagori-chart-collect') throw Error('Explicit HTTPS collector endpoint required');
const execute = flag === '--execute';
if (execute && !process.env.CRON_SECRET) throw Error('CRON_SECRET required');
for (const race of [1,4,7,10]) {
  url.search = new URLSearchParams({date,race:String(race),limit:'3'}).toString();
  if (!execute) {console.log(JSON.stringify({date,race,limit:3,mode:'dry-run'}));continue;}
  const headers = {authorization:`Bearer ${process.env.CRON_SECRET}`};
  if (process.env.VERCEL_OIDC_TOKEN) headers['x-vercel-trusted-oidc-idp-token'] = process.env.VERCEL_OIDC_TOKEN;
  let response;
  try {response = await fetch(url,{headers,signal:AbortSignal.timeout(60000),redirect:'error'});} catch {throw Error('collector request failed; stopped');}
  if (!response.ok) throw Error(`collector HTTP ${response.status}; stopped`);
  let result;try {result = await response.json();} catch {throw Error('non-JSON response; stopped');}
  // Print only expected structured fields, never raw response bodies or headers.
  if (!Array.isArray(result.results)) throw Error('unexpected collector response');
  console.log(JSON.stringify({date,results:result.results.map(x=>({race:x.race,status:x.status,reason:x.reason}))}));
  if (result.results.some(x=>!['saved','skipped_existing','skipped_no_event'].includes(x.status))) throw Error('batch needs review; stopped');
  if (race < 10) await new Promise(r=>setTimeout(r,15000));
}
