"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
function db(){return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}})}
export async function generateResultDrafts(){
 const supabase=db();
 const {data:predictions,error}=await supabase.from("bsc_official_predictions").select("id,race_date,course_code,race_no,character_code,picks").eq("is_published",true).order("race_date",{ascending:false}).limit(80);
 if(error||!predictions?.length)return;
 for(const p of predictions){
  const {data:event}=await supabase.from("bs_race_events").select("course_name,result_3t,payout_3t,status").eq("race_date",p.race_date).eq("course_code",p.course_code).eq("race_no",p.race_no).maybeSingle();
  if(!event?.result_3t)continue;
  const picks=Array.isArray(p.picks)?p.picks:[]; const result=String(event.result_3t).replace(/\s/g,"");
  const hit=picks.some(x=>String(typeof x==="string"?x:(x?.combination||x?.pick||"")).replace(/\s/g,"")===result);
  const label={ichika:"一果",hatsune:"初音",kiina:"キイナ"}[p.character_code]||p.character_code; const icon={ichika:"🌱",hatsune:"🐰",kiina:"⭐"}[p.character_code]||"🚤";
  const body=`${icon}${label}の答え合わせ\n\n${event.course_name||`場コード${p.course_code}`}${p.race_no}R\n結果：${event.result_3t}${event.payout_3t?`\n3連単 ${Number(event.payout_3t).toLocaleString("ja-JP")}円`:""}\n\n予想結果：${hit?"🎯 的中":"不的中"}\n\n的中・不的中どちらも記録します。\n#BoatStrikers #ボートレース`;
  const ref={kind:"bsc_official_predictions_result",id:String(p.id),race_date:p.race_date,course_code:p.course_code,race_no:p.race_no,result_3t:event.result_3t,payout_3t:event.payout_3t,hit};
  const {data:exists}=await supabase.from("bs_x_post_drafts").select("id").eq("source_kind","bsc_official_predictions_result").contains("source_refs",[{id:String(p.id)}]).maybeSingle();
  if(!exists)await supabase.from("bs_x_post_drafts").insert({account_code:p.character_code,category:"result",body,status:"review",source_kind:"bsc_official_predictions_result",source_refs:[ref],updated_at:new Date().toISOString()});
 }
 revalidatePath("/admin/x-posts");
}
