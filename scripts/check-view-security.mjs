// supabase/migrations を古い順に読み、public スキーマのビューが最終的に security_invoker になっているかを確かめる。
// security_invoker の無いビューは、所有者（BYPASSRLS）の権限で元テーブルを読むため、RLS を迂回できてしまう
// （S1：v_bs_race_results_confirmed 経由で anon が bs_race_events を書き換えられた問題の再発防止）。
//
// 規則：
//   ・CREATE [OR REPLACE] VIEW に WITH (security_invoker = true) が無ければ、その時点で invoker なし
//     （CREATE OR REPLACE は以前の ALTER VIEW ... SET の設定を消す）
//   ・ALTER VIEW ... SET (security_invoker = true|on) で invoker あり、RESET (security_invoker) や = false でなし
//   ・DROP VIEW で追跡をやめる
//   ・ALTER TABLE でもビューの options は変えられるので、追跡中のビューに対する ALTER TABLE ... SET/RESET も同じ扱い
//   ・GRANT で anon・authenticated に書き込み系の権限（INSERT・UPDATE・DELETE・TRUNCATE・ALL）を与えたビューも違反
//   ・ON ALL TABLES IN SCHEMA public での anon・authenticated への書き込み権限の付与も違反（後の REVOKE で解消）
//   ・関数本体・DO ブロック（ドル引用 $$ … $$）の中の動的 SQL でビューを作る・options を変えるものは、
//     静的には確かめられないので違反とする。人が確認済みなら、同じファイルに
//     「-- check-view-security: dynamic-reviewed」と書いて除外する
//
// 使い方：node scripts/check-view-security.mjs [migrations ディレクトリ]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const IDENT = String.raw`((?:"?[A-Za-z_][\w$]*"?\s*\.\s*)?"?[A-Za-z_][\w$]*"?)`; // スキーマ名つきも可（public 以外は viewName で除外）

