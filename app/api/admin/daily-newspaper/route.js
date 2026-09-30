import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const COURSE_CODES={"桐生":1,"戸田":2,"江戸川":3,"平和島":4,"多摩川":5,"浜名湖":6,"蒲郡":7,"常滑":8,"津":9,"三国":10,"びわこ":11,"住之江":12,"尼崎":13,"鳴門":14,"丸亀":15,"児島":16,"宮島":17,"徳山":18,"下関":19,"若松":20,"芦屋":21,"福岡":22,"唐津":23,"大村":24};
const TYPES={ichika:["ichika_escape_best10"],hatsune:["hatsune_dominant_best3","hatsune_risky_best3"],kiina:["kiina_boat5_best5"]};
function client(){const url=process.env.NEXT_PUBLIC_SUPABASE_URL;const key=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;return url&&key?createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}}):null;}
function tickets(v){return Array.isArray(v)?v.map(x=>typeof x==="string"?x:(x?.combination||x?.ticket||x?.bet||"")).filter(Boolean).join(" / "):"";}
function autoSummary(character,rows){
 const picks=rows.filter(r=>r.mark!=="見").sort((a,b)=>parseFloat(b.confidence||0)-parseFloat(a.confidence||0));
 if(!picks.length)return {points:"",targets:"",closing:""};
 const top=picks.slice(0,3),targets=top.map(r=>r.race).join("・");
 const best=top[0],pct=best.confidence?`（${best.confidence}）`:"";
 if(character==="ichika")return {points:`イン逃げ候補は${picks.length}R。中でも${best.race}${pct}を中心に、1号艇の逃げ条件をチェック。`,targets,closing:`今日は${best.race}が一果の最注目！数字の強いインから、無理に広げず狙っていこう♪`};
 if(character==="kiina")return {points:`穴候補は${picks.length}R。中でも${best.race}${pct}の5号艇を中心に、波乱の入口をチェック。`,targets,closing:`キイナは${best.race}に注目！5号艇の気配が数字に出ているレースから、穴の一撃を狙うよ⚡`};
 return {points:`女子戦AIの注目候補は${picks.length}R。中でも${best.race}${pct}を中心に、展開とリズムをチェック。`,targets,closing:`今日は${best.race}が初音の注目レース♡ AIデータをヒントに、狙いどころを絞って見ていこう！`};
}
export async function GET(req){
 const {searchParams}=new URL(req.url);const date=searchParams.get("date")||"";const course=searchParams.get("course")||"";const character=searchParams.get("character")||"ichika";const edition=searchParams.get("edition")||"前日版";const code=COURSE_CODES[course];
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!code||!TYPES[character]) return NextResponse.json({error:"invalid_request"},{status:400});
 const db=client();if(!db)return NextResponse.json({error:"supabase_not_configured"},{status:500});
 const timing=edition==="前日版"?"previous_day":"after_exhibition";
 const [events,rankings,preds]=await Promise.all([
  db.from("bs_race_events").select("course_code,race_no,closing_time").eq("race_date",date).eq("course_code",code).order("race_no"),
  db.from("ai_v2_daily_rankings").select("character_code,ranking_type,rank_no,course_code,race_no,probability,summary,social_comment,data_timing").eq("ranking_date",date).eq("course_code",code).eq("data_timing",timing).in("ranking_type",TYPES[character]),
  db.from("bsc_official_predictions").select("character_code,ranking_type,rank_no,course_code,race_no,tickets,prediction_label,published_at").eq("race_date",date).eq("course_code",code).eq("timing",timing).eq("source_table","ai_v2_daily_rankings").in("ranking_type",TYPES[character]).order("published_at",{ascending:false})
 ]);
 if(events.error)return NextResponse.json({error:events.error.message},{status:500});
 const rankingByRace=new Map();for(const r of rankings.data||[]){const n=Number(r.race_no);if(!rankingByRace.has(n))rankingByRace.set(n,r);}
 const predByRace=new Map();for(const p of preds.data||[]){const n=Number(p.race_no);if(!predByRace.has(n))predByRace.set(n,p);}
 const rows=Array.from({length:12},(_,i)=>{const raceNo=i+1,r=rankingByRace.get(raceNo),p=predByRace.get(raceNo);const prob=Number(r?.probability);return {race:`${raceNo}R`,mark:r?(prob>=.8?"◎":prob>=.65?"○":"▲"):"見",main:character==="ichika"&&r?"1号艇":character==="kiina"&&r?"5号艇":"",bet:tickets(p?.tickets),confidence:Number.isFinite(prob)?`${(prob*100).toFixed(1)}%`:"",comment:r?.social_comment||r?.summary||p?.prediction_label||""};});
 const summary=autoSummary(character,rows);
 return NextResponse.json({date,course,character,timing,eventCount:(events.data||[]).length,rankingCount:(rankings.data||[]).length,predictionCount:(preds.data||[]).length,rows,...summary});
}
