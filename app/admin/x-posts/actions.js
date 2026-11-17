"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";

const supabase = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const allowedAccounts=new Set(["official","ichika","hatsune","kiina"]);
const allowedStatuses=new Set(["draft","review","ready","posted"]);
function todayJst(){return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date())}
function grade(p){if(!Number.isFinite(p))return null;if(p>=.75)return"S";if(p>=.55)return"A";if(p>=.35)return"B";return"C"}
function rebuildPrediction(post){
 const ref=Array.isArray(post.source_refs)?post.source_refs[0]:post.source_refs;if(!ref)return null;
 const code=post.account_code, name=code==="ichika"?"一果":code==="hatsune"?"初音":"キイナ", icon=code==="ichika"?"🌱":code==="hatsune"?"🐰":"⭐";
 const label=code==="ichika"?"イン逃げ注目度":code==="hatsune"?"女子戦注目度":"穴狙い注目度";
 const line=code==="ichika"?"インの強さをチェックしたいレースです。":code==="hatsune"?"女子戦から気になる一戦をチェック🐰":"人気だけで決めず、穴目線で見たい一戦です⭐";
 const close=code==="ichika"?"直前気配まで見て、インを信頼できるか最終確認。":code==="hatsune"?"展示とスタート気配まで見て、直前にもう一度チェック。":"オッズと展示を見ながら、狙える穴か直前まで見極めます。";
 const course=ref.course_name||`場コード${String(ref.course_code||"").padStart(2,"0")}`, g=grade(Number(ref.probability));
 return [`${icon} ${name}の今日の注目`,"",`${course}${ref.race_no}R`,line,g?`${label}【${g}】`:null,close,"","#BoatStrikers #ボートレース"].filter(v=>v!==null).join("\n");
}
export async function saveDraft(formData){
 const id=formData.get("id"),account=String(formData.get("account")||""),body=String(formData.get("body")||"").trim(),category=String(formData.get("category")||"other"),status=String(formData.get("status")||"draft"),scheduledAt=String(formData.get("scheduled_at")||"").trim();
 if(!allowedAccounts.has(account)||!allowedStatuses.has(status)||!body)return;
 const payload={post_date:todayJst(),account_code:account,category,body,status,scheduled_at:scheduledAt?new Date(scheduledAt).toISOString():null,updated_at:new Date().toISOString()};const db=supabase();
 if(id)await db.from("bs_x_post_drafts").update(payload).eq("id",id);else await db.from("bs_x_post_drafts").insert(payload);revalidatePath("/admin/x-posts");
}
export async function markPosted(formData){const id=formData.get("id");if(!id)return;await supabase().from("bs_x_post_drafts").update({status:"posted",posted_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",id);revalidatePath("/admin/x-posts")}
export async function regenerateCharacterDrafts(){
 const db=supabase(),date=todayJst();const {data}=await db.from("bs_x_post_drafts").select("id,account_code,status,source_kind,source_refs").eq("post_date",date).eq("source_kind","ai_v2_daily_rankings").in("account_code",["ichika","hatsune","kiina"]);
 for(const post of data||[]){if(post.status==="posted")continue;const body=rebuildPrediction(post);if(body)await db.from("bs_x_post_drafts").update({body,updated_at:new Date().toISOString()}).eq("id",post.id)}revalidatePath("/admin/x-posts");
}
