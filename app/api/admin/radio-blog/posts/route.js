import { NextResponse } from "next/server";
import { requireRadioBlogAdmin } from "../../../../../lib/radioBlogAdminAuth";
import { getRadioAdminSupabase } from "../../../../../lib/supabaseRadioAdmin";

function normalizePost(body) {
  const status = body.status === "published" ? "published" : "draft";
  const publishedAt =
    status === "published"
      ? body.published_at || new Date().toISOString()
      : body.published_at || null;

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
    published_at: publishedAt,
  };
}

function validatePost(post) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(post.slug)) {
    return "slugは半角英数字とハイフンで入力してください。";
  }
  if (!post.title) return "タイトルを入力してください。";
  if (!["一果", "初音", "キイナ"].includes(post.host)) {
    return "担当者を選択してください。";
  }
  return null;
}

export async function GET() {
  try {
    await requireRadioBlogAdmin();
    const supabase = getRadioAdminSupabase();

    const { data, error } = await supabase
      .from("radio_blog_posts")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ posts: data || [] });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "取得に失敗しました。" },
      { status: error.status || 500 }
    );
  }
}

export async function POST(request) {
  try {
    await requireRadioBlogAdmin();
    const post = normalizePost(await request.json());
    const validationError = validatePost(post);

    if (validationError) {
      return NextResponse.json(
        { error: validationError },
        { status: 400 }
      );
    }

    const supabase = getRadioAdminSupabase();
    const { data, error } = await supabase
      .from("radio_blog_posts")
      .insert(post)
      .select("*")
      .single();

    if (error) throw error;
    return NextResponse.json({ post: data }, { status: 201 });
  } catch (error) {
    const duplicate = error?.code === "23505";
    return NextResponse.json(
      {
        error: duplicate
          ? "同じslugの記事がすでにあります。"
          : error.message || "保存に失敗しました。",
      },
      { status: error.status || 500 }
    );
  }
}
