import { blogAdminRepository, blogResponse, requireBlogAdmin } from "../../../../../lib/blog/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Manual verification only in PHASE 1; no existing cron is modified or enabled.
export async function POST(request) {
  return blogResponse(async () => {
    await requireBlogAdmin(request, { write: true });
    return { published: await blogAdminRepository().publishDue() };
  });
}
