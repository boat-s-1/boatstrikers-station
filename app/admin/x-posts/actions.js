"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";

const supabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const allowedAccounts = new Set(["official", "ichika", "hatsune", "kiina"]);
const allowedStatuses = new Set(["draft", "review", "ready", "posted"]);

export async function saveDraft(formData) {
  const id = formData.get("id");
  const account = String(formData.get("account") || "");
  const body = String(formData.get("body") || "").trim();
  const category = String(formData.get("category") || "other");
  const status = String(formData.get("status") || "draft");
  const scheduledAt = String(formData.get("scheduled_at") || "").trim();
  if (!allowedAccounts.has(account) || !allowedStatuses.has(status) || !body) return;

  const payload = {
    account_code: account,
    category,
    body,
    status,
    scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
    updated_at: new Date().toISOString(),
  };
  const db = supabase();
  if (id) await db.from("bs_x_post_drafts").update(payload).eq("id", id);
  else await db.from("bs_x_post_drafts").insert(payload);
  revalidatePath("/admin/x-posts");
}

export async function markPosted(formData) {
  const id = formData.get("id");
  if (!id) return;
  await supabase().from("bs_x_post_drafts").update({
    status: "posted",
    posted_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", id);
  revalidatePath("/admin/x-posts");
}
