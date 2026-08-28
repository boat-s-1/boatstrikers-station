"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "../../sync/_lib/adminAuth";
import { generateAndSaveHatsuneArticle } from "../../../../lib/hatsuneNewsAi";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase管理用環境変数がありません。");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function guard() {
  if (!(await isAdminAuthenticated())) redirect("/admin/sync/login");
}

function clean(value) {
  const text = String(value ?? "").trim();
  return text || null;
}

export async function saveHatsuneNewsArticle(formData) {
  await guard();
  const id = Number(formData.get("id"));
  if (!Number.isFinite(id)) throw new Error("記事IDが不正です。");

  const payload = {
    title: clean(formData.get("title")),
    summary: clean(formData.get("summary")),
    article_body: clean(formData.get("article_body")),
    image_url: clean(formData.get("image_url")),
    source_url: clean(formData.get("source_url")),
    source_name: clean(formData.get("source_name")),
    article_body_source: "manual",
    is_published: formData.get("is_published") === "on",
    updated_at: new Date().toISOString(),
  };

  if (!payload.title) throw new Error("タイトルは必須です。");

  const supabase = getSupabase();
  const { error } = await supabase.from("hatsune_news").update(payload).eq("id", id);
  if (error) throw error;

  revalidatePath("/hatsune/news");
  revalidatePath(`/hatsune/news/${id}`);
  revalidatePath("/admin/hatsune-news/editor");
  revalidatePath(`/admin/hatsune-news/editor/${id}`);
  redirect(`/admin/hatsune-news/editor/${id}?saved=1`);
}

export async function regenerateHatsuneNewsArticle(formData) {
  await guard();
  const id = Number(formData.get("id"));
  if (!Number.isFinite(id)) throw new Error("記事IDが不正です。");

  await generateAndSaveHatsuneArticle(id, { force: true });
  revalidatePath("/hatsune/news");
  revalidatePath(`/hatsune/news/${id}`);
  revalidatePath("/admin/hatsune-news/editor");
  revalidatePath(`/admin/hatsune-news/editor/${id}`);
  redirect(`/admin/hatsune-news/editor/${id}?regenerated=1`);
}
