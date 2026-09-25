import { createClient } from '@supabase/supabase-js';
import { buildTrinityCoreV2 } from '../../app/lib/trinityCoreV2.js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');

const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const from = process.env.TRINITY_FROM || '2026-07-01';
const to = process.env.TRINITY_TO || '2026-09-25';
const timing = process.env.TRINITY_TIMING || 'previous_day';
const pageSize = 1000;

async function readAll(table, select, filters = []) {
  const rows = [];
  for (let start = 0; ; start += pageSize) {
    let q = supabase.from(table).select(select).range(start, start + pageSize - 1);
    for (const [method, ...args] of filters) q = q[method](...args);
    const { data, error } = await q;
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

const raceKey = (r) => `${r.race_date}:${Number(r.course_code)}:${Number(r.race_no)}`;
const normalizeTicket = (s) => String(s || '').replace(/[^1-6]/g, '').slice(0, 3).split('').join('-');

function summarize(rows) {
  const bought = rows.filter((r) => r.investment > 0);
  const investment = bought.reduce((s, r) => s + r.investment, 0);
  const payout = bought.reduce((s, r) => s + r.payout, 0);
  const hits = bought.filter((r) => r.hit).length;
  let maxLosingStreak = 0, streak = 0;
  for (const r of bought) { if (r.hit) streak = 0; else { streak += 1; maxLosingStreak = Math.max(maxLosingStreak, streak); } }
  const winners = bought.filter((r) => r.payout > 0).sort((a,b) => b.payout-a.payout);
  const withoutTop = (n) => {
    const removed = new Set(winners.slice(0,n).map((r) => r.key));
    const p = bought.filter((r) => !removed.has(r.key)).reduce((s,r) => s+r.payout,0);
    return investment ? p / investment * 100 : 0;
  };
  return {
    races: rows.length, bought_races: bought.length, passed_races: rows.length-bought.length,
    pass_rate: rows.length ? (rows.length-bought.length)/rows.length*100 : 0,
    tickets: bought.reduce((s,r)=>s+r.ticket_count,0), investment, payout, profit:payout-investment,
    hits, hit_rate:bought.length?hits/bought.length*100:0, roi:investment?payout/investment*100:0,
    avg_tickets:bought.length?bought.reduce((s,r)=>s+r.ticket_count,0)/bought.length:0,
    max_losing_streak:maxLosingStreak, roi_without_top1:withoutTop(1), roi_without_top3:withoutTop(3),
    max_payout:winners[0]?.payout || 0,
  };
}

const events = await readAll('bs_race_events','race_date,course_code,race_no,race_name,deadline_time', [['gte','race_date',from],['lte','race_date',to],['order','race_date',{ascending:true}],['order','course_code',{ascending:true}],['order','race_no',{ascending:true}]]);
const entries = await readAll('bs_race_entries','race_date,course_code,race_no,boat_no,racer_name,sex_code,gender,gender_code,national_win_rate,local_win_rate,motor_2_rate,motor_top2_rate,boat_2_rate,race_boat_top2_rate,average_st,exhibition_time,exhibition_st,official_lap,lap_time,official_turn,turn_time,official_straight,straight_time,exhibition_fl', [['gte','race_date',from],['lte','race_date',to]]);
const results = await readAll('bs_race_results','race_date,course_code,race_no,winning_trifecta,trifecta_result,trifecta_payout,result_status,race_status', [['gte','race_date',from],['lte','race_date',to]]);

const entryMap = new Map();
for (const e of entries) { const k=raceKey(e); if(!entryMap.has(k)) entryMap.set(k,[]); entryMap.get(k).push(e); }
const resultMap = new Map(results.map((r)=>[raceKey(r),r]));
const settled=[];
for (const event of events) {
  const key=raceKey(event), six=(entryMap.get(key)||[]).sort((a,b)=>a.boat_no-b.boat_no), result=resultMap.get(key);
  if (six.length!==6 || !result?.trifecta_payout) continue;
  const actual=normalizeTicket(result.winning_trifecta || result.trifecta_result);
  if (!actual || actual.length!==5) continue;
  const prediction=buildTrinityCoreV2({event,entries:six,timing});
  if (!prediction.ok) continue;
  const tickets=prediction.trinity.selected_tickets || [];
  const hit=tickets.some((t)=>normalizeTicket(t.combination)===actual);
  settled.push({key,date:event.race_date,course_code:event.course_code,race_no:event.race_no,ticket_count:tickets.length,investment:tickets.length*100,hit,payout:hit?Number(result.trifecta_payout):0,actual,top:prediction.trinity.top_combination?.combination||null});
}

const monthly={};
for (const r of settled) { const m=r.date.slice(0,7); (monthly[m] ||= []).push(r); }
const report={engine:'trinity-core-v2',timing,period:{from,to},generated_at:new Date().toISOString(),read_only:true,summary:summarize(settled),monthly:Object.fromEntries(Object.entries(monthly).map(([m,rs])=>[m,summarize(rs)]))};
console.log(JSON.stringify(report,null,2));