export function viewName(raw) {
  const parts = String(raw).replace(/"/g, "").split(".").map((p) => p.trim().toLowerCase());
  if (parts.length === 2 && parts[0] !== "public") return null; // public 以外のスキーマは対象外
  return parts.at(-1);
}

export function stripSql(sql) {
  return String(sql)
    .replace(/\$([A-Za-z_]*)\$[\s\S]*?\$\1\$/g, "''") // ドル引用の本体
    .replace(/--[^\n]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");
}

function invokerFromOptions(options) {
  const m = /(?:^|,)\s*security_invoker\s*(?:=\s*'?([A-Za-z0-9]+)'?)?\s*(?:,|$)/i.exec(options);
  if (!m) return null;
  return m[1] === undefined || /^(true|on|1|yes)$/i.test(m[1]);
}

const DYNAMIC_VIEW_DDL = /\b(?:create\s+(?:or\s+replace\s+)?(?:(?:temp|temporary|recursive)\s+)*view|alter\s+(?:view|table)\b[^;]*security_invoker)/i;

export function analyzeMigrations(files) {
  const views = new Map(); // name -> { invoker, file, writeGrant }
  const extra = []; // ビュー単位でない違反（動的 SQL、スキーマ全体への付与）
  let schemaWriteGrant = null;
  for (const { name: file, sql } of files) {
    const withoutComments = String(sql).replace(/--[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
    const reviewed = /check-view-security:\s*dynamic-reviewed/.test(sql);
    for (const body of withoutComments.matchAll(/\$([A-Za-z_]*)\$([\s\S]*?)\$\1\$/g)) {
      // 本体に直接書かれた DDL（文字列の外）か、EXECUTE で実行される文字列の中の DDL だけを対象にする（RAISE の文言などは除く）
      const outsideStrings = body[2].replace(/'(?:[^']|'')*'/g, "''");
      const executed = DYNAMIC_VIEW_DDL.test(outsideStrings) || (/\bexecute\b/i.test(outsideStrings) && DYNAMIC_VIEW_DDL.test(body[2]));
      if (!reviewed && executed) extra.push({ view: "(動的SQL)", problem: "関数・DO ブロック内の動的 SQL でビューを作成・変更（要確認）", file });
    }
    for (const statement of stripSql(sql).split(";")) {
      const st = statement.trim();
      if (!st) continue;
      let m;
      if ((m = new RegExp(String.raw`^create\s+(?:or\s+replace\s+)?(?:(?:temp|temporary|recursive)\s+)*view\s+${IDENT}`, "i").exec(st))) {
        const name = viewName(m[1]);
        if (!name) continue;
        const options = new RegExp(String.raw`^create\s+(?:or\s+replace\s+)?(?:(?:temp|temporary|recursive)\s+)*view\s+${IDENT}\s*(?:\([^)]*\)\s*)?with\s*\(([^)]*)\)`, "i").exec(st)?.[2] || "";
        const previous = views.get(name);
        views.set(name, { invoker: invokerFromOptions(options) === true, file, writeGrant: previous?.writeGrant || null });
        continue;
      }
      if ((m = new RegExp(String.raw`^alter\s+(view|table)\s+(?:if\s+exists\s+)?${IDENT}\s+(set|reset)\s*\(([^)]*)\)`, "i").exec(st))) {
        const [, kind, rawName, action, options] = m;
        m = [null, rawName, action, options];
        const name = viewName(m[1]);
        if (!name) continue;
        if (kind.toLowerCase() === "table" && !views.has(name)) continue; // 通常のテーブルは対象外
        const current = views.get(name) || { invoker: false, file, writeGrant: null };
        if (/security_invoker/i.test(m[3])) current.invoker = m[2].toLowerCase() === "set" && invokerFromOptions(m[3]) === true;
        current.file = file;
        views.set(name, current);
        continue;
      }
      if ((m = /^drop\s+view\s+(?:if\s+exists\s+)?([\s\S]+?)(?:\s+(?:cascade|restrict))?$/i.exec(st))) {
        for (const raw of m[1].split(",")) { const name = viewName(raw.trim()); if (name) views.delete(name); }
        continue;
      }
      if ((m = /^grant\s+([\s\S]+?)\s+on\s+(?:table\s+)?([\s\S]+?)\s+to\s+([\s\S]+)$/i.exec(st))) {
        const writes = /\b(all|insert|update|delete|truncate)\b/i.test(m[1]);
        const toClient = /\b(anon|authenticated|public)\b/i.test(m[3]);
        if (!writes || !toClient) continue;
        if (/^all\s+tables\s+in\s+schema\s+"?public"?$/i.test(m[2].trim())) { schemaWriteGrant = file; continue; }
        for (const raw of m[2].split(",")) {
          const name = viewName(raw.trim());
          if (name && views.has(name)) views.get(name).writeGrant = file;
        }
        continue;
      }
      if ((m = /^revoke\s+([\s\S]+?)\s+on\s+(?:table\s+)?([\s\S]+?)\s+from\s+([\s\S]+)$/i.exec(st))) {
        const covers = /\ball\b/i.test(m[1]) || ["insert", "update", "delete"].every((p) => new RegExp(`\\b${p}\\b`, "i").test(m[1]));
        if (!covers || !/\banon\b/i.test(m[3]) || !/\bauthenticated\b/i.test(m[3])) continue;
        if (/^all\s+tables\s+in\s+schema\s+"?public"?$/i.test(m[2].trim())) { schemaWriteGrant = null; for (const v of views.values()) v.writeGrant = null; continue; }
        for (const raw of m[2].split(",")) {
          const name = viewName(raw.trim());
          if (name && views.has(name)) views.get(name).writeGrant = null;
        }
      }
    }
  }
  const violations = [];
  for (const [name, v] of views) {
    if (!v.invoker) violations.push({ view: name, problem: "security_invoker なし", file: v.file });
    if (v.writeGrant) violations.push({ view: name, problem: "anon・authenticated への書き込み権限の付与", file: v.writeGrant });
  }
  if (schemaWriteGrant) violations.push({ view: "(public の全テーブル)", problem: "ON ALL TABLES IN SCHEMA public での anon・authenticated への書き込み権限の付与", file: schemaWriteGrant });
  violations.push(...extra);
  return { views: views.size, violations: violations.sort((a, b) => a.view.localeCompare(b.view)) };
}

export function readMigrations(dir) {
  return fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort().map((name) => ({ name, sql: fs.readFileSync(path.join(dir, name), "utf8") }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dir = process.argv[2] || "supabase/migrations";
  const { views, violations } = analyzeMigrations(readMigrations(dir));
  console.log(`views tracked: ${views}`);
  for (const v of violations) console.log(`NG  ${v.view}：${v.problem}（${v.file}）`);
  if (!violations.length) console.log("OK  すべてのビューが security_invoker で、anon・authenticated への書き込み権限の付与もありません");
  process.exitCode = violations.length ? 1 : 0;
}
