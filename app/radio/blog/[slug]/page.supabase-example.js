import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import RadioBlogBlocks from "../../RadioBlogBlocks";

export const dynamic = "force-dynamic";

function getPublicSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}

export default async function RadioBlogPostPage({ params }) {
  const { slug } = await params;
  const supabase = getPublicSupabase();

  const { data: post, error } = await supabase
    .from("radio_blog_posts")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .lte("published_at", new Date().toISOString())
    .maybeSingle();

  if (error || !post) notFound();

  return (
    <main className="radioBlogArticle">
      <p>{post.episode_number}</p>
      <h1>{post.title}</h1>
      <p>{post.host}</p>

      {post.cover_image_url && (
        <img src={post.cover_image_url} alt={post.title} />
      )}

      {post.summary && <p>{post.summary}</p>}

      <RadioBlogBlocks blocks={post.content_blocks} />
    </main>
  );
}
