// 新聞保存API（POST /api/admin/newspapers）の安全対策と、変更前との互換性を確認する。
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { ROOT, FakeNextResponse, loadRouteModule, postRequest, getRequest, createFakeSupabase, NEWSPAPER_UNIQUE_KEYS } from "./helpers.mjs";
import { insertNewspaperDraftIfAbsent, saveNewspaperPublication, NEWSPAPER_CONFLICT_KEY } from "../../lib/newspaper/publicationStore.mjs";
import * as channels from "../../lib/newspaper/channels.mjs";

const TABLE = "bs_newspaper_publications";

const PUBLISHED_ROW = {
  id: "pub-1", slug: "2026-10-08-ichika-宮島-1r-previous_day", race_date: "2026-10-08", course_name: "宮島", race_no: 1,
  character_key: "ichika", edition: "previous_day", title: "公開中の新聞", summary: "公開中の要約", article_body: "公開中の本文",
  image_url: "https://img.test/a.png", note_title: null, note_body: null, note_url: "https://note.com/x", x_post: "x", shorts_script: "s",
  source_payload: { manual: true }, status: "published", published_at: "2026-10-07T21:00:00.000Z", created_at: "2026-10-07T20:00:00.000Z",
  updated_at: "2026-10-07T21:00:00.000Z",
};
const DRAFT_ROW = { ...PUBLISHED_ROW, id: "draft-1", slug: "2026-10-08-kiina-宮島-1r-previous_day", character_key: "kiina", title: "下書き", status: "draft", published_at: null };
const ARCHIVED_ROW = { ...PUBLISHED_ROW, id: "arc-1", slug: "2026-10-08-hatsune-宮島-1r-previous_day", character_key: "hatsune", title: "アーカイブ", status: "archived", published_at: null };

function body(overrides = {}) {
  return {
    date: "2026-10-08", course: "宮島", raceNo: "1", character: "ichika", edition: "previous_day", title: "【10/8 前日版】宮島1R｜一果新聞",
    summary: "新しい要約", articleBody: "新しい本文", noteTitle: "note", noteBody: "note本文", xPost: "X", shortsScript: "台本",
    imageUrl: "", noteUrl: "", status: "draft", sourcePayload: { escapeRate: "84.2" }, ...overrides,
  };
}

function fakeDb(rows = []) {
  return createFakeSupabase({ [TABLE]: rows }, { uniqueKeys: NEWSPAPER_UNIQUE_KEYS });
}

function rowById(db, id) {
  return db.tables[TABLE].find((row) => row.id === id);
}

async function loadRoutes({ authenticated = true, db }) {
  const stubs = {
    "next/server": { NextResponse: FakeNextResponse },
    "@supabase/supabase-js": { createClient: () => db },
    "/admin/sync/_lib/adminAuth": { isAdminAuthenticated: async () => authenticated },
    "/lib/newspaperContent": { newspaperSlug: channels.newspaperSlug },
  };
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fake.supabase.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
  const legacy = await loadRouteModule({ sourcePath: path.join(ROOT, "tests/newspaper/legacy/newspapers.js.txt"), stubs });
  const current = await loadRouteModule({ sourcePath: path.join(ROOT, "app/api/admin/newspapers/route.js"), stubs });
  return { legacy, current };
}

function withoutVolatile(row) {
  const { id, updated_at, published_at, ...rest } = row;
  return { ...rest, hasPublishedAt: Boolean(published_at) };
}

// ---- 変更前との互換（新規・下書きの保存） ----

test("新規保存・下書きの上書き保存は変更前と同じ行になる", async () => {
  for (const scenario of [
    { label: "新規・下書き", rows: [], input: body() },
    { label: "新規・公開", rows: [], input: body({ status: "published" }) },
    { label: "新規・公開日時指定", rows: [], input: body({ status: "published", publishedAt: "2026-10-08T00:00:00.000Z" }) },
    { label: "新規・不正な状態", rows: [], input: body({ status: "deleted" }) },
    { label: "下書きを下書きで上書き", rows: [DRAFT_ROW], input: body({ character: "kiina" }) },
    { label: "下書きを公開", rows: [DRAFT_ROW], input: body({ character: "kiina", status: "published" }) },
    { label: "アーカイブを下書きに戻す", rows: [ARCHIVED_ROW], input: body({ character: "hatsune" }) },
    { label: "空欄はnull", rows: [], input: body({ summary: "", articleBody: undefined, sourcePayload: undefined }) },
  ]) {
    const legacyDb = fakeDb([...scenario.rows]);
    const currentDb = fakeDb([...scenario.rows]);
    const legacy = (await loadRoutes({ db: legacyDb })).legacy;
    const current = (await loadRoutes({ db: currentDb })).current;
    const before = await legacy.POST(postRequest(scenario.input));
    const after = await current.POST(postRequest(scenario.input));
    assert.equal(after.status, before.status, scenario.label);
    assert.deepStrictEqual(legacyDb.tables[TABLE].map(withoutVolatile), currentDb.tables[TABLE].map(withoutVolatile), scenario.label);
    assert.deepStrictEqual(withoutVolatile(after.body.item), withoutVolatile(before.body.item), scenario.label);
  }
});

