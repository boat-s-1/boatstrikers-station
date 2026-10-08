// 新聞まわりの比較テスト用ヘルパー。
// - loadRouteModule: Next.jsのAPIルート（.js）を、外部依存だけ差し替えて Node で読み込む。
// - createFakeSupabase: PostgREST風のクエリをメモリ上のテーブルで再現する。
import { readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

// NextResponse.json の代わり。テストでは { status, body } として比較する。
export const FakeNextResponse = {
  json(body, init = {}) {
    return { status: init.status ?? 200, body: JSON.parse(JSON.stringify(body)) };
  },
};

let loadCounter = 0;

/**
 * ルートのソースを読み込み、指定した import を globalThis.__routeStubs の値へ差し替えてから評価する。
 * stubs: { "<import元の文字列>": { 名前: 値 } }。相対パスの .mjs は絶対URLへ置き換える。
 */
export async function loadRouteModule({ source, sourcePath, stubs }) {
  const code = source ?? await readFile(sourcePath, "utf8");
  const id = `s${loadCounter += 1}`;
  globalThis.__routeStubs ??= {};
  globalThis.__routeStubs[id] = {};
  const baseDir = sourcePath ? path.dirname(sourcePath) : ROOT;
  const rewritten = code.replace(/^import\s+(\{[^}]*\}|[\w$]+)\s+from\s+"([^"]+)";\s*$/gm, (line, names, specifier) => {
    const stub = Object.entries(stubs).find(([key]) => specifier === key || specifier.endsWith(key));
    if (stub) {
      globalThis.__routeStubs[id][specifier] = stub[1];
      return `const ${names.replace(/\s+as\s+/g, ": ")} = globalThis.__routeStubs.${id}[${JSON.stringify(specifier)}];`;
    }
    if (specifier.startsWith(".") && specifier.endsWith(".mjs")) {
      return `import ${names} from ${JSON.stringify(pathToFileURL(path.resolve(baseDir, specifier)).href)};`;
    }
    throw new Error(`未対応のimport: ${specifier}`);
  });
  return import(`data:text/javascript;base64,${Buffer.from(rewritten).toString("base64")}`);
}

export function getRequest(url) {
  return { url, headers: new Map() };
}

export function postRequest(body) {
  return { url: "https://example.test/api", json: async () => JSON.parse(JSON.stringify(body)) };
}

// ---- メモリ上の Supabase 代替 ----

function project(row, columns) {
  if (!columns || columns.trim() === "*") return { ...row };
  const out = {};
  for (const column of columns.split(",").map((c) => c.trim()).filter(Boolean)) {
    out[column] = row[column] === undefined ? null : row[column];
  }
  return out;
}

function compare(a, b) {
  if (a === b) return 0;
  if (a === null || a === undefined) return 1;
  if (b === null || b === undefined) return -1;
  return a < b ? -1 : 1;
}

class Query {
  constructor(db, table) {
    this.db = db;
    this.table = table;
    this.filters = [];
    this.orders = [];
    this.limitCount = null;
    this.action = "select";
    this.columns = "*";
    this.returning = false;
    this.mode = "many";
  }
  select(columns = "*") {
    if (this.action === "select") this.columns = columns;
    else { this.returning = true; this.columns = columns; }
    return this;
  }
  insert(values) { this.action = "insert"; this.values = values; return this; }
  update(values) { this.action = "update"; this.values = values; return this; }
  upsert(values, options = {}) { this.action = "upsert"; this.values = values; this.options = options; return this; }
  eq(column, value) { this.filters.push((row) => row[column] === value); return this; }
  neq(column, value) { this.filters.push((row) => row[column] !== value); return this; }
  in(column, values) { this.filters.push((row) => values.includes(row[column])); return this; }
  gte(column, value) { this.filters.push((row) => row[column] >= value); return this; }
  lte(column, value) { this.filters.push((row) => row[column] <= value); return this; }
  order(column, { ascending = true } = {}) { this.orders.push({ column, ascending }); return this; }
  limit(count) { this.limitCount = count; return this; }
  maybeSingle() { this.mode = "maybeSingle"; return this; }
  single() { this.mode = "single"; return this; }
  then(resolve, reject) { return Promise.resolve().then(() => this.execute()).then(resolve, reject); }

