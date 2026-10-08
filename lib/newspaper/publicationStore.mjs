// bs_newspaper_publications への保存の共通処理。
// - 公開済み新聞は、明示的な更新操作（confirmPublishedUpdate + expectedUpdatedAt）がない限り変更しない。
// - 自動下書き用の insertNewspaperDraftIfAbsent は既存行を一切更新しない。
import { newspaperSlug } from "./channels.mjs";

export const NEWSPAPER_TABLE = "bs_newspaper_publications";
export const NEWSPAPER_CONFLICT_KEY = "race_date,course_name,race_no,character_key,edition";
export const NEWSPAPER_REQUIRED_FIELDS = ["date", "course", "raceNo", "character", "edition", "title"];
const STATUSES = ["draft", "published", "archived"];

function reply(body, status = 200) {
  return { status, body };
}

export function missingRequiredField(body) {
  return NEWSPAPER_REQUIRED_FIELDS.some((key) => !body?.[key]);
}

export function normalizeStatus(value) {
  return STATUSES.includes(value) ? value : "draft";
}

// 旧 POST /api/admin/newspapers と同じ列構成。published_at は保存方法ごとに決める。
export function buildPublicationPayload(body, { now }) {
  const status = normalizeStatus(body.status);
  return {
    slug: newspaperSlug(body), race_date: body.date, course_name: body.course, race_no: Number(body.raceNo),
    character_key: body.character, edition: body.edition, title: body.title,
    summary: body.summary || null, article_body: body.articleBody || null, image_url: body.imageUrl || null,
    note_title: body.noteTitle || null, note_body: body.noteBody || null, note_url: body.noteUrl || null,
    x_post: body.xPost || null, shorts_script: body.shortsScript || null,
    source_payload: body.sourcePayload || {}, status,
    published_at: status === "published" ? (body.publishedAt || now) : null,
    updated_at: now,
  };
}

function keyFilter(query, payload) {
  return query
    .eq("race_date", payload.race_date)
    .eq("course_name", payload.course_name)
    .eq("race_no", payload.race_no)
    .eq("character_key", payload.character_key)
    .eq("edition", payload.edition);
}

function currentSummary(row) {
  return { id: row.id, status: row.status, title: row.title, updated_at: row.updated_at, published_at: row.published_at };
}

// 管理画面の手動保存。
export async function saveNewspaperPublication(db, body, { now = new Date().toISOString() } = {}) {
  if (missingRequiredField(body)) return reply({ error: "新聞の必須情報が不足しています" }, 400);
  const payload = buildPublicationPayload(body, { now });

  const { data: existing, error: findError } = await keyFilter(
    db.from(NEWSPAPER_TABLE).select("id,status,title,updated_at,published_at"), payload,
  ).maybeSingle();
  if (findError) return reply({ error: findError.message }, 500);

  if (!existing) {
    const { data, error } = await db.from(NEWSPAPER_TABLE).insert(payload).select("*").single();
    if (error?.code === "23505") {
      return reply({ error: "同じレースの新聞が別の操作で保存されました。画面を再読み込みしてから保存し直してください。", code: "conflict_retry" }, 409);
    }
    if (error) return reply({ error: error.message }, 500);
    return reply({ item: data });
  }

  if (existing.status === "published") {
    if (body.confirmPublishedUpdate !== true) {
      return reply({
        error: "この新聞は公開中です。公開中の内容を変更するには、確認のうえ明示的に更新してください。",
        code: "published_exists",
        current: currentSummary(existing),
      }, 409);
    }
    if (!body.expectedUpdatedAt || body.expectedUpdatedAt !== existing.updated_at) {
      return reply({
        error: "公開中の新聞が別の操作で更新されています。内容を確認してからやり直してください。",
        code: "published_stale",
        current: currentSummary(existing),
      }, 409);
    }
    // 公開のまま更新する場合は、最初の公開日時を保つ。
    const published = payload.status === "published";
    const update = {
      ...payload,
      published_at: published ? (body.publishedAt || existing.published_at || now) : null,
    };
    const { data, error } = await db.from(NEWSPAPER_TABLE).update(update)
      .eq("id", existing.id).eq("status", "published").eq("updated_at", existing.updated_at)
      .select("*").maybeSingle();
    if (error) return reply({ error: error.message }, 500);
    if (!data) {
      return reply({ error: "公開中の新聞が別の操作で更新されています。内容を確認してからやり直してください。", code: "published_stale" }, 409);
    }
    return reply({ item: data });
  }

  // 下書き・アーカイブは従来どおり上書き保存。ただし保存直前に公開された行は変更しない。
  const { data, error } = await db.from(NEWSPAPER_TABLE).update(payload)
    .eq("id", existing.id).neq("status", "published")
    .select("*").maybeSingle();
  if (error) return reply({ error: error.message }, 500);
  if (!data) {
    return reply({ error: "この新聞は保存直前に公開されました。画面を再読み込みしてから保存し直してください。", code: "published_exists" }, 409);
  }
  return reply({ item: data });
}

// 自動下書き用（PHASE 2 で使用）。同じレース・キャラ・版の行があれば何もしない。
export async function insertNewspaperDraftIfAbsent(db, body, { now = new Date().toISOString() } = {}) {
  if (missingRequiredField(body)) return { inserted: false, reason: "missing_required_field" };
  const payload = { ...buildPublicationPayload({ ...body, status: "draft" }, { now }), status: "draft", published_at: null };
  const { data, error } = await db.from(NEWSPAPER_TABLE)
    .upsert(payload, { onConflict: NEWSPAPER_CONFLICT_KEY, ignoreDuplicates: true })
    .select("*");
  if (error) throw error;
  const item = Array.isArray(data) ? data[0] : data;
  return item ? { inserted: true, item } : { inserted: false, reason: "exists" };
}
