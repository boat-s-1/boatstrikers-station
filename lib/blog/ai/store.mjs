import { randomUUID } from "node:crypto";

// Data access for the AI drafting tables. The client is a BLOG-only service-role client (injected).
function fail(error) { if (error) throw error; }
const conflict = message => Object.assign(new Error(message), { status: 409 });

export function aiStore(client, { bucket = null } = {}) {
  async function one(query) { const { data, error } = await query; fail(error); return data; }
  return {
    async catalogue(categorySlug) {
      const [categories, authors] = await Promise.all([
        one(client.from("blog_categories").select("id,slug,name").eq("slug", categorySlug).eq("active", true)),
        one(client.from("blog_authors").select("id,slug").eq("active", true)),
      ]);
      return { categoryId: categories[0]?.id ?? null, categoryName: categories[0]?.name ?? "", authorIds: Object.fromEntries(authors.map(a => [a.slug, a.id])) };
    },
    topics() { return one(client.from("blog_topics").select("*").order("created_at", { ascending: false }).limit(300)); },
    async topic(id) {
      const rows = await one(client.from("blog_topics").select("*").eq("id", id).limit(1));
      if (!rows[0]) throw Object.assign(new Error("テーマが見つかりません。"), { status: 404 });
      return rows[0];
    },
    async registerTopic(candidate) {
      const { data, error } = await client.from("blog_topics").insert(candidate).select("*").single();
      if (error?.code === "23505") throw conflict("同じテーマがすでに登録されています。");
      fail(error); return data;
    },
    async postIdBySlug(slug) { const rows = await one(client.from("blog_posts").select("id").eq("slug", slug).limit(1)); return rows[0]?.id ?? null; },
    async setTopic(id, patch) { return one(client.from("blog_topics").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id).select("*").single()); },
    // Titles of every BLOG post (all revisions) for near-duplicate detection.
    async postTitles() {
      const rows = await one(client.from("blog_post_revisions").select("post_id,title").limit(5000));
      const seen = new Map();
      for (const r of rows) if (r.title) seen.set(`${r.post_id}|${r.title}`, { post_id: r.post_id, title: r.title });
      return [...seen.values()];
    },
    sourceUrls(stadiumSlug) { return one(client.from("blog_source_urls").select("*").eq("stadium_slug", stadiumSlug).order("created_at")); },
    async addSourceUrl(row) {
      const { data, error } = await client.from("blog_source_urls").insert(row).select("*").single();
      if (error?.code === "23505") throw conflict("このURLはすでに登録されています。");
      fail(error); return data;
    },
    async ensureSourceUrls(rows) {
      if (!rows.length) return;
      fail((await client.from("blog_source_urls").upsert(rows, { onConflict: "url", ignoreDuplicates: true })).error);
    },
    async insertDocument(record) { return one(client.from("blog_source_documents").insert(record).select("id,url,fetched_at,fetch_error").single()); },
    documents(stadiumSlug, { withText = true, limit = 30 } = {}) {
      const columns = withText ? "*" : "id,source_url_id,stadium_slug,url,kind,fetched_at,http_status,content_sha256,title,fetch_error";
      return one(client.from("blog_source_documents").select(columns).eq("stadium_slug", stadiumSlug).order("fetched_at", { ascending: false }).limit(limit));
    },
    // Posts drafted from one theme (its original and any comparison drafts), by the topic id stored with each draft.
    async topicPostIds(topicId) { return (await one(client.from("blog_ai_drafts").select("post_id").eq("topic_id", topicId))).map(r => r.post_id); },
    async insertAiDraft(row) { return one(client.from("blog_ai_drafts").insert(row).select("post_id").single()); },
    async aiDraft(postId) {
      const { data, error } = await client.from("blog_ai_drafts").select("*").eq("post_id", postId).limit(1);
      // Before the AI migration exists there can be no AI drafts (and no release guard either).
      if (error && ["PGRST205", "42P01"].includes(error.code)) return null;
      fail(error);
      return data[0] ?? null;
    },
    aiDrafts() {
      return one(client.from("blog_ai_drafts").select("post_id,topic_id,model,prompt_version,generated_at,blocking_issues,validated_version,status,rejected_reason,validation,cover_media_id,updated_at,comparison:source_pack->comparison")
        .order("generated_at", { ascending: false }).limit(100));
    },
    // Current version of each post and its latest approval, for the drafts list.
    async approvalStates(postIds) {
      if (!postIds.length) return { posts: [], approvals: [] };
      const [posts, approvals] = await Promise.all([
        one(client.from("blog_posts").select("id,edit_version,editing_revision_id").in("id", postIds)),
        one(client.from("blog_ai_approvals").select("post_id,edit_version,revision_id,created_at").in("post_id", postIds).order("created_at", { ascending: false })),
      ]);
      return { posts, approvals };
    },
    // Same fingerprint the database checks at release time.
    documentMd5(postId) { return one(client.rpc("blog_ai_document_md5", { p_post_id: postId })); },
    async manualSources(postId) {
      const { data, error } = await client.from("blog_ai_manual_sources").select("statement,source_label,source_url,checked_at,registered_by,created_at").eq("post_id", postId).order("created_at");
      if (error && ["PGRST205", "42P01"].includes(error.code)) return [];
      fail(error); return data;
    },
    async insertManualSource(row) { return one(client.from("blog_ai_manual_sources").insert(row).select("id").single()); },
    async postState(postId) {
      const rows = await one(client.from("blog_posts").select("id,slug,state,editing_revision_id,scheduled_revision_id,published_revision_id").eq("id", postId).limit(1));
      if (!rows[0]) throw Object.assign(new Error("記事が見つかりません。"), { status: 404 });
      return rows[0];
    },
    async authors() { return one(client.from("blog_authors").select("id,slug,character_key")); },
    async categoryName(id) { const rows = id ? await one(client.from("blog_categories").select("name").eq("id", id).limit(1)) : []; return rows[0]?.name ?? ""; },
    async setDraftCover(postId, mediaId) { await one(client.from("blog_ai_drafts").update({ cover_media_id: mediaId, updated_at: new Date().toISOString() }).eq("post_id", postId).select("post_id")); },
    async insertDerivatives(rows) { return one(client.from("blog_post_derivatives").insert(rows).select("id,channel,created_at")); },
    derivatives(postId) { return one(client.from("blog_post_derivatives").select("*").eq("post_id", postId).eq("status", "draft").order("created_at", { ascending: false }).limit(40)); },
    async discardDerivative(postId, id) { await one(client.from("blog_post_derivatives").update({ status: "discarded" }).eq("post_id", postId).eq("id", id).select("id")); },
    async queuedTopics() { return one(client.from("blog_topics").select("*").eq("status", "candidate").order("created_at").limit(50)); },
    async insertRun(row) { return one(client.from("blog_ai_runs").insert(row).select("id").single()); },
    async finishRun(id, patch) { await one(client.from("blog_ai_runs").update({ ...patch, finished_at: new Date().toISOString() }).eq("id", id).select("id")); },
    recentRuns(sinceIso) { return one(client.from("blog_ai_runs").select("id,trigger,started_at,finished_at,status,topic_id,post_id,message").gte("started_at", sinceIso).order("started_at", { ascending: false }).limit(100)); },
    async latestApproval(postId) {
      const rows = await one(client.from("blog_ai_approvals").select("id,revision_id,edit_version,document_md5,approver_name,approver_login_at,created_at").eq("post_id", postId).order("created_at", { ascending: false }).limit(1));
      return rows[0] ?? null;
    },
    async recordValidation(postId, issues, version) {
      await one(client.from("blog_ai_drafts").update({ validation: issues, blocking_issues: issues.filter(i => i.level === "blocking").length,
        validated_version: version, updated_at: new Date().toISOString() }).eq("post_id", postId).select("post_id"));
    },
    approve(postId, version, name, session) {
      return one(client.rpc("blog_ai_approve", { p_post_id: postId, p_expected_version: version, p_approver_name: name,
        p_approver_session: session.hash, p_approver_login_at: session.loginAt }));
    },
    async reject(postId, reason) {
      await one(client.from("blog_ai_drafts").update({ status: "rejected", rejected_reason: reason, updated_at: new Date().toISOString() }).eq("post_id", postId).select("post_id"));
    },
    // Template cover → private BLOG bucket + blog_media (stays private until the post is released).
    async uploadCover(bytes, { alt, source }) {
      if (!bucket) return null;
      const { data: container, error: bucketError } = await client.storage.getBucket(bucket);
      if (bucketError || !container || container.public) throw Object.assign(new Error("BLOG画像用の非公開バケットを確認してください。"), { status: 503 });
      const path = `drafts/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.png`;
      fail((await client.storage.from(bucket).upload(path, bytes, { contentType: "image/png", upsert: false, cacheControl: "3600" })).error);
      try {
        return await one(client.from("blog_media").insert({ storage_path: path, status: "private", public_path: null, alt, source, width: 1200, height: 630 }).select("id").single());
      } catch (error) { await client.storage.from(bucket).remove([path]); throw error; }
    },
  };
}
