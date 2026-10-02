import { validateDocument, UUID } from "./document.mjs";

// Dependency injection allows tests without credentials. Server code supplies a BLOG-only client.
export function blogRepository(client) {
  async function rpc(name, args) {
    const { data, error } = await client.rpc(name, args);
    if (error) throw error;
    return data;
  }
  function id(value) { if (!UUID.test(value)) throw Object.assign(new Error("記事IDが無効です。"), { status: 400 }); return value; }
  function version(value) { if (!Number.isSafeInteger(value) || value < 0) throw Object.assign(new Error("編集版の番号が無効です。"), { status: 400 }); return value; }
  return {
    create(slug, document) {
      if (typeof slug !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 150) throw Object.assign(new Error("slugを確認してください。"), { status: 400 });
      return rpc("blog_create_draft", { p_slug: slug, p_document: validateDocument(document) });
    },
    editor(postId) { return rpc("blog_editor_document", { p_post_id: id(postId) }); },
    save(postId, expectedVersion, document) {
      return rpc("blog_save_draft", { p_post_id: id(postId), p_expected_version: version(expectedVersion), p_document: validateDocument(document) });
    },
    release(postId, expectedVersion, publishAt = null) {
      if (publishAt !== null && (typeof publishAt !== "string" || !/(Z|[+-]\d{2}:\d{2})$/.test(publishAt) || !Number.isFinite(Date.parse(publishAt)) || Date.parse(publishAt) <= Date.now())) throw Object.assign(new Error("予約日時は未来の日時をタイムゾーン付きで指定してください。"), { status: 400 });
      return rpc("blog_release", { p_post_id: id(postId), p_expected_version: version(expectedVersion), p_publish_at: publishAt });
    },
    changeState(postId, expectedVersion, action) {
      if (!["cancel_schedule", "unpublish"].includes(action)) throw Object.assign(new Error("操作が無効です。"), { status: 400 });
      return rpc("blog_change_state", { p_post_id: id(postId), p_expected_version: version(expectedVersion), p_action: action });
    },
    publishDue() { return rpc("blog_publish_due", { p_limit: 20 }); },
    async published(slug) {
      const { data: post, error } = await client.from("blog_posts").select("id,slug,published_revision_id,first_published_at,last_published_at")
        .eq("slug", slug).eq("state", "published").lte("first_published_at", new Date().toISOString()).maybeSingle();
      if (error) throw error;
      if (!post) return null;
      const { data: revision, error: revisionError } = await client.from("blog_post_revisions")
        .select("id,title,excerpt,category_id,seo,cover,noindex,blog_blocks(id,position,type,data),blog_post_authors(author_id,position),blog_post_tags(tag_id),blog_post_relations(position,related_post_id,existing_path)")
        .eq("id", post.published_revision_id).maybeSingle();
      if (revisionError) throw revisionError;
      return revision ? { ...post, revision: { ...revision, blog_blocks: [...revision.blog_blocks].sort((a, b) => a.position - b.position) } } : null;
    },
  };
}
