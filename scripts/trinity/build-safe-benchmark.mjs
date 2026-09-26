import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';

const [ledgerPath, julyAuditPath] = process.argv.slice(2);
if (!ledgerPath || !julyAuditPath) {
  throw new Error('Usage: node scripts/trinity/build-safe-benchmark.mjs <legacy-v2-ledger.jsonl> <july-audit.csv>');
}
const ledger = readFileSync(ledgerPath, 'utf8').trim().split('\n').map(JSON.parse);
const july = new Map(readFileSync(julyAuditPath, 'utf8').trim().split('\n').slice(1).map(line => {
  const [date, course, race, closing, first, last, updated, proxy, boats, grade, reason] = line.split(',');
  return [`${date}:${Number(course)}:${Number(race)}`, { date, boats: Number(boats), first, last, updated, reason }];
}));
const monthly = Object.groupBy(ledger, r => r.date.slice(0, 7));
const annotated = ledger.map(r => {
  const j = july.get(r.key);
  const reason = j ? j.reason === 'entry_created_after_closing' ?
    'U1_post_race_calendar_creation' : 'U2_features_updated_after_closing' :
    'not_certified_current_rows_updated_after_closing';
  return { key: r.key, date: r.date, grade: 'UNSAFE', reason,
    alternate_source: j ? 'ai_v2_training_rows:historical_reconstructed,not_asof' :
      'ai_v2_predictions:partial_features_or_no_snapshot',
    source: 'bs_race_entries:current_rows' };
});
function summarize(rows) {
  if (!rows.length) return { status: 'UNAVAILABLE_NO_CERTIFIED_INPUT', races: 0,
    bought_races: 0, passed_races: 0, investment: null, payout: null, profit: null,
    hits: null, hit_rate: null, roi: null, avg_tickets: null,
    max_losing_streak: null, max_payout: null, roi_without_top1: null,
    roi_without_top3: null, roi_without_top5: null };
  const bought = rows.filter(r => r.investment);
  const investment = bought.reduce((s,r) => s + r.investment,0);
  const payout = bought.reduce((s,r) => s + r.payout,0);
  const hits = bought.filter(r => r.hit).length;
  let streak=0,maxStreak=0;
  for(const r of bought) { streak=r.hit?0:streak+1; maxStreak=Math.max(maxStreak,streak); }
  const winners=[...bought].filter(r=>r.payout).sort((a,b)=>b.payout-a.payout);
  const without=n=>{
    const exclude=new Set(winners.slice(0,n).map(r=>r.key));
    const remaining=bought.filter(r=>!exclude.has(r.key));
    const cost=remaining.reduce((s,r)=>s+r.investment,0);
    return cost?remaining.reduce((s,r)=>s+r.payout,0)/cost*100:null;
  };
  return { status: 'RECONSTRUCTED_NOT_ASOF', races: rows.length,
    bought_races: bought.length, passed_races: rows.length-bought.length,
    investment,payout,profit:payout-investment,hits,
    hit_rate: bought.length?hits/bought.length*100:null,
    roi: investment?payout/investment*100:null,
    avg_tickets: bought.length?investment/100/bought.length:null,
    max_losing_streak:maxStreak,max_payout:winners[0]?.payout||0,
    roi_without_top1:without(1),roi_without_top3:without(3),roi_without_top5:without(5) };
}
mkdirSync('data/trinity',{recursive:true});
const out=(name,value)=>writeFileSync(`data/trinity/${name}`,JSON.stringify(value,null,2)+'\n');
out('v2-strict-benchmark.json',{name:'STRICT',official:false,reason:'No six-boat immutable as-of feature snapshots including average_st',...summarize([]),monthly_races:{'2026-07':0,'2026-08':0,'2026-09':0}});
out('v2-extended-benchmark.json',{name:'EXTENDED',official:false,reason:'No historical reconstruction independently verifies all V2 features at prediction cutoff',...summarize([])});
out('v2-legacy-benchmark.json',{name:'LEGACY',official:false,reason:'Current historical rows; for comparison only',...summarize(ledger),monthly:Object.fromEntries(Object.entries(monthly).map(([m,rs])=>[m,summarize(rs)]))});
writeFileSync('data/trinity/safe-race-classification.csv',
  'race_date,course_code,race_no,safe_grade,reason,alternate_source,source\n'+
  annotated.map(r=>{const [d,c,n]=r.key.split(':');return [d,c,n,r.grade,r.reason,r.alternate_source,r.source].join(',')}).join('\n')+'\n');
const julyAll=[...july.entries()];
const reasons=['U1_post_race_calendar_creation','U2_features_updated_after_closing','U3_missing_time','U4_historical_reconstruction_origin','U5_other'];
const eligibleKeys=new Set(ledger.map(r=>r.key));
const unsafeReasons=reasons.map(reason=>{
  const members=julyAll.filter(([key,row])=>reason==='U1_post_race_calendar_creation'?
    row.reason==='entry_created_after_closing':reason==='U2_features_updated_after_closing'?
    row.reason==='pre_close_creation_but_later_update_or_no_snapshot':reason==='U4_historical_reconstruction_origin'?
      row.reason==='entry_created_after_closing' && eligibleKeys.has(key):false);
  return [reason,members.length,members.reduce((s,[,r])=>s+r.boats,0),
    members.length?members[0][1].date:'',members.length?members.at(-1)[1].date:'',
    reason.startsWith('U1')?'historical_reconstructed_only_for_2852_of_2856_no_verified_asof':
    reason.startsWith('U2')?'historical_reconstructed_only_no_verified_asof':
    reason.startsWith('U4')?'ai_v2_training_rows_aug20_backfill_not_asof':'none',
    reason.startsWith('U4')?'U1':''];
});
writeFileSync('data/trinity/unsafe-reasons.csv',
  'reason,races,boats,min_date,max_date,alternative,overlap_with\n'+unsafeReasons.map(r=>r.join(',')).join('\n')+'\n');
console.log(JSON.stringify({strict:0,extended:0,legacy:ledger.length,
  july_unsafe_reasons:Object.fromEntries(unsafeReasons.map(r=>[r[0],r[1]]))},null,2));
