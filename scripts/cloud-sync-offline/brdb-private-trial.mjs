import { buildBrdbSingleRaceQueries } from "./brdb-q011-query.mjs";
import { decodeBrdbCsv } from "./brdb-csv-decoder.mjs";
import { mapBrdbProgramRoster } from "./brdb-program-roster.mjs";

// A single select containing two bounded SQL statements, at most 3 state checks,
// then at most 2 CSV reads. No retry, logging, persistence or network in this module.
export async function runBrdbPrivateTrial({ date, course, race, request, pollDelayMs = 5000 }) {
  const queries = buildBrdbSingleRaceQueries(date, course, race);
  if (typeof request !== "function") throw new TypeError("request function required");
  if (!Number.isInteger(pollDelayMs) || pollDelayMs < 0 || pollDelayMs > 5000) throw new RangeError("invalid poll delay");
  let calls = 0;
  const call = async (prccd, params) => {
    calls++;
    return request(prccd, params);
  };
  const stop = (reason) => ({ status: reason, calls });
  // Record only a bounded numeric return code. Provider messages may contain private data.
  const providerCode = value => {
    if (typeof value !== "string" && typeof value !== "number") return null;
    if (!/^-?(0|[1-9]\d{0,3})$/.test(String(value))) return null;
    const code = Number(value);
    return code >= -9999 && code <= 9999 ? code : null;
  };
  const select = await call("select", { cmd1: queries.master, cmd2: queries.detail });
  if (providerCode(select?.ret) !== 0) return { ...stop("HOLD_SELECT"), providerCode: providerCode(select?.ret) };
  if (select.ret1 == null || select.ret2 == null) return stop("HOLD_QUEUE_ID");
  const ids = [select.ret1, select.ret2].map(String);
  if (ids.some(id => !/^[A-Za-z0-9_-]{1,128}$/.test(id))) return stop("HOLD_QUEUE_ID");
  let complete = false;
  for (let i = 0; i < 3; i++) {
    if (i > 0 && pollDelayMs) await new Promise(resolve => setTimeout(resolve, pollDelayMs));
    const state = await call("state", { qid1: ids[0], qid2: ids[1] });
    if (Number(state?.ret) !== 0) return stop("HOLD_STATE");
    const codes = [Number(state.ret1), Number(state.ret2)];
    if (codes.every(code => code === 2)) { complete = true; break; }
    if (codes.some(code => ![0, 1, 2].includes(code))) return stop("HOLD_JOB");
  }
  if (!complete) return stop("HOLD_TIMEOUT");
  const master = await call("getcsv", { qid: ids[0] });
  const detail = await call("getcsv", { qid: ids[1] });
  const a = decodeBrdbCsv(master, { requiredColumns: ["SOPDT", "OPDT", "RCOURSECD", "RNO", "CLOSETM"] });
  const b = decodeBrdbCsv(detail);
  if (a.status !== "CANDIDATE_ONLY" || b.status !== "CANDIDATE_ONLY") return stop("HOLD_CSV");
  if (a.records.length !== 1) return stop("HOLD_MASTER");
  const m = a.records[0];
  if (m.OPDT !== date || Number(m.RCOURSECD) !== course || Number(m.RNO) !== race ||
      !/^\d{3,4}$/.test(m.CLOSETM ?? "")) return stop("HOLD_MASTER");
  const roster = mapBrdbProgramRoster(b.records, date);
  if (roster.status !== "CANDIDATE_ONLY" || roster.rows.length !== 6 ||
      roster.rows.some(row => row.course_code !== course || row.race_no !== race)) return stop("HOLD_ROSTER");
  return { status: "CANDIDATE_PRIVATE_ONLY", calls, masterCount: 1, boatCount: 6,
    deadline: m.CLOSETM, rows: roster.rows };
}