  rows() { return this.db.tables[this.table] ??= []; }

  matching() {
    let rows = this.rows().filter((row) => this.filters.every((f) => f(row)));
    for (const { column, ascending } of [...this.orders].reverse()) {
      rows = [...rows].sort((a, b) => (ascending ? 1 : -1) * compare(a[column], b[column]));
    }
    if (this.limitCount !== null) rows = rows.slice(0, this.limitCount);
    return rows;
  }

  finish(rows) {
    const data = rows.map((row) => project(row, this.columns));
    if (this.mode === "maybeSingle") {
      if (data.length > 1) return { data: null, error: { message: "multiple rows", code: "PGRST116" } };
      return { data: data[0] ?? null, error: null };
    }
    if (this.mode === "single") {
      if (data.length !== 1) return { data: null, error: { message: "not single", code: "PGRST116" } };
      return { data: data[0], error: null };
    }
    return { data, error: null };
  }

  uniqueClash(candidate, exceptRow = null) {
    const keys = this.db.uniqueKeys[this.table] || [];
    return keys.find((key) => this.rows().some((row) => row !== exceptRow && key.every((c) => row[c] === candidate[c])));
  }

  execute() {
    this.db.calls.push({ table: this.table, action: this.action, values: this.values, options: this.options });
    const failure = this.db.failures[`${this.table}:${this.action}`];
    if (failure) return { data: null, error: failure };

    if (this.action === "select") return this.finish(this.matching());

    if (this.action === "insert") {
      const values = Array.isArray(this.values) ? this.values : [this.values];
      const inserted = [];
      for (const value of values) {
        if (this.uniqueClash(value)) return { data: null, error: { message: "duplicate key value violates unique constraint", code: "23505" } };
        const row = { id: `id-${this.db.nextId += 1}`, ...value };
        this.rows().push(row);
        inserted.push(row);
      }
      return this.returning ? this.finish(inserted) : { data: null, error: null };
    }

    if (this.action === "update") {
      const updated = [];
      for (const row of this.matching()) {
        Object.assign(row, this.values);
        updated.push(row);
      }
      return this.returning ? this.finish(updated) : { data: null, error: null };
    }

    if (this.action === "upsert") {
      const values = Array.isArray(this.values) ? this.values : [this.values];
      const conflict = String(this.options?.onConflict || "").split(",").map((c) => c.trim()).filter(Boolean);
      const written = [];
      for (const value of values) {
        const existing = this.rows().find((row) => conflict.length && conflict.every((c) => row[c] === value[c]));
        if (existing) {
          if (this.options?.ignoreDuplicates) continue;
          Object.assign(existing, value);
          written.push(existing);
        } else {
          if (this.uniqueClash(value)) return { data: null, error: { message: "duplicate key value violates unique constraint", code: "23505" } };
          const row = { id: `id-${this.db.nextId += 1}`, ...value };
          this.rows().push(row);
          written.push(row);
        }
      }
      return this.returning ? this.finish(written) : { data: null, error: null };
    }
    throw new Error(`unsupported action ${this.action}`);
  }
}

export function createFakeSupabase(tables = {}, { uniqueKeys = {}, failures = {} } = {}) {
  const db = {
    tables: JSON.parse(JSON.stringify(tables)),
    uniqueKeys,
    failures,
    calls: [],
    nextId: 1000,
    from(table) { return new Query(db, table); },
  };
  return db;
}

export const NEWSPAPER_UNIQUE_KEYS = {
  bs_newspaper_publications: [["slug"], ["race_date", "course_name", "race_no", "character_key", "edition"]],
};
