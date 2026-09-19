import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
const STADIUMS=["桐生","戸田","江戸川","平和島","多摩川","浜名湖","蒲郡","常滑","津","三国","びわこ","住之江","尼崎","鳴門","丸亀","児島","宮島","徳山","下関","若松","芦屋","福岡","唐津","大村"];
const TYPES=["ichika_escape_best10"];
const LABELS={"ichika_escape_best10":"イン逃げ期待 BEST10"};
function validDate(v){return /^\d{4}-\d{2}-\d{2}$/.test(String(v||""));}
export async function GET(request){
  const {searchParams}=new URL(request.url);
  const date=searchParams.get("date");
  const timing=searchParams.get("timing")==="after_exhibition"?"after_exhibition":"previous_day";
  if(!validDate(date)) return NextResponse.json({ok:false,error:"invalid_date"},{status:400});
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if(!url||!key) return NextResponse.json({ok:false,error:"supabase_config_missing"},{status:500});
  const supabase=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data,error}=await supabase.from("ai_v2_daily_rankings")
    .select("ranking_type,rank_no,course_code,race_no,probability,selected_for_social")
    .eq("ranking_date",date).eq("character_code","ichika").eq("data_timing",timing)
    .in("ranking_type",TYPES).order("ranking_type",{ascending:true}).order("rank_no",{ascending:true});
  if(error) return NextResponse.json({ok:false,error:"candidate_read_failed"},{status:500});
  return NextResponse.json({ok:true,candidates:(data||[]).map(r=>({
    rankingType:r.ranking_type,
    category:LABELS[r.ranking_type]||r.ranking_type,
    rankNo:Number(r.rank_no),
    courseCode:Number(r.course_code),
    courseName:STADIUMS[Number(r.course_code)-1]||String(r.course_code),
    raceNo:Number(r.race_no),
    probability:Number.isFinite(Number(r.probability))?(Number(r.probability)*100).toFixed(1):"",
    selectedForSocial:Boolean(r.selected_for_social)
  }))});
}