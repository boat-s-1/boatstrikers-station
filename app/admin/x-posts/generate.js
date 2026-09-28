"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const names={ichika:"一果",hatsune:"初音",kiina:"キイナ"};
const icons={ichika:"🌱",hatsune:"🐰",kiina:"⭐"};
const courseFallback=(code)=>`場コード${String(code).padStart(2,"0")}`;
function db(){return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}})}
function todayJst(){return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date())}
function finish(params){revalidatePath("/admin/x-posts");redirect(`/admin/x-posts?${new URLSearchParams(params).toString()}`)}

export async function generateCharacterDrafts(){
 const supabase=db();const date=todayJst();
 const {data:rankings,error}=await supabase.from("ai_v2_daily_rankings").select("id,character_code,rank_no,course_code,race_no,probability,summary,social_comment,selected_for_social,data_timing").eq("ranking_date",date).in("character_code",["ichika","hatsune","kiina"]).order("rank_no",{ascending:true});
 if(error)finish({gen:"error",message:`ランキング取得: ${error.message}`});
 if(!rankings?.length)finish({gen:"empty",message:`${date} のランキングが0件です`});
 const chosen=Object.values(rankings.reduce((a,r)=>{if(!a[r.character_code]&&(r.selected_for_social||r.rank_no===1))a[r.character_code]=r;return a},{}));
 const courses=[...new Set(chosen.map(r=>r.course_code))];
 const {data:events}=await supabase.from("bs_race_events").select("course_code,race_no,course_name,race_name").eq("race_date",date).in("course_code",courses);
 const eventMap=new Map((events||[]).map(e=>[`${e.course_code}-${e.race_no}`,e]));
 let created=0,skipped=0;const failures=[];
 for(const row of chosen){
  const e=eventMap.get(`${row.course_code}-${row.race_no}`);const course=e?.course_name||courseFallback(row.course_code);
  const pct=Number.isFinite(row.probability)?`${(row.probability*100).toFixed(1)}%`:null;
  const comment=row.social_comment||row.summary||"今日の注目レースです。";
  const body=`${icons[row.character_code]}${names[row.character_code]}の今日の注目\n\n${course}${row.race_no}R${pct?`｜注目度 ${pct}`:""}\n${comment}\n\n#BoatStrikers #ボートレース`;
  const ref={kind:"ai_v2_daily_rankings",id:String(row.id),ranking_date:date,course_code:row.course_code,race_no:row.race_no,probability:row.probability,data_timing:row.data_timing};
  const {data:existing,error:checkError}=await supabase.from("bs_x_post_drafts").select("id").eq("source_kind","ai_v2_daily_rankings").contains("source_refs",[{id:String(row.id)}]).eq("account_code",row.character_code).maybeSingle();
  if(checkError){failures.push(`${names[row.character_code]} 重複確認: ${checkError.message}`);continue}
  if(existing){skipped++;continue}
  const {error:insertError}=await supabase.from("bs_x_post_drafts").insert({account_code:row.character_code,category:"prediction",body,status:"draft",source_kind:"ai_v2_daily_rankings",source_refs:[ref],updated_at:new Date().toISOString()});
  if(insertError)failures.push(`${names[row.character_code]} 保存: ${insertError.message}`);else created++;
 }
 if(failures.length)finish({gen:"error",created:String(created),skipped:String(skipped),message:failures.join(" / ").slice(0,700)});
 finish({gen:"ok",created:String(created),skipped:String(skipped),message:`${created}件作成・${skipped}件重複スキップ`});
}
