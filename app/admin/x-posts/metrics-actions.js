"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";

function db(){return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}})}
function n(v){const x=Number.parseInt(String(v||"0"),10);return Number.isFinite(x)&&x>=0?x:0}

export async function saveXMetrics(formData){
 const draftId=String(formData.get("draft_id")||"").trim();
 const account=String(formData.get("account_code")||"").trim();
 const category=String(formData.get("category")||"").trim();
 const postDate=String(formData.get("post_date")||"").trim()||null;
 if(!draftId||!account||!category)return;
 const payload={
  draft_id:draftId,
  account_code:account,
  category,
  post_date:postDate,
  impressions:n(formData.get("impressions")),
  likes:n(formData.get("likes")),
  reposts:n(formData.get("reposts")),
  replies:n(formData.get("replies")),
  bookmarks:n(formData.get("bookmarks")),
  profile_visits:n(formData.get("profile_visits")),
  link_clicks:n(formData.get("link_clicks")),
  follows:n(formData.get("follows")),
  notes:String(formData.get("notes")||"").trim()||null,
  recorded_at:new Date().toISOString(),
  updated_at:new Date().toISOString()
 };
 await db().from("bs_x_post_metrics").upsert(payload,{onConflict:"draft_id"});
 revalidatePath("/admin/x-posts");
}
