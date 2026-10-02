import { blogAdminRepository, blogBody, blogResponse, requireBlogAdmin } from "../../../../../lib/blog/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request) {
  return blogResponse(async () => {
    await requireBlogAdmin(request, { write: true });
    const body = await blogBody(request);
    return blogAdminRepository().create(body.slug, body.document);
  });
}
