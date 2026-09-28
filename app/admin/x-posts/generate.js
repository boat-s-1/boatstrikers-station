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
function hasSourceId(refs,id){const wanted=String(id);if(Array.isArray(refs))return refs.some(r=>r&&String(r.id)===wanted);if(refs&&typeof refs==="object")return String(refs.id)===wanted;return false}
function cleanComment(text){
 let s=String(text||"")
  .replace(/AI\s*v?\d+(?:\.\d+)?/gi,"")
  .replace(/shadow|model|raw|score/gi,"")
  .replace(/\b\d+(?:\.\d+)?%\b/g,"")
  .replace(/\s{2,}/g," ").trim();
 if(!s||/^[-–—:：|｜・\s]+$/.test(s))return"";
 return s;
}
function grade(probability){
 if(!Number.isFinite(probability))return null;
 if(probability>=0.75)return"S";
 if(probability>=0.55)return"A";
 if(probability>=0.35)return"B";
 return"C";
}
function metricLabel(code){return code==="ichika"?"イン逃げ注目度":code==="hatsune"?"女子戦注目度":"穴狙い注目度"}
function characterLine(code,slot){
 if(code==="ichika")return slot===1?"今日はここからインを見ます🌱":"もう1本。インの強さをチェックしたいレースです。";
 if(code==="hatsune")return slot===1?"今日の女子戦、まず気になったのはここ🐰":"女子戦からもう1レース。私はここをチェックします🐰";
 return slot===1?"配当妙味も含めて、穴目線で気になるのはここ⭐":"もう1本。人気だけでは決めず、穴目線で見たいレースです⭐";
}
function closingLine(code){
 if(code==="ichika")return"直前気配まで見て、インを信頼できるか最終確認。";
 if(code==="hatsune")return"展示とスタート気配まで見て、直前にもう一度チェック。";
 return"オッズと展示を見ながら、狙える穴か直前まで見極めます。";
}
function buildBody(row,course,slot){
 const g=grade(row.probability);const comment=cleanComment(row.social_comment||row.summary);
 const lines=[`${icons[row.character_code]} ${names[row.character_code]}の今日の注目`,"",`${course}${row.race_no}R`,characterLine(row.character_code,slot)];
 if(g)lines.push(`${metricLabel(row.character_code)}【${g}】`);
 if(comment)lines.push(comment);
 lines.push(closingLine(row.character_code),"","#BoatStrikers #ボートレース");
 return lines.join("\n");
}

export async function generateCharacterDrafts(){
 const supabase=db();const date=todayJst();
 const {data:rankings,error}=await supabase.from("ai_v2_daily_rankings").select("id,character_code,rank_no,course_code,race_no,probability,summary,social_comment,selected_for_social,data_timing").eq("ranking_date",date).in("character_code",["ichika","hatsune","kiina"]).order("rank_no",{ascending:true});
 if(error)finish({gen:"error",message:`ランキング取得: ${error.message}`});
 if(!rankings?.length)finish({gen:"empty",message:`${date} のランキングが0件です`});
 const chosen=[];
 for(const code of ["ichika","hatsune","kiina"]){
  const rows=rankings.filter(r=>r.character_code===code);const selected=rows.filter(r=>r.selected_for_social);
  const pool=[...selected,...rows.filter(r=>!selected.some(s=>String(s.id)===String(r.id)))];
  chosen.push(...pool.slice(0,2).map((r,i)=>({...r,social_slot:i+1})));
 }
 const courses=[...new Set(chosen.map(r=>r.course_code))];
 const {data:events}=await supabase.from("bs_race_events").select("course_code,race_no,course_name,race_name").eq("race_date",date).in("course_code",courses);
 const eventMap=new Map((events||[]).map(e=>[`${e.course_code}-${e.race_no}`,e]));
 let created=0,skipped=0;const failures=[];
 for(const row of chosen){
  const e=eventMap.get(`${row.course_code}-${row.race_no}`);const course=e?.course_name||courseFallback(row.course_code);const body=buildBody(row,course,row.social_slot);
  const ref={kind:"ai_v2_daily_rankings",id:String(row.id),ranking_date:date,course_code:row.course_code,race_no:row.race_no,probability:row.probability,data_timing:row.data_timing,social_slot:row.social_slot,copy_version:"character-v2"};
  const {data:candidates,error:checkError}=await supabase.from("bs_x_post_drafts").select("id,source_refs").eq("source_kind","ai_v2_daily_rankings").eq("account_code",row.character_code).limit(100);
  if(checkError){failures.push(`${names[row.character_code]} 重複確認: ${checkError.message}`);continue}
  const existing=(candidates||[]).find(d=>hasSourceId(d.source_refs,row.id));if(existing){skipped++;continue}
  const {error:insertError}=await supabase.from("bs_x_post_drafts").insert({post_date:date,account_code:row.character_code,category:"prediction",body,status:"draft",source_kind:"ai_v2_daily_rankings",source_refs:[ref],updated_at:new Date().toISOString()});
  if(insertError)failures.push(`${names[row.character_code]} 保存: ${insertError.message}`);else created++;
 }
 if(failures.length)finish({gen:"error",created:String(created),skipped:String(skipped),message:failures.join(" / ").slice(0,700)});
 finish({gen:"ok",created:String(created),skipped:String(skipped),message:`${created}件作成・${skipped}件重複スキップ`});
}
