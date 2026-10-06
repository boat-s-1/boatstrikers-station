import { createClient } from "@supabase/supabase-js";
import { isAdminAuthenticated } from "../../app/admin/sync/_lib/adminAuth";
import { blogRepository } from "./repository.mjs";
import { createBlogGuard } from "./access.mjs";

function httpError(status, message) { return Object.assign(new Error(message), { status }); }
export { blogBody, blogResponse } from "./http.mjs";
export const requireBlogAdmin = createBlogGuard({ authenticate: isAdminAuthenticated, configuration: () => ({
  enabled: process.env.BLOG_ADMIN_ENABLED === "true", writesEnabled: process.env.BLOG_DB_WRITES_ENABLED === "true",
}) });

export function blogAdminRepository() {
  // Explicit BLOG environment variables only. No fallback to the production race DB.
  const url = process.env.BLOG_SUPABASE_URL;
  const key = process.env.BLOG_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw httpError(503, "BLOG検証環境が未設定です。");
  return blogRepository(createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }));
}

export function blogPublicRepository() {
  const url = process.env.BLOG_SUPABASE_URL;
  const key = process.env.BLOG_SUPABASE_ANON_KEY;
  if (!url || !key) throw httpError(503, "BLOG公開環境が未設定です。");
  return blogRepository(createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }));
}
