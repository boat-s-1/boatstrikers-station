// In-memory atomic-query fake; not evidence of PostgREST/SQL compatibility.
export function fakeDb(initial = {}) {
  const tables = structuredClone(initial), writes = [];
  let nextId = 100, before;
  const client = { from(table) {
    const q = { op: 'select', filters: [], single: false };
    const b = {
      select() { return b; }, order() { return b; }, limit() { return b; },
      eq(k,v) { q.filters.push(r => r[k] === v); return b; },
      in(k,v) { q.filters.push(r => v.includes(r[k])); return b; },
      range() { return b; },
      upsert(row, opts) { q.op='upsert'; q.row=row; q.opts=opts; return b; },
      update(row) { q.op='update'; q.row=row; return b; },
      delete() { q.op='delete'; return b; },
      maybeSingle() { q.single=true; return b; },
      then(resolve,reject) { return Promise.resolve().then(() => {
        before?.(table,q,tables);
        const rows = tables[table] ||= [];
        let hit = rows.filter(r => q.filters.every(f => f(r)));
        if (q.op === 'upsert') {
          const old = rows.find(r => r[q.opts.onConflict] === q.row[q.opts.onConflict]);
          if (old && q.opts.ignoreDuplicates) hit=[];
          else if (old) { Object.assign(old,q.row);hit=[old]; }
          else { const row={id:nextId++,...q.row};rows.push(row);hit=[row]; }
        } else if (q.op === 'update') hit.forEach(r => Object.assign(r,q.row));
        else if (q.op === 'delete') hit.forEach(r => rows.splice(rows.indexOf(r),1));
        if (q.op !== 'select' && hit.length) writes.push({ table, op:q.op, payload:q.row });
        return { data: structuredClone(q.single ? hit[0] || null : hit), error:null };
      }).then(resolve,reject); },
    };
    return b;
  }};
  return { client, tables, writes, before(fn) { before=fn; } };
}
export function createClient() { return globalThis.__batch1db.client; }
