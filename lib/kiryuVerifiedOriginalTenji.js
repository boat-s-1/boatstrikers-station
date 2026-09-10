import { fetchNationalBeforeInfo, verifyNationalBeforeInfo } from './nationalBeforeInfoIdentity.js';

const clean = value => String(value || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ').replace(/[\s\u3000]+/g, ' ').trim();
const compact = value => clean(value).replace(/\s+/g, '');
const fail = error => ({ ok:false, supported:true, published:false, source:'kiryu_official_verified', sourceLabel:'BOAT RACE桐生公式', rows:[], error });
const numeric = (value, min, max) => {
  const text = clean(value);
  if (!/^\d{1,2}\.\d{2}$/.test(text)) return null;
  const result = Number(text);
  return result >= min && result <= max ? result : null;
};
const cell = (row, token) => {
  const found = [...String(row || '').matchAll(/<td\b([^>]*)>([\s\S]*?)<\/td>/gi)]
    .find(match => new RegExp(`(?:^|\\s)${token}(?:\\s|$)`).test(match[1].match(/class=(['"])(.*?)\1/i)?.[2] || ''));
  return found?.[2] ?? null;
};

export function validKiryuRace(race) {
  const date = String(race?.raceDate || ''), raceNo = Number(race?.raceNo);
  return Number(race?.courseCode) === 1 && Number.isInteger(raceNo) && raceNo >= 1 && raceNo <= 12
    && /^20\d{2}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0,10) === date;
}

export function verifyKiryuPageIdentity(html, race) {
  if (!validKiryuRace(race)) return false;
  const month = Number(race.raceDate.slice(5,7)), day = Number(race.raceDate.slice(8)), raceNo = Number(race.raceNo);
  const text = clean(html).slice(0,5000);
  const dateOk = new RegExp(`0?${month}月0?${day}日`).test(text);
  const raceOk = new RegExp(`<option\\b(?=[^>]*value=(['"])\\./\\?page=yosou-cyokuzen&amp;race=${raceNo}\\1)(?=[^>]*\\bselected\\b)[^>]*>`, 'i').test(html)
    || new RegExp(`<option\\b(?=[^>]*value=(['"])\\./\\?page=yosou-cyokuzen&race=${raceNo}\\1)(?=[^>]*\\bselected\\b)[^>]*>`, 'i').test(html);
  return dateOk && raceOk;
}

export function parseKiryuOriginalTenji(ajaxHtml) {
  const source = String(ajaxHtml || ''), section = source.split('<!--sep-->')[0] || '';
  if (!/オリジナル展示データ/.test(section) || !/半周/.test(section) || !/まわり足/.test(section) || !/直線/.test(section)) return [];
  const racers = new Map();
  for (const match of source.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const racerNo = match[1].match(/(?:profile|season)\?toban=(\d{4})/i)?.[1];
    const boat = Number(compact(cell(match[1], 'col1')));
    if (racerNo && boat >= 1 && boat <= 6) racers.set(boat, racerNo);
  }
  const rows = [];
  for (const match of section.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const row = match[1], boatNo = Number(compact(cell(row, 'col1')));
    if (!(boatNo >= 1 && boatNo <= 6)) continue;
    const exhibitionTime = numeric(cell(row, 'col4'), 6, 8);
    // The header uses col5_1/col5_2/col5_3, while live measurement rows use
    // col5/col6/col7 for half-lap/turn/straight respectively.
    const halfLapTime = numeric(cell(row, 'col5'), 10, 25);
    const turnTime = numeric(cell(row, 'col6'), 2, 20);
    const straightTime = numeric(cell(row, 'col7'), 2, 20);
    const racerNo = racers.get(boatNo);
    if (!racerNo || [exhibitionTime,halfLapTime,turnTime,straightTime].some(value => value === null)) return [];
    rows.push({ boatNo, racerNo, exhibitionTime, lapTime:null, halfLapTime, turnTime, straightTime });
  }
  const unique = [...new Map(rows.map(row => [row.boatNo,row])).values()].sort((a,b)=>a.boatNo-b.boatNo);
  return unique.length === 6 && unique.every((row,index)=>row.boatNo===index+1) && new Set(unique.map(row=>row.racerNo)).size===6 ? unique : [];
}

export function verifyKiryu(originalHtml, ajaxHtml, referenceHtml, race) {
  if (!verifyKiryuPageIdentity(originalHtml,race)) return fail('source_identity_mismatch');
  const rows = parseKiryuOriginalTenji(ajaxHtml);
  if (rows.length !== 6) return fail(/表示するデータがありません|-.--/.test(ajaxHtml) ? 'not_published' : 'timing_layout_changed');
  const reference = verifyNationalBeforeInfo(referenceHtml,race);
  if (!reference.ok) return fail(reference.error || 'reference_unavailable');
  return verifyRows(rows,reference.rows,race);
}

function verifyRows(rows, referenceRows, race) {
  for (const row of rows) {
    const matched = referenceRows.find(item=>item.boatNo===row.boatNo && item.racerNo===row.racerNo);
    if (!matched || matched.exhibitionTime !== row.exhibitionTime) return fail('roster_or_exhibition_mismatch');
  }
  return { ok:true, supported:true, published:true, source:'kiryu_official_verified', sourceLabel:'BOAT RACE桐生公式', rows,
    identity:{verified:true,courseCode:1,raceDate:race.raceDate,raceNo:Number(race.raceNo),evidence:'official_selected_date_race_ajax_six_boat_racer_and_national_exhibition_match'},
    eligibleTheories:{ichika:false,hatsune:false,kiina:true}, availableMetrics:['exhibition','half_lap','turn','straight'] };
}

function kiryuSessionCookie(headers) {
  const setCookie = headers?.get?.('set-cookie') || '';
  const session = setCookie.match(/(?:^|[,;]\s*)PHPSESSID=([A-Za-z0-9,-]+)/i)?.[1];
  return session ? `PHPSESSID=${session}` : null;
}

async function text(url, options, timeoutMs, extraHeaders={}) {
  const controller = new AbortController(), timer = setTimeout(()=>controller.abort(),timeoutMs);
  try {
    const response = await fetch(url,{cache:'no-store',redirect:'manual',signal:controller.signal,headers:{'user-agent':'BoatStrikers/1.0 (+https://www.boat-strike.online/)',...extraHeaders}});
    if (!response.ok) { await response.body?.cancel(); return {ok:false,error:'upstream_http_error',status:response.status}; }
    return {ok:true,html:await response.text(),sessionCookie:kiryuSessionCookie(response.headers)};
  } catch (error) { return {ok:false,error:error?.name==='AbortError'?'upstream_timeout':'upstream_fetch_failed'}; }
  finally { controller.abort();clearTimeout(timer); }
}

export async function fetchKiryuVerifiedOriginalTenji(race, options={}) {
  if (!validKiryuRace(race)) return fail('invalid_race');
  const raceNo=Number(race.raceNo), timeoutMs=Math.min(12000,Math.max(1000,Number(options.timeoutMs)||10000));
  const pageUrl=`https://www.kiryu-kyotei.com/sp/index.php?page=yosou-cyokuzen&race=${raceNo}`;
  const ajaxUrl=`https://www.kiryu-kyotei.com/sp/ajax/ajax_cyokuzen.php?race=${raceNo}`;
  // Kiryu stores the selected meeting/race in PHP session state while rendering
  // the shell page. A browser therefore requests the Ajax fragment with the
  // PHPSESSID issued by that page. Calling both endpoints in parallel creates
  // two unrelated sessions and the Ajax endpoint answers with an empty
  // "please wait" fragment even after the exhibition has been published.
  const [page,reference]=await Promise.all([text(pageUrl,options,timeoutMs),fetchNationalBeforeInfo(race,{timeoutMs})]);
  if (!page.ok) return {...fail(page.error),pageUrl,ajaxUrl};
  if (!verifyKiryuPageIdentity(page.html,race)) return {...fail('source_identity_mismatch'),pageUrl,ajaxUrl,referenceUrl:reference.url};
  if (!page.sessionCookie) return {...fail('source_session_missing'),pageUrl,ajaxUrl,referenceUrl:reference.url};
  const ajax=await text(ajaxUrl,options,timeoutMs,{
    cookie:page.sessionCookie,
    'x-requested-with':'XMLHttpRequest',
    referer:pageUrl,
  });
  if (!ajax.ok) return {...fail(ajax.error),pageUrl,ajaxUrl,referenceUrl:reference.url};
  if (!reference.ok) return {...fail(reference.error),pageUrl,ajaxUrl,referenceUrl:reference.url};
  const rows=parseKiryuOriginalTenji(ajax.html);
  if (rows.length!==6) return {...fail(/表示するデータがありません|-.--/.test(ajax.html)?'not_published':'timing_layout_changed'),pageUrl,ajaxUrl,referenceUrl:reference.url};
  return {...verifyRows(rows,reference.rows,race),pageUrl,ajaxUrl,referenceUrl:reference.url};
}
