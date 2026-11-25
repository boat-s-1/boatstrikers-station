// Offline-only decoder for BRDB CSV candidates. Never fetches or publishes data.
const REQUIRED = ["SOPDT", "OPDT", "RCOURSECD", "RNO", "TEINO", "ENTNO"];
export function decodeBrdbCsv(bytes, { maxBytes = 5_000_000 } = {}) {
  if (!(bytes instanceof Uint8Array) || bytes.length === 0 || bytes.length > maxBytes) {
    return { status: "HOLD_CSV_SIZE" };
  }
  let source;
  try { source = new TextDecoder("shift_jis", { fatal: true }).decode(bytes); }
  catch { return { status: "HOLD_CSV_ENCODING" }; }
  if (source.charCodeAt(0) === 0xfeff) source = source.slice(1);
  const lines = [];
  let row = [], field = "", quoted = false, closed = false;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (quoted) {
      if (ch === '"' && source[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') { quoted = false; closed = true; }
      else field += ch;
    } else if (ch === '"' && field === "" && !closed) quoted = true;
    else if (ch === ",") { row.push(field); field = ""; closed = false; }
    else if (ch === "\r" || ch === "\n") {
      if (ch === "\r" && source[i + 1] === "\n") i++;
      row.push(field); lines.push(row); row = []; field = ""; closed = false;
    } else if (closed || ch === '"') return { status: "HOLD_CSV_SYNTAX" };
    else field += ch;
  }
  if (quoted) return { status: "HOLD_CSV_SYNTAX" };
  if (field !== "" || row.length || closed) { row.push(field); lines.push(row); }
  if (lines.length < 2) return { status: "HOLD_CSV_EMPTY" };
  const headers = lines.shift();
  if (new Set(headers).size !== headers.length || headers.some(h => h === "") ||
      REQUIRED.some(h => !headers.includes(h))) return { status: "HOLD_CSV_HEADER" };
  const records = [];
  for (const values of lines) {
    if (values.length !== headers.length) return { status: "HOLD_CSV_WIDTH" };
    records.push(Object.fromEntries(headers.map((h, i) => [h, values[i]])));
  }
  return { status: "CANDIDATE_ONLY", records };
}
