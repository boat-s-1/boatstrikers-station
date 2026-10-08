// 起動中のローカルサーバーに対して、新聞関連APIの認証を確認する任意テスト。
// 実行例: NEWSPAPER_HTTP_BASE_URL=http://127.0.0.1:3100 NEWSPAPER_HTTP_ADMIN_PASSWORD=... node --test tests/newspaper/admin-auth.http.test.mjs
// 本番URLには向けないこと（ログインと保存APIを呼ぶため）。
import test from "node:test";
import assert from "node:assert/strict";

const BASE = process.env.NEWSPAPER_HTTP_BASE_URL;
const PASSWORD = process.env.NEWSPAPER_HTTP_ADMIN_PASSWORD;
const skip = !BASE || !PASSWORD ? "NEWSPAPER_HTTP_BASE_URL / NEWSPAPER_HTTP_ADMIN_PASSWORD が未設定" : false;

const API_PATHS = [
  "/api/admin/ichika-news/candidates?date=2026-10-08",
  "/api/admin/hatsune-news/candidates?date=2026-10-08&timing=previous_day",
  "/api/admin/kiina-news/candidates?date=2026-10-08",
  "/api/admin/ichika-news/prediction?date=2026-10-08&course=%E5%AE%AE%E5%B3%B6&raceNo=1",
  "/api/admin/hatsune-news/prediction?date=2026-10-08&course=%E5%AE%AE%E5%B3%B6&raceNo=1",
  "/api/admin/kiina-news/prediction?date=2026-10-08&course=%E5%AE%AE%E5%B3%B6&raceNo=1",
  "/api/admin/newspapers?date=2026-10-08",
];

async function login() {
  const form = new URLSearchParams({ password: PASSWORD });
  const response = await fetch(new URL("/api/admin/login", BASE), { method: "POST", body: form, redirect: "manual" });
  assert.equal(response.status, 303);
  const cookie = response.headers.get("set-cookie")?.split(";")[0];
  assert.match(cookie || "", /^bs_admin_sync=/);
  return cookie;
}

test("未認証の候補・予想・新聞一覧APIは401", { skip }, async () => {
  for (const path of API_PATHS) {
    const response = await fetch(new URL(path, BASE));
    assert.equal(response.status, 401, path);
  }
  const forged = await fetch(new URL(API_PATHS[0], BASE), { headers: { cookie: "bs_admin_sync=9999999999.forged" } });
  assert.equal(forged.status, 401);
});

test("未認証の保存・AI記事生成APIは401", { skip }, async () => {
  for (const path of ["/api/admin/newspapers", "/api/admin/newspapers/ai-write"]) {
    const response = await fetch(new URL(path, BASE), { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    assert.equal(response.status, 401, path);
  }
});

test("管理画面にログインした管理者は候補・予想APIを引き続き使える", { skip }, async () => {
  const cookie = await login();
  for (const path of API_PATHS) {
    const response = await fetch(new URL(path, BASE), { headers: { cookie } });
    assert.notEqual(response.status, 401, path);
    const json = await response.json();
    if (path.includes("/newspapers")) assert.ok(Array.isArray(json.items), path);
    else assert.equal(json.ok, true, `${path} ${JSON.stringify(json)}`);
  }
});

test("新聞作成画面は未ログインならログインへ、ログイン済みなら表示される", { skip }, async () => {
  const cookie = await login();
  for (const page of ["/admin/ichika-news", "/admin/hatsune-news", "/admin/kiina-news"]) {
    const anonymous = await fetch(new URL(page, BASE), { redirect: "manual" });
    assert.ok([307, 308].includes(anonymous.status), `${page} ${anonymous.status}`);
    assert.match(anonymous.headers.get("location") || "", /\/admin-login/);
    const signedIn = await fetch(new URL(page, BASE), { headers: { cookie } });
    assert.equal(signedIn.status, 200, page);
  }
});
