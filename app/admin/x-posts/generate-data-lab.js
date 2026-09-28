"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
function db(){const url=process.env.NEXT_PUBLIC_SUPABASE_URL||process.env.SUPABASE_URL;const key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)return null;return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})}
function jstYesterday(){const now=new Date();const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(now);const o=Object.fromEntries(parts.map(p=>[p.type,p.value]));const d=new Date(`${o.year}-${o.month}-${o.day}T12:00:00+09:00`);d.setUTCDate(d.getUTCDate()-1);return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit"}).format(d)}
export async function generateDataLabDraft(){
 const supabase=db();if(!supabase)return;const date=jstYesterday();
 const {data:item,error}=await supabase.from("bs_data_lab_social_outputs").select("id,race_date,status,x_post_text,hashtags,generated_at").eq("race_date",date).maybeSingle();
 if(error||!item?.x_post_text)return;
 const {data:exists}=await supabase.from("bs_x_post_drafts").select("id").eq("source_kind","bs_data_lab_social_outputs").contains("source_refs",[{id:String(item.id)}]).maybeSingle();
 if(!exists){const hashtags=Array.isArray(item.hashtags)?item.hashtags.filter(Boolean).join(" "):"";const body=[item.x_post_text.trim(),hashtags].filter(Boolean).join("\n\n");const ref={kind:"bs_data_lab_social_outputs",id:String(item.id),race_date:item.race_date,output_status:item.status,generated_at:item.generated_at};await supabase.from("bs_x_post_drafts").insert({account_code:"official",category:"data_lab",body,status:"review",source_kind:"bs_data_lab_social_outputs",source_refs:[ref],updated_at:new Date().toISOString()})}
 revalidatePath("/admin/x-posts");
}
