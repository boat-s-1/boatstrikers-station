import { NextResponse } from "next/server";
import { requireRadioBlogAdmin } from "../../../../../../lib/radioBlogAdminAuth";
import { getRadioAdminSupabase } from "../../../../../../lib/supabaseRadioAdmin";

function normalizePost(body) {
  const status = body.status === "published" ? "published" : "draft";
  return {
    slug: String(body.slug || "").trim(),
    episode_number: String(body.episode_number || "").trim(),
    title: String(body.title || "").trim(),
    host: String(body.host || "").trim(),
    summary: String(body.summary || "").trim(),
    cover_image_url: body.cover_image_url || null,
    content_blocks: Array.isArray(body.content_blocks)
      ? body.content_blocks
      : [],
    status,
    published_at:
      status === "published"
        ? body.published_at || new Date().toISOString()
        : body.published_at || null,
  };
}

export async function PUT(request, { params }) {
  try {
    await requireRadioBlogAdmin();
    const { id } = await params;
    const post = normalizePost(await request.json());

    if (!post.title) {
      return NextResponse.json(
        { error: "タイトルを入力してください。" },
        { status: 400 }
      );
    }

    const supabase = getRadioAdminSupabase();
    const { data, error } = await supabase
      .from("radio_blog_posts")
      .update(post)
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw error;
    return NextResponse.json({ post: data });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "更新に失敗しました。" },
      { status: error.status || 500 }
    );
  }
}

export async function DELETE(_request, { params }) {
  try {
    await requireRadioBlogAdmin();
    const { id } = await params;
    const supabase = getRadioAdminSupabase();

    const { error } = await supabase
      .from("radio_blog_posts")
      .delete()
      .eq("id", id);

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "削除に失敗しました。" },
      { status: error.status || 500 }
    );
  }
}
