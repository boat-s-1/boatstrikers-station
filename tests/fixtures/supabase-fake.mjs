// テスト用の Supabase クライアント（メモリ上の表）。PostgREST のうち、テスト対象が使う機能だけを実装する。
// globalThis.__supabaseFake = { tables: { name: [rows] }, hooks: { beforeUpdate, beforeInsert }, writes: [] }
function state() {
  if (!globalThis.__supabaseFake) globalThis.__supabaseFake = { tables: {}, hooks: {}, writes: [] };
  return globalThis.__supabaseFake;
}

function parseOr(expr) {
  // 例: "article_body_source.is.null,article_body_source.neq.manual"
  return expr.split(",").map((part) => {
    const [col, op, ...rest] = part.split(".");
    const val = rest.join(".");
    if (op === "is" && val === "null") return (r) => r[col] == null;
    if (op === "neq") return (r) => r[col] != null && String(r[col]) !== val;   // SQL と同じく NULL は neq に当たらない
    if (op === "eq") return (r) => r[col] != null && String(r[col]) === val;
    throw new Error(`unsupported or(): ${part}`);
  });
}

export function createClient() {
  return {
    from(table) {
      const s = state();
      const rows = () => (s.tables[table] ||= []);
      const q = { filters: [], op: "select", payload: null, cols: "*", limit: null };
      const match = (r) => q.filters.every((f) => f(r));
      const pick = (r) => (q.cols === "*" ? { ...r } : Object.fromEntries(q.cols.split(",").map((c) => [c.trim(), r[c.trim()]])));
      const run = (mode) => {
        if (q.op === "insert") {
          s.hooks.beforeInsert?.({ table, payload: q.payload });
          const err = s.hooks.insertError?.({ table, payload: q.payload });
          if (err) return { data: null, error: err };
          if (table === "hatsune_news" && rows().some((r) => r.source_key === q.payload.source_key)) {
            return { data: null, error: { code: "23505", message: "duplicate key value violates unique constraint" } };
          }
          const row = { id: s.nextId = (s.nextId || 1000) + 1, ...q.payload };
          rows().push(row); s.writes.push({ table, op: "insert", row: { ...row } });
          return { data: mode ? pick(row) : [pick(row)], error: null };
        }
        if (q.op === "update") {
          s.hooks.beforeUpdate?.({ table, payload: q.payload, tables: s.tables });
          const hit = rows().filter(match);
          for (const r of hit) Object.assign(r, q.payload);
          for (const r of hit) s.writes.push({ table, op: "update", id: r.id, payload: { ...q.payload } });
          const out = hit.map(pick);
          if (mode === "single") return out.length === 1 ? { data: out[0], error: null } : { data: null, error: { code: "PGRST116", message: "no rows" } };
          if (mode === "maybeSingle") return { data: out[0] || null, error: null };
          return { data: out, error: null };
        }
        if (q.op === "upsert") {
          s.writes.push({ table, op: "upsert", payload: { ...q.payload } });
          return { data: mode ? { id: 1, ...q.payload } : [q.payload], error: null };
        }
        let out = rows().filter(match);
        if (q.limit != null) out = out.slice(0, q.limit);
        out = out.map(pick);
        if (mode === "single") return out.length === 1 ? { data: out[0], error: null } : { data: null, error: { code: "PGRST116" } };
        if (mode === "maybeSingle") return { data: out[0] || null, error: null };
        return { data: out, error: null };
      };
      const b = {
        select(cols) { if (q.op === "select" && cols) q.cols = cols; else if (cols) q.cols = cols; return b; },
        eq(col, val) { q.filters.push((r) => r[col] === val); return b; },
        neq(col, val) { q.filters.push((r) => r[col] != null && r[col] !== val); return b; },
        or(expr) { const fs = parseOr(expr); q.filters.push((r) => fs.some((f) => f(r))); return b; },
        order() { return b; },
        limit(n) { q.limit = n; return b; },
        insert(p) { q.op = "insert"; q.payload = p; return b; },
        update(p) { q.op = "update"; q.payload = p; return b; },
        upsert(p) { q.op = "upsert"; q.payload = p; return b; },
        maybeSingle() { return Promise.resolve(run("maybeSingle")); },
        single() { return Promise.resolve(run("single")); },
        then(res, rej) { return Promise.resolve(run(null)).then(res, rej); },
      };
      return b;
    },
  };
}
