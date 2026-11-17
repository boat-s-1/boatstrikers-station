import { createClient } from "@supabase/supabase-js";

function db(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL||process.env.SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key) return null;
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
function todayJst(){return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date())}

export async function getXPostDiagnostics(){
  const supabase=db();
  if(!supabase) return {ok:false,date:todayJst(),message:"Supabase環境変数が不足しています。",characters:[]};
  const date=todayJst();
  const {data,error}=await supabase.from("ai_v2_daily_rankings")
    .select("id,character_code,rank_no,selected_for_social,course_code,race_no")
    .eq("ranking_date",date)
    .in("character_code",["ichika","hatsune","kiina"])
    .order("rank_no",{ascending:true});
  if(error) return {ok:false,date,message:`AIランキング取得エラー: ${error.message}`,characters:[]};
  const chars=["ichika","hatsune","kiina"].map(code=>{
    const rows=(data||[]).filter(r=>r.character_code===code);
    const eligible=rows.filter(r=>r.selected_for_social||r.rank_no===1);
    return {code,total:rows.length,eligible:eligible.length,top:eligible[0]?`${eligible[0].course_code} / ${eligible[0].race_no}R`:null};
  });
  return {ok:true,date,message:(data||[]).length?"当日ランキングを取得できています。":"当日ランキングが0件です。",characters:chars};
}
