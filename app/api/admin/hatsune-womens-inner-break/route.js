import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getSupabase(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)throw new Error("Supabase環境変数が未設定です");
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
function jstToday(){return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());}
function keyOf(row){return `${row.race_date}-${Number(row.course_code)}-${Number(row.race_no)}`;}
function calcStats(rows){
  const alerts=rows||[];
  const finished=alerts.filter(r=>Number.isFinite(Number(r.result_rank))&&Number(r.result_rank)>0);
  const first=finished.filter(r=>Number(r.result_rank)===1).length;
  const top2=finished.filter(r=>[1,2].includes(Number(r.result_rank))).length;
  const top3=finished.filter(r=>[1,2,3].includes(Number(r.result_rank))).length;
  return {matched:alerts.length,finished:finished.length,first,top2,top3,firstRate:finished.length?first/finished.length:null,top2Rate:finished.length?top2/finished.length:null,top3Rate:finished.length?top3/finished.length:null};
}
function buildDaily(rows){
  const map=new Map();
  for(const row of rows||[]){if(!map.has(row.race_date))map.set(row.race_date,[]);map.get(row.race_date).push(row);}
  return Array.from(map.entries()).map(([date,items])=>({date,...calcStats(items)})).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
}
async function enrichRows(supabase,rows){
  if(!rows?.length)return [];
  const dates=rows.map(x=>x.race_date).filter(Boolean).sort();
  const minDate=dates[0],maxDate=dates[dates.length-1];
  const {data:entries,error}=await supabase.from("bs_race_entries").select("race_date,course_code,race_no,boat_no,arrival_order").eq("boat_no",1).gte("race_date",minDate).lte("race_date",maxDate);
  if(error)throw error;
  const map=new Map((entries||[]).map(x=>[keyOf(x),x]));
  return rows.map(row=>({...row,result_rank:map.get(keyOf(row))?.arrival_order??null}));
}
export async function GET(request){
  try{
    const supabase=getSupabase();
    const {searchParams}=new URL(request.url);
    const date=searchParams.get("date")||jstToday();
    const mode=searchParams.get("mode")||"day";
    const fields="id,race_date,course_code,course_name,race_no,closing_time,boat1_exhibition,boat2_exhibition,exhibition_advantage,boat1_lap,boat2_lap,lap_advantage,danger_level,detected_at,notified,notified_at";
    let dayRows=[];
    if(mode!=="all"){
      const {data,error}=await supabase.from("bs_hatsune_womens_inner_break_alerts").select(fields).eq("race_date",date).order("closing_time",{ascending:false});
      if(error)throw error;
      dayRows=await enrichRows(supabase,data||[]);
    }
    const {data:allRows,error:allError}=await supabase.from("bs_hatsune_womens_inner_break_alerts").select(fields).order("race_date",{ascending:false}).order("closing_time",{ascending:false}).limit(5000);
    if(allError)throw allError;
    const history=await enrichRows(supabase,allRows||[]);
    return NextResponse.json({ok:true,date,mode,alerts:mode==="all"?history:dayRows,stats:calcStats(mode==="all"?history:dayRows),allStats:calcStats(history),daily:buildDaily(history),fetchedAt:new Date().toISOString()});
  }catch(error){return NextResponse.json({ok:false,error:error?.message||"取得に失敗しました"},{status:500});}
}
export async function POST(){
  try{
    const supabase=getSupabase();
    const {data,error}=await supabase.rpc("evaluate_hatsune_womens_inner_break_alerts");
    if(error)throw error;
    return NextResponse.json({ok:true,inserted:Number(data||0)});
  }catch(error){return NextResponse.json({ok:false,error:error?.message||"判定に失敗しました"},{status:500});}
}
