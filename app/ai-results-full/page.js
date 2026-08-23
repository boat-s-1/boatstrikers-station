import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import styles from "../ai-results/stats.module.css";

export const dynamic = "force-dynamic";

const MODE_ORDER = ["oni", "hit", "recovery", "hole"];
const MODE_META = {
  oni: { label: "鬼絞り", emoji: "🔥" },
  hit: { label: "的中率", emoji: "🎯" },
  recovery: { label: "回収率", emoji: "💰" },
  hole: { label: "穴狙い", emoji: "🚀" },
};
const COURSE_NAMES = {
  1:"桐生",2:"戸田",3:"江戸川",4:"平和島",5:"多摩川",6:"浜名湖",7:"蒲郡",8:"常滑",9:"津",10:"三国",11:"びわこ",12:"住之江",
  13:"尼崎",14:"鳴門",15:"丸亀",16:"児島",17:"宮島",18:"徳山",19:"下関",20:"若松",21:"芦屋",22:"福岡",23:"唐津",24:"大村",
};
const SELECT_COLUMNS = "race_date,course_code,race_no,mode_key,mode_name,is_hit,hit_ticket,tickets,ticket_count,investment,payout,profit,recovery_rate,result_combination,settled_at";

function getClient(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if(!url||!key) throw new Error("Supabase環境変数が設定されていません。");
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
function jstToday(){return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());}
function addDays(dateText,diff){const d=new Date(`${dateText}T00:00:00+09:00`);d.setUTCDate(d.getUTCDate()+diff);return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit"}).format(d);}
function monthStart(v){return `${v.slice(0,7)}-01`;}
function yen(v){return `${Math.round(Number(v||0)).toLocaleString("ja-JP")}円`;}
function signedYen(v){const n=Math.round(Number(v||0));return `${n>0?"+":""}${n.toLocaleString("ja-JP")}円`;}
function percent(v){return `${Number(v||0).toLocaleString("ja-JP",{maximumFractionDigits:1})}%`;}
function shortDate(v){const t=String(v||"");if(!/^\d{4}-\d{2}-\d{2}$/.test(t))return t;const[,m,d]=t.split("-");return `${Number(m)}/${Number(d)}`;}
function summarize(rows){
  const records=Array.isArray(rows)?rows:[];
  const hits=records.filter(r=>Boolean(r.is_hit)).length;
  const investment=records.reduce((s,r)=>s+Number(r.investment||0),0);
  const payout=records.reduce((s,r)=>s+Number(r.payout||0),0);
  const profit=payout-investment;
  const recoveryRate=investment>0?(payout/investment)*100:0;
  const hitRate=records.length>0?(hits/records.length)*100:0;
  const races=new Set(records.map(r=>`${r.race_date}:${r.course_code}:${r.race_no}`)).size;
  return{records:records.length,races,hits,investment,payout,profit,recoveryRate,hitRate};
}
function groupRows(rows,makeKey){const m=new Map();for(const r of rows||[]){const k=makeKey(r);if(!m.has(k))m.set(k,[]);m.get(k).push(r);}return m;}
function filterHref(current,changes={}){const next={...current,...changes};const p=new URLSearchParams();if(next.period&&next.period!=="today")p.set("period",next.period);if(next.course&&next.course!=="all")p.set("course",next.course);if(next.mode&&next.mode!=="all")p.set("mode",next.mode);return p.toString()?`?${p.toString()}`:"?";}
function periodLabel(p){return{today:"今日",yesterday:"昨日",week:"7日間",month:"今月",all:"全期間"}[p]||"今日";}
function resolveRange(period,today){if(period==="yesterday"){const d=addDays(today,-1);return{from:d,to:d};}if(period==="week")return{from:addDays(today,-6),to:today};if(period==="month")return{from:monthStart(today),to:today};if(period==="all")return{from:null,to:null};return{from:today,to:today};}

async function fetchAllRows({supabase,range,course,mode}){
  const PAGE_SIZE=1000;
  const all=[];
  for(let offset=0;offset<100000;offset+=PAGE_SIZE){
    let q=supabase.from("bs_ai_bet_results").select(SELECT_COLUMNS)
      .order("race_date",{ascending:false}).order("settled_at",{ascending:false})
      .range(offset,offset+PAGE_SIZE-1);
    if(range.from)q=q.gte("race_date",range.from);
    if(range.to)q=q.lte("race_date",range.to);
    if(course!=="all")q=q.eq("course_code",Number(course));
    if(mode!=="all")q=q.eq("mode_key",mode);
    const{data,error}=await q;
    if(error)throw error;
    const batch=data||[];
    all.push(...batch);
    if(batch.length<PAGE_SIZE)break;
  }
  return all;
}

export default async function AiBetPublicResultsPage({searchParams}){
  const params=await searchParams;
  const today=jstToday();
  const period=["today","yesterday","week","month","all"].includes(String(params?.period||""))?String(params.period):"today";
  const course=params?.course&&String(params.course)!=="all"?String(params.course):"all";
  const mode=params?.mode&&String(params.mode)!=="all"?String(params.mode):"all";
  const range=resolveRange(period,today);
  let safeRows=[];
  try{safeRows=await fetchAllRows({supabase:getClient(),range,course,mode});}
  catch(error){return <main className={styles.page}><section className={styles.errorCard}><strong>成績を読み込めませんでした。</strong><span>{error.message}</span></section></main>;}

  const summary=summarize(safeRows);
  const modeStats=[...groupRows(safeRows,r=>r.mode_key||"other").entries()].map(([key,items])=>({key,...summarize(items)})).sort((a,b)=>MODE_ORDER.indexOf(a.key)-MODE_ORDER.indexOf(b.key));
  const dailyStats=[...groupRows(safeRows,r=>r.race_date).entries()].map(([date,items])=>({date,...summarize(items)})).sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,period==="all"?31:14);
  const courseStats=[...groupRows(safeRows,r=>Number(r.course_code)).entries()].map(([code,items])=>({code,...summarize(items)})).sort((a,b)=>b.recoveryRate-a.recoveryRate).slice(0,24);
  const recentHits=safeRows.filter(r=>Boolean(r.is_hit)).slice(0,12);
  const current={period,course,mode};
  const selectedCourseName=course==="all"?"全場":COURSE_NAMES[Number(course)]||`#${course}`;
  const selectedModeName=mode==="all"?"全モード":MODE_META[mode]?.label||mode;

  return <main className={styles.page}>
    <section className={styles.hero}>
      <div className={styles.heroCopy}><p className={styles.eyebrow}>BOATSTRIKERS PERFORMANCE</p><h1>AI予想成績</h1><p>実際の買い目を100円単位で集計した成績です。期間・レース場・買い方を切り替えて確認できます。</p></div>
      <div className={styles.heroBadge}><span>{periodLabel(period)}</span><strong>{selectedCourseName}</strong><small>{selectedModeName}</small></div>
    </section>

    <nav className={styles.periodTabs} aria-label="期間を選択">{[["today","今日"],["yesterday","昨日"],["week","7日間"],["month","今月"],["all","全期間"]].map(([key,label])=><Link key={key} href={filterHref(current,{period:key})} className={period===key?styles.activeTab:""}>{label}</Link>)}</nav>

    <section className={styles.filterPanel}>
      <div className={styles.filterBlock}><span>レース場</span><div className={styles.chipScroller}><Link href={filterHref(current,{course:"all"})} className={course==="all"?styles.activeChip:""}>全場</Link>{Object.entries(COURSE_NAMES).map(([code,name])=><Link key={code} href={filterHref(current,{course:code})} className={course===code?styles.activeChip:""}>{name}</Link>)}</div></div>
      <div className={styles.filterBlock}><span>買い方</span><div className={styles.modeChips}><Link href={filterHref(current,{mode:"all"})} className={mode==="all"?styles.activeChip:""}>全モード</Link>{MODE_ORDER.map(key=><Link key={key} href={filterHref(current,{mode:key})} className={mode===key?styles.activeChip:""}>{MODE_META[key].emoji} {MODE_META[key].label}</Link>)}</div></div>
    </section>

    <section className={styles.summarySection}>
      <div className={styles.sectionHeading}><div><p>PERFORMANCE</p><h2>{periodLabel(period)}の成績</h2></div><span>{summary.races}レース集計</span></div>
      {summary.records===0?<div className={styles.emptyCard}><span>📊</span><strong>まだ集計対象の成績がありません</strong><p>レース結果の精算後、自動でここに反映されます。</p></div>:<><div className={styles.primaryMetrics}>
        <article className={styles.metricHero}><span>的中率</span><strong>{percent(summary.hitRate)}</strong><small>{summary.hits}/{summary.records} モード的中</small></article>
        <article className={styles.metricHero}><span>回収率</span><strong className={summary.recoveryRate>=100?styles.goodValue:styles.normalValue}>{percent(summary.recoveryRate)}</strong><small>払戻 ÷ 投資</small></article>
      </div><div className={styles.moneyGrid}><article><span>投資</span><strong>{yen(summary.investment)}</strong></article><article><span>払戻</span><strong>{yen(summary.payout)}</strong></article><article className={summary.profit>=0?styles.profitCard:styles.lossCard}><span>収支</span><strong>{signedYen(summary.profit)}</strong></article></div></>}
    </section>

    {mode==="all"&&modeStats.length>0&&<section className={styles.section}><div className={styles.sectionHeading}><div><p>BET STYLE</p><h2>買い方別成績</h2></div></div><div className={styles.modeGrid}>{modeStats.map(row=>{const meta=MODE_META[row.key]||{label:row.key,emoji:"📌"};return <Link href={filterHref(current,{mode:row.key})} className={styles.modeCard} key={row.key}><div className={styles.modeTop}><h3>{meta.emoji} {meta.label}</h3><span>{row.records}件</span></div><div className={styles.modeMetrics}><div><span>的中率</span><strong>{percent(row.hitRate)}</strong></div><div><span>回収率</span><strong>{percent(row.recoveryRate)}</strong></div></div><div className={row.profit>=0?styles.modeProfitPlus:styles.modeProfitMinus}>収支 {signedYen(row.profit)}</div></Link>})}</div></section>}

    {recentHits.length>0&&<section className={styles.section}><div className={styles.sectionHeading}><div><p>HIT RESULTS</p><h2>最近の的中</h2></div><span>{recentHits.length}件表示</span></div><div className={styles.hitList}>{recentHits.map((row,index)=>{const meta=MODE_META[row.mode_key]||{label:row.mode_name||row.mode_key,emoji:"🎯"};return <article className={styles.hitCard} key={`${row.race_date}-${row.course_code}-${row.race_no}-${row.mode_key}-${index}`}><div className={styles.hitMark}>的中</div><div className={styles.hitMain}><span>{shortDate(row.race_date)}・{COURSE_NAMES[Number(row.course_code)]||`#${row.course_code}`}</span><strong>{row.race_no}R　{meta.emoji} {meta.label}</strong><small>{row.hit_ticket||row.result_combination||"的中"}</small></div><div className={styles.hitPayout}><span>払戻</span><strong>{yen(row.payout)}</strong></div></article>})}</div></section>}

    {dailyStats.length>0&&<section className={styles.section}><div className={styles.sectionHeading}><div><p>DAILY PERFORMANCE</p><h2>日別成績</h2></div></div><div className={styles.dailyList}>{dailyStats.map(row=><article className={styles.dailyCard} key={row.date}><div className={styles.dailyDate}><strong>{shortDate(row.date)}</strong><span>{row.races}R</span></div><div><span>的中率</span><strong>{percent(row.hitRate)}</strong></div><div><span>回収率</span><strong>{percent(row.recoveryRate)}</strong></div><div className={row.profit>=0?styles.textProfit:styles.textLoss}><span>収支</span><strong>{signedYen(row.profit)}</strong></div></article>)}</div></section>}

    {course==="all"&&courseStats.length>0&&<section className={styles.section}><div className={styles.sectionHeading}><div><p>COURSE PERFORMANCE</p><h2>場別成績</h2></div><span>回収率順</span></div><div className={styles.courseList}>{courseStats.map((row,index)=><Link href={filterHref(current,{course:String(row.code)})} className={styles.courseCard} key={row.code}><span className={styles.rank}>#{index+1}</span><div className={styles.courseName}><strong>{COURSE_NAMES[row.code]||`#${row.code}`}</strong><small>{row.races}R</small></div><div><span>的中率</span><strong>{percent(row.hitRate)}</strong></div><div><span>回収率</span><strong>{percent(row.recoveryRate)}</strong></div><div className={row.profit>=0?styles.textProfit:styles.textLoss}><span>収支</span><strong>{signedYen(row.profit)}</strong></div></Link>)}</div></section>}

    <p className={styles.disclaimer}>※表示成績はAIが提示した買い目を各100円で購入した想定の集計です。舟券購入はご自身の判断と資金管理のもとで行ってください。</p>
  </main>;
}
