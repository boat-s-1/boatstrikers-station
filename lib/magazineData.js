import { createClient } from "@supabase/supabase-js";

function getMagazineSupabase() {
  const url =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    console.error(
      "SUPABASE_URL または SUPABASE_SERVICE_ROLE_KEY が設定されていません。"
    );
    return null;
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function getPublishedMagazineIssues(limit = 50) {
  const supabase = getMagazineSupabase();

  if (!supabase) {
    return [];
  }

  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("magazine_issues")
    .select("*")
    .eq("status", "published")
    .or(`published_at.is.null,published_at.lte.${now}`)
    .order("published_at", {
      ascending: false,
      nullsFirst: false,
    })
    .limit(limit);

  if (error) {
    console.error("magazine list error:", error);
    return [];
  }

  return data || [];
}

export async function getPublishedMagazineIssue(slug) {
  const supabase = getMagazineSupabase();

  if (!supabase) {
    return null;
  }

  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("magazine_issues")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .or(`published_at.is.null,published_at.lte.${now}`)
    .maybeSingle();

  if (error) {
    console.error("magazine issue error:", error);
    return null;
  }

  return data || null;
}
