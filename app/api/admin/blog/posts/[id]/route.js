import { blogAdminRepository, blogBody, blogResponse, requireBlogAdmin } from "../../../../../../lib/blog/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request, { params }) {
  return blogResponse(async () => {
    await requireBlogAdmin(request);
    return blogAdminRepository().editor((await params).id);
  });
}
export async function PUT(request, { params }) {
  return blogResponse(async () => {
    await requireBlogAdmin(request, { write: true });
    const body = await blogBody(request);
    return blogAdminRepository().save((await params).id, body.version, body.document);
  });
}
