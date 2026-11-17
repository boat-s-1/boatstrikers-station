// Pure edits for LIST / TABLE blocks and block citations, shared by the admin editor and its tests.
// Every function returns new arrays/objects; the inputs are never modified.

export const LIST_MAX_ITEMS = 50;
export const TABLE_MAX_ROWS = 50;
export const TABLE_MAX_COLUMNS = 8;
// Blocks whose numbers/dates are checked against a citation. Headings are not cited: their figures are checked
// against the cited blocks of their section (lib/blog/ai/validate.mjs).
export const CITABLE_TYPES = ["TEXT", "POINT", "WARNING", "DATA_CHECK", "QUOTE", "LIST", "TABLE", "DIALOGUE_SCENE"];

const inRange = (list, i) => Number.isInteger(i) && i >= 0 && i < list.length;
const swap = (list, i, j) => { const out = [...list]; [out[i], out[j]] = [out[j], out[i]]; return out; };

export const listItems = {
  set: (items, i, value) => (inRange(items, i) ? items.map((x, n) => (n === i ? String(value) : x)) : items),
  add: items => (items.length >= LIST_MAX_ITEMS ? items : [...items, ""]),
  remove: (items, i) => (inRange(items, i) ? items.filter((_, n) => n !== i) : items),
  move: (items, i, step) => (inRange(items, i) && inRange(items, i + step) ? swap(items, i, i + step) : items),
  // Removes empty items on request (never automatically: an item being typed starts empty).
  compact: items => items.filter(v => String(v ?? "").trim()),
};

// Empty entries are valid in a saved document (older documents may have them) but show as empty lines or cells
// on the public page, so the editor points them out.
export const emptyItems = items => items.some(v => !String(v ?? "").trim());
export const emptyCells = rows => { const width = tableWidth(rows); return rows.some(r => Array.from({ length: width }, (_, c) => r[c] ?? "").some(v => !String(v).trim())); };
export const raggedRows = rows => rows.some(r => r.length !== tableWidth(rows));

// Tables are kept rectangular: short rows (possible in older documents) are padded when the table is edited.
export function tableWidth(rows) {
  return Math.max(1, ...rows.map(r => r.length));
}
function rectangular(rows) {
  const width = tableWidth(rows);
  return rows.map(r => (r.length === width ? [...r] : [...r, ...Array(width - r.length).fill("")]));
}
export const tableRows = {
  setCell: (rows, r, c, value) => {
    const out = rectangular(rows);
    if (!inRange(out, r) || !inRange(out[r], c)) return rows;
    out[r][c] = String(value);
    return out;
  },
  addRow: rows => (rows.length >= TABLE_MAX_ROWS ? rows : [...rectangular(rows), Array(tableWidth(rows)).fill("")]),
  removeRow: (rows, r) => (inRange(rows, r) && rows.length > 1 ? rectangular(rows).filter((_, n) => n !== r) : rows),
  moveRow: (rows, r, step) => (inRange(rows, r) && inRange(rows, r + step) ? swap(rectangular(rows), r, r + step) : rows),
  addColumn: rows => (tableWidth(rows) >= TABLE_MAX_COLUMNS ? rows : rectangular(rows).map(r => [...r, ""])),
  // Explicit clean-ups offered by the editor: even out short rows, drop rows with no text (one row always stays).
  normalize: rows => rectangular(rows),
  dropEmptyRows: rows => { const kept = rectangular(rows).filter(r => r.some(v => String(v).trim())); return kept.length ? kept : [Array(tableWidth(rows)).fill("")]; },
  removeColumn: (rows, c) => (tableWidth(rows) > 1 && c >= 0 && c < tableWidth(rows) ? rectangular(rows).map(r => r.filter((_, n) => n !== c)) : rows),
};

// The sources a block currently cites, as shown in the picker: its source_ids while they belong to its
// source_url (as set by compose or by setBlockSources), otherwise the registered sources with that URL.
export function blockSourceIds(data, sources) {
  if (!data?.source_url) return [];
  const known = (data.source_ids || []).filter(id => sources.some(s => s.id === id));
  if (known.length && sources.find(s => s.id === known[0]).url === data.source_url) return known;
  return sources.filter(s => s.url === data.source_url).map(s => s.id);
}

// Sets (or, with no ids, removes) a block's citation. Only ids of the article's registered sources are kept, in
// the order of the source list; source_url/source_label follow them exactly as compose writes them.
export function setBlockSources(data, ids, sources) {
  const { source_ids, source_url, source_label, ...rest } = data;
  const chosen = sources.filter(s => ids.includes(s.id));
  if (!chosen.length) return rest;
  return { ...rest, source_ids: chosen.map(s => s.id), source_url: chosen[0].url, source_label: chosen.map(s => s.label).join(" / ").slice(0, 500) };
}

// Blocks citing ids that are not registered for the article: [{ index, ids }]. Used to refuse such saves.
export function unknownSourceIds(document, registered) {
  const known = new Set(registered);
  return (document?.blocks || []).map((b, index) => ({ index, ids: (Array.isArray(b?.data?.source_ids) ? b.data.source_ids : []).filter(id => !known.has(id)) }))
    .filter(x => x.ids.length);
}
