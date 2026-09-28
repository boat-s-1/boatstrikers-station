"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
function db(){return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}})}
function today(){return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date())}
function isoJst(date,time){return new Date(`${date}T${time}:00+09:00`).toISOString()}
const plan=[
 {key:"official-morning",account:"official",category:"news",time:"08:15",body:"🚤 おはようございます、BoatStrikersです。\n\n今日も開催情報・注目レース・DATA LABを追っていきます。\n気になるレースは3人それぞれの目線でも紹介します。\n\n#BoatStrikers #ボートレース"},
 {key:"ichika-talk",account:"ichika",category:"news",time:"10:15",body:"🌱 一果です。\n\nイン逃げを見るときは、1号艇だからという理由だけで決めず、スタート・相手関係・直前気配まで確認したいところ。\n今日も『逃げを信頼できるレースか』を見ていきます。\n\n#BoatStrikers #ボートレース"},
 {key:"hatsune-talk",account:"hatsune",category:"news",time:"12:15",body:"🐰 初音です。\n\n女子戦は選手ごとの近況やスタート気配も見ながら追うと、レースを見る楽しみが増えます。\n今日も女子戦から気になるポイントを探します🐰\n\n#BoatStrikers #女子戦 #ボートレース"},
 {key:"kiina-talk",account:"kiina",category:"news",time:"14:15",body:"⭐ キイナです。\n\n穴狙いは高配当だけを追うのではなく、『人気との差がありそうな材料があるか』を大事にしています。\n今日も5アタマや穴候補を探していきます⭐\n\n#BoatStrikers #ボートレース"},
 {key:"official-evening",account:"official",category:"news",time:"20:30",body:"📊 今日のボートレースを振り返ります。\n\n結果や荒れたレースはDATA LABでも整理して公開していきます。\n一果・初音・キイナ、それぞれの視点とあわせてチェックしてください。\n\n#BoatStrikers #ボートレース"}
];
export async function generateDailyPlan(){
 const supabase=db(),date=today();let created=0,skipped=0;const errors=[];
 for(const p of plan){
  const ref={kind:"x_daily_plan",id:`${date}:${p.key}`,post_date:date,slot:p.key,content_type:p.key.endsWith("-talk")?"chat":"official"};
  const {data:rows,error:findError}=await supabase.from("bs_x_post_drafts").select("id,source_refs").eq("source_kind","x_daily_plan").eq("account_code",p.account).limit(50);
  if(findError){errors.push(findError.message);continue}
  const exists=(rows||[]).some(r=>Array.isArray(r.source_refs)&&r.source_refs.some(x=>x?.id===ref.id));if(exists){skipped++;continue}
  const {error}=await supabase.from("bs_x_post_drafts").insert({post_date:date,account_code:p.account,category:p.category,body:p.body,status:"draft",scheduled_at:isoJst(date,p.time),source_kind:"x_daily_plan",source_refs:[ref],updated_at:new Date().toISOString()});
  if(error)errors.push(`${p.account}: ${error.message}`);else created++;
 }
 revalidatePath("/admin/x-posts");const message=errors.length?`${created}件作成 / ${errors.join(" / ").slice(0,500)}`:`1日分 ${created}件作成・${skipped}件重複スキップ`;
 redirect(`/admin/x-posts?gen=${errors.length?"error":"ok"}&created=${created}&skipped=${skipped}&message=${encodeURIComponent(message)}`);
}
