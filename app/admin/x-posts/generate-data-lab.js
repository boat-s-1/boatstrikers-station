"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";

function db(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL||process.env.SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key) return null;
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}

function jstYesterday(){
  const now=new Date();
  const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(now);
  const obj=Object.fromEntries(parts.map(p=>[p.type,p.value]));
  const d=new Date(`${obj.year}-${obj.month}-${obj.day}T12:00:00+09:00`);
  d.setUTCDate(d.getUTCDate()-1);
  return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit"}).format(d);
}

export async function generateDataLabDraft(){
  const supabase=db();
  if(!supabase) return;
  const date=jstYesterday();
  const {data:item,error}=await supabase.from("bs_data_lab_social_outputs")
    .select("id,race_date,status,x_post_text,hashtags,generated_at")
    .eq("race_date",date).maybeSingle();
  if(error||!item?.x_post_text) return;
  const sourceRef=`data-lab:${item.id}`;
  const {data:exists}=await supabase.from("bs_x_post_drafts").select("id")
    .eq("source_type","bs_data_lab_social_outputs").eq("source_ref",sourceRef).maybeSingle();
  if(!exists){
    const hashtags=Array.isArray(item.hashtags)?item.hashtags.filter(Boolean).join(" "):"";
    const body=[item.x_post_text.trim(),hashtags].filter(Boolean).join("\n\n");
    await supabase.from("bs_x_post_drafts").insert({
      account_code:"official",category:"data_lab",body,status:"review",
      source_type:"bs_data_lab_social_outputs",source_ref:sourceRef,
      source_data:{output_id:item.id,race_date:item.race_date,output_status:item.status,generated_at:item.generated_at},
      updated_at:new Date().toISOString()
    });
  }
  revalidatePath("/admin/x-posts");
}
