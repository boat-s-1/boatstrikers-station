import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const STADIUMS={1:"桐生",2:"戸田",3:"江戸川",4:"平和島",5:"多摩川",6:"浜名湖",7:"蒲郡",8:"常滑",9:"津",10:"三国",11:"びわこ",12:"住之江",13:"尼崎",14:"鳴門",15:"丸亀",16:"児島",17:"宮島",18:"徳山",19:"下関",20:"若松",21:"芦屋",22:"福岡",23:"唐津",24:"大村"};

function client(){const url=process.env.NEXT_PUBLIC_SUPABASE_URL||process.env.SUPABASE_URL;const key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)return null;return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})}
function validDate(v){return /^\d{4}-\d{2}-\d{2}$/.test(String(v||""))}

export async function GET(request){
  const db=client();
  if(!db)return NextResponse.json({events:[],error:"Supabase環境変数がありません。"},{status:500});
  const {searchParams}=new URL(request.url);const date=searchParams.get("date");const mode=searchParams.get("mode")==="data"?"data":"ai";
  if(!validDate(date))return NextResponse.json({events:[],error:"日付が不正です。"},{status:400});
  const {data:grades,error:gerr}=await db.from("bs_grade_race_events").select("start_date,end_date,course_code,grade,title").lte("start_date",date).gte("end_date",date).order("course_code");
  if(gerr)return NextResponse.json({events:[],error:gerr.message},{status:500});
  if(!grades?.length)return NextResponse.json({events:[]});
  const codes=[...new Set(grades.map(x=>Number(x.course_code)))];
  const {data:races}=await db.from("bs_race_events").select("course_code,race_no,race_day_no,result_available,trifecta,trifecta_payout").eq("race_date",date).in("course_code",codes);
  let rankings=[];
  if(mode==="ai"){
    const {data}=await db.from("ai_v2_daily_rankings").select("course_code,race_no,probability,ranking_type").eq("ranking_date",date).in("course_code",codes);
    rankings=data||[];
  }
  const events=grades.map(g=>{
    const rr=(races||[]).filter(r=>Number(r.course_code)===Number(g.course_code));const done=rr.filter(r=>r.result_available&&Number(r.trifecta_payout)>0);const ai=rankings.filter(r=>Number(r.course_code)===Number(g.course_code));
    const boat1=done.filter(r=>String(r.trifecta||"").replace(/[^1-6]/g,"").startsWith("1")).length;const payouts=done.map(r=>Number(r.trifecta_payout||0)).filter(Number.isFinite);
    return {...g,course_name:STADIUMS[Number(g.course_code)]||`${g.course_code}場`,day_no:rr[0]?.race_day_no||null,ai_candidate_count:ai.length,best_probability:ai.length?Math.max(...ai.map(x=>Number(x.probability||0))):null,result_count:done.length,boat1_win_rate:done.length?(boat1/done.length)*100:null,manshu_count:done.filter(r=>Number(r.trifecta_payout)>=10000).length,avg_payout:payouts.length?payouts.reduce((a,b)=>a+b,0)/payouts.length:null};
  });
  return NextResponse.json({events});
}
