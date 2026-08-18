import { getRadioAdminSupabase } from "./supabaseRadioAdmin";

export const SEMINAR_BUCKET = "seminar-magazine-pages";

function cleanPages(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((x) => ({ page: Number(x?.page), path: String(x?.path || "") }))
    .filter((x) => Number.isInteger(x.page) && x.page > 0 && x.path)
    .sort((a, b) => a.page - b.page);
}

async function signedUrl(supabase, path, expiresIn = 60 * 60) {
  if (!path) return "";
  const { data, error } = await supabase.storage.from(SEMINAR_BUCKET).createSignedUrl(path, expiresIn);
  if (error) return "";
  return data?.signedUrl || "";
}

export async function hydrateSeminarIssue(row, { includePremium = false } = {}) {
  const supabase = getRadioAdminSupabase();
  const pages = cleanPages(row.page_paths);
  const start = Math.max(1, Number(row.premium_start_page || pages.length + 1));
  const visiblePages = includePremium ? pages : pages.filter((p) => p.page < start);
  const urls = await Promise.all(visiblePages.map(async (p) => ({ ...p, url: await signedUrl(supabase, p.path) })));
  const coverPath = pages.find((p) => p.page === 1)?.path || pages[0]?.path || "";
  const cover = await signedUrl(supabase, coverPath);

  return {
    dbId: row.id,
    id: row.issue_no,
    number: row.number_label || `第${row.issue_no}号`,
    title: row.title,
    summary: row.summary || "",
    date: row.published_at || row.created_at,
    cover,
    freePages: urls.map((x) => x.url).filter(Boolean),
    premiumStartPage: start,
    premiumPageCount: Math.max(0, pages.filter((p) => p.page >= start).length),
    pageCount: pages.length,
    source: "supabase",
  };
}

export async function listPublishedSeminarIssues(series) {
  const supabase = getRadioAdminSupabase();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("seminar_magazine_issues")
    .select("*")
    .eq("series", series)
    .eq("status", "published")
    .or(`published_at.is.null,published_at.lte.${now}`)
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[seminar magazines list]", error);
    return [];
  }
  return Promise.all((data || []).map((row) => hydrateSeminarIssue(row)));
}

export async function getPublishedSeminarIssue(series, issueNo) {
  const supabase = getRadioAdminSupabase();
  const { data, error } = await supabase
    .from("seminar_magazine_issues")
    .select("*")
    .eq("series", series)
    .eq("issue_no", issueNo)
    .eq("status", "published")
    .maybeSingle();
  if (error || !data) return null;
  if (data.published_at && new Date(data.published_at).getTime() > Date.now()) return null;
  return hydrateSeminarIssue(data);
}

export function normalizeAdminIssue(body) {
  const series = ["ichika", "hatsune", "kiina"].includes(body.series) ? body.series : "ichika";
  const issueNo = String(body.issue_no || "").trim();
  const status = body.status === "published" ? "published" : "draft";
  return {
    series,
    issue_no: issueNo,
    number_label: String(body.number_label || "").trim(),
    title: String(body.title || "").trim(),
    summary: String(body.summary || "").trim(),
    page_paths: cleanPages(body.page_paths),
    premium_start_page: Math.max(1, Number(body.premium_start_page || 5)),
    status,
    published_at: status === "published" ? (body.published_at || new Date().toISOString()) : (body.published_at || null),
    updated_at: new Date().toISOString(),
  };
}
