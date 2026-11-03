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
      return one(client.from("blog_ai_drafts").select("post_id,topic_id,model,prompt_version,generated_at,blocking_issues,validated_version,status,rejected_reason,validation,cover_media_id,updated_at,comparison:source_pack->comparison,refresh_status:source_pack->refresh->>status")
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
    // PHASE 1: datasets of past AI drafts (for the same-research duplicate check).
    async datasetHistory() {
      const rows = await one(client.from("blog_ai_drafts").select("post_id,generated_at,datasets:source_pack->datasets").order("generated_at", { ascending: false }).limit(500));
      return rows.flatMap(r => (Array.isArray(r.datasets) ? r.datasets : []).map(d => ({ post_id: r.post_id, title: null, created_at: r.generated_at,
        dataset: { definition: d.definition, params: d.params || {}, period: d.period } })));
    },
    // PHASE 1: automatic publication settings (one row; manual mode and auto-publish off by default).
    async aiSettings() {
      const rows = await one(client.from("blog_ai_settings").select("approval_mode,auto_publish_enabled,generation_enabled,updated_at,updated_by").limit(1));
      return rows[0] ?? { approval_mode: "manual", auto_publish_enabled: false, generation_enabled: false };
    },
    // Read-only operational monitoring. HOLD is an in-app alert; no external delivery.
    recentJobs(limit = 50) {
      return one(client.from("blog_ai_jobs").select("date,character,state,post_id,topic_id,last_error,updated_at,attempt")
        .order("date", { ascending: false }).limit(limit));
    },
    // Emergency stop is one-way: this method cannot enable generation or publication.
    async emergencyStop() {
      const { data, error } = await client.from("blog_ai_settings")
        .update({ generation_enabled: false, auto_publish_enabled: false, approval_mode: "manual", updated_at: new Date().toISOString() })
        .eq("id", true)
        .select("approval_mode,generation_enabled,auto_publish_enabled,updated_at").single();
      fail(error);
      if (!data || data.generation_enabled || data.auto_publish_enabled || data.approval_mode !== "manual") {
        throw Object.assign(new Error("緊急停止の状態を確認できません。"), { status: 503 });
      }
      return data;
    },
    // PHASE 1: the gate result is bound to the current version and content by the database, not by the caller.
    recordGateResult(postId, version, result) {
      return one(client.rpc("blog_ai_record_gate_result", { p_post_id: postId, p_expected_version: version, p_attempt: result.attempt,
        p_verdict: result.verdict, p_gates: result.gates, p_gate_version: result.gate_version, p_dataset_hashes: result.dataset_hashes }));
    },
    systemApprove(postId, version, gateResultId) {
      return one(client.rpc("blog_ai_system_approve", { p_post_id: postId, p_expected_version: version, p_gate_result_id: gateResultId }));
    },
    // PHASE 1 automatic publication: each post's latest gate result (any verdict), with the post's current state.
    async autoPublishCandidates() {
      const gates = await one(client.from("blog_ai_gate_results").select("id,post_id,verdict,edit_version,created_at").order("created_at", { ascending: false }).limit(200));
      const latest = new Map();
      for (const g of gates) if (!latest.has(g.post_id)) latest.set(g.post_id, g);
      if (!latest.size) return [];
      const posts = await one(client.from("blog_posts").select("id,state,edit_version,editing_revision_id").in("id", [...latest.keys()]));
      return posts.filter(p => p.editing_revision_id).map(p => ({ post_id: p.id, state: p.state, edit_version: p.edit_version, gate: latest.get(p.id) }))
        .sort((a, b) => String(a.gate.created_at).localeCompare(String(b.gate.created_at)));
    },
    // Automatic publication in one database transaction (blog_ai_auto_publish): one per JST day, all gates PASS.
    autoPublish(postId, version, gateResultId) {
      return one(client.rpc("blog_ai_auto_publish", { p_post_id: postId, p_expected_version: version, p_gate_result_id: gateResultId }));
    },
    // Daily jobs (PHASE 2): claim with a lease, then move along the allowed transitions.
    claimJob(date, character, owner, leaseSeconds = 900) {
      return one(client.rpc("blog_ai_job_claim", { p_date: date, p_character: character, p_owner: owner, p_lease_seconds: leaseSeconds }));
    },
    moveJob(date, owner, to, patch = {}) {
      return one(client.rpc("blog_ai_job_transition", { p_date: date, p_owner: owner, p_to: to, p_patch: patch }));
    },
    releaseJob(date, owner) { return one(client.rpc("blog_ai_job_release", { p_date: date, p_owner: owner })); },
    // Text of other AI drafts and BLOG articles for the duplicate checks: the latest revision of each post.
    async articleTexts(limit = 200) {
      const posts = await one(client.from("blog_posts").select("id,published_revision_id,editing_revision_id,scheduled_revision_id").order("updated_at", { ascending: false }).limit(limit));
      const revisionOf = new Map(posts.map(p => [p.editing_revision_id || p.scheduled_revision_id || p.published_revision_id, p.id]).filter(([r]) => r));
      if (!revisionOf.size) return [];
      const ids = [...revisionOf.keys()];
      const [revisions, blocks] = await Promise.all([
        one(client.from("blog_post_revisions").select("id,title,excerpt").in("id", ids)),
        one(client.from("blog_blocks").select("revision_id,type,data,position").in("revision_id", ids).order("position")),
      ]);
      return revisions.map(r => ({ post_id: revisionOf.get(r.id), title: r.title, document: { title: r.title, excerpt: r.excerpt,
        blocks: blocks.filter(b => b.revision_id === r.id).map(b => ({ type: b.type, data: b.data })) } }));
    },
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