test("必須項目不足は変更前と同じ400", async () => {
  for (const key of ["date", "course", "raceNo", "character", "edition", "title"]) {
    const { legacy, current } = await loadRoutes({ db: fakeDb() });
    const input = body({ [key]: "" });
    assert.deepStrictEqual(await current.POST(postRequest(input)), await legacy.POST(postRequest(input)), key);
  }
});

test("一覧取得（GET）は変更前と同じ", async () => {
  const rows = [PUBLISHED_ROW, DRAFT_ROW, ARCHIVED_ROW, { ...DRAFT_ROW, id: "d2", race_date: "2026-10-09", slug: "s2" }];
  for (const url of ["https://x/api", "https://x/api?date=2026-10-08", "https://x/api?character=kiina", "https://x/api?date=2026-10-09&character=kiina"]) {
    const { legacy, current } = await loadRoutes({ db: fakeDb(rows) });
    assert.deepStrictEqual(await current.GET(getRequest(url)), await legacy.GET(getRequest(url)), url);
  }
});

// ---- 公開済み新聞の保護 ----

test("公開済み新聞は通常の下書き保存で上書き・非公開化されない（変更前は上書きされていた）", async () => {
  const legacyDb = fakeDb([{ ...PUBLISHED_ROW }]);
  const { legacy } = await loadRoutes({ db: legacyDb });
  await legacy.POST(postRequest(body()));
  assert.equal(rowById(legacyDb, "pub-1").status, "draft", "変更前の問題を再現できている");

  const db = fakeDb([{ ...PUBLISHED_ROW }]);
  const { current } = await loadRoutes({ db });
  const response = await current.POST(postRequest(body()));
  assert.equal(response.status, 409);
  assert.equal(response.body.code, "published_exists");
  assert.equal(response.body.current.updated_at, PUBLISHED_ROW.updated_at);
  assert.deepStrictEqual(rowById(db, "pub-1"), PUBLISHED_ROW);
  assert.ok(!db.calls.some((call) => ["update", "upsert", "insert"].includes(call.action)));
});

test("公開済み新聞は公開のままの保存でも、明示的な確認なしでは変更されない", async () => {
  for (const status of ["published", "archived"]) {
    const db = fakeDb([{ ...PUBLISHED_ROW }]);
    const response = await saveNewspaperPublication(db, body({ status }));
    assert.equal(response.status, 409, status);
    assert.deepStrictEqual(rowById(db, "pub-1"), PUBLISHED_ROW, status);
  }
});

test("確認フラグだけ・古いupdated_atでは公開済み新聞を変更しない", async () => {
  for (const extra of [
    { confirmPublishedUpdate: true },
    { confirmPublishedUpdate: true, expectedUpdatedAt: "2026-10-07T00:00:00.000Z" },
    { confirmPublishedUpdate: "true", expectedUpdatedAt: PUBLISHED_ROW.updated_at },
    { expectedUpdatedAt: PUBLISHED_ROW.updated_at },
  ]) {
    const db = fakeDb([{ ...PUBLISHED_ROW }]);
    const response = await saveNewspaperPublication(db, body({ status: "published", ...extra }));
    assert.equal(response.status, 409, JSON.stringify(extra));
    assert.deepStrictEqual(rowById(db, "pub-1"), PUBLISHED_ROW, JSON.stringify(extra));
  }
});

test("確認と最新のupdated_atを付けた明示的な更新だけが公開済み新聞を変更する（公開日時は維持）", async () => {
  const db = fakeDb([{ ...PUBLISHED_ROW }]);
  const response = await saveNewspaperPublication(db, body({ status: "published", noteUrl: "https://note.com/new", confirmPublishedUpdate: true, expectedUpdatedAt: PUBLISHED_ROW.updated_at }), { now: "2026-10-08T03:00:00.000Z" });
  assert.equal(response.status, 200);
  const row = rowById(db, "pub-1");
  assert.equal(row.status, "published");
  assert.equal(row.note_url, "https://note.com/new");
  assert.equal(row.published_at, PUBLISHED_ROW.published_at);
  assert.equal(row.updated_at, "2026-10-08T03:00:00.000Z");
});

test("明示的な操作でのみ公開を取り消せる", async () => {
  const db = fakeDb([{ ...PUBLISHED_ROW }]);
  const response = await saveNewspaperPublication(db, body({ status: "draft", confirmPublishedUpdate: true, expectedUpdatedAt: PUBLISHED_ROW.updated_at }));
  assert.equal(response.status, 200);
  assert.equal(rowById(db, "pub-1").status, "draft");
  assert.equal(rowById(db, "pub-1").published_at, null);
});

test("確認後の更新直前に別操作で更新されていたら変更しない", async () => {
  const db = fakeDb([{ ...PUBLISHED_ROW }]);
  const original = db.from.bind(db);
  db.from = (table) => {
    const query = original(table);
    const update = query.update.bind(query);
    query.update = (values) => { rowById(db, "pub-1").updated_at = "2026-10-08T02:00:00.000Z"; return update(values); };
    return query;
  };
  const response = await saveNewspaperPublication(db, body({ status: "published", confirmPublishedUpdate: true, expectedUpdatedAt: PUBLISHED_ROW.updated_at }));
  assert.equal(response.status, 409);
  assert.equal(response.body.code, "published_stale");
  assert.equal(rowById(db, "pub-1").title, PUBLISHED_ROW.title);
});

test("下書き保存の直前に公開された場合も公開中の行を変更しない", async () => {
  const db = fakeDb([{ ...DRAFT_ROW }]);
  const original = db.from.bind(db);
  db.from = (table) => {
    const query = original(table);
    const update = query.update.bind(query);
    query.update = (values) => { rowById(db, "draft-1").status = "published"; return update(values); };
    return query;
  };
  const response = await saveNewspaperPublication(db, body({ character: "kiina" }));
  assert.equal(response.status, 409);
  assert.equal(response.body.code, "published_exists");
  assert.equal(rowById(db, "draft-1").title, DRAFT_ROW.title);
});

test("新規保存の直前に同じレースの新聞が作られた場合は409（上書きしない）", async () => {
  const db = fakeDb([]);
  const original = db.from.bind(db);
  db.from = (table) => {
    const query = original(table);
    const insert = query.insert.bind(query);
    query.insert = (values) => { db.tables[TABLE].push({ ...PUBLISHED_ROW }); return insert(values); };
    return query;
  };
  const response = await saveNewspaperPublication(db, body());
  assert.equal(response.status, 409);
  assert.equal(response.body.code, "conflict_retry");
  assert.deepStrictEqual(db.tables[TABLE], [PUBLISHED_ROW]);
});

test("DBエラーは500で返す", async () => {
  for (const action of ["select", "insert"]) {
    const db = createFakeSupabase({ [TABLE]: [] }, { failures: { [`${TABLE}:${action}`]: { message: `${action} failed` } } });
    const response = await saveNewspaperPublication(db, body());
    assert.deepStrictEqual(response, { status: 500, body: { error: `${action} failed` } });
  }
});

test("未認証の保存・一覧取得は401でDBに触れない", async () => {
  const db = fakeDb([{ ...PUBLISHED_ROW }]);
  const { current } = await loadRoutes({ authenticated: false, db });
  assert.deepStrictEqual(await current.POST(postRequest(body())), { status: 401, body: { error: "unauthorized" } });
  assert.deepStrictEqual(await current.GET(getRequest("https://x/api")), { status: 401, body: { error: "unauthorized" } });
  assert.equal(db.calls.length, 0);
});

// ---- 自動下書き用（PHASE 2 で使用予定。今は未接続） ----

test("insertNewspaperDraftIfAbsent は既存行（公開済み・下書き）を一切変更しない", async () => {
  for (const existing of [PUBLISHED_ROW, DRAFT_ROW]) {
    const db = fakeDb([{ ...existing }]);
    const result = await insertNewspaperDraftIfAbsent(db, body({ character: existing.character_key, status: "published" }));
    assert.deepStrictEqual(result, { inserted: false, reason: "exists" });
    assert.deepStrictEqual(db.tables[TABLE], [existing]);
    const call = db.calls.find((c) => c.action === "upsert");
    assert.deepStrictEqual(call.options, { onConflict: NEWSPAPER_CONFLICT_KEY, ignoreDuplicates: true });
  }
});

test("insertNewspaperDraftIfAbsent は status=published を指定されても下書きで作る", async () => {
  const db = fakeDb([]);
  const result = await insertNewspaperDraftIfAbsent(db, body({ status: "published", publishedAt: "2026-10-08T00:00:00.000Z" }));
  assert.equal(result.inserted, true);
  assert.equal(result.item.status, "draft");
  assert.equal(result.item.published_at, null);
  assert.deepStrictEqual(await insertNewspaperDraftIfAbsent(db, body({ title: "" })), { inserted: false, reason: "missing_required_field" });
});
