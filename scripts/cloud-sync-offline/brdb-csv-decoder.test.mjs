import test from "node:test";
import assert from "node:assert/strict";
import { decodeBrdbCsv } from "./brdb-csv-decoder.mjs";
import { mapBrdbProgramRoster } from "./brdb-program-roster.mjs";

const columns = "SOPDT,OPDT,RCOURSECD,RNO,TEINO,ENTNO,NOTE";
const rows = Array.from({ length: 6 }, (_, i) => `20261124,20261125,05,01,${i + 1},0${4101 + i},${i === 0 ? '"A,B"' : ""}`);
const bytes = (value) => new TextEncoder().encode(value);
test("provider-shaped CSV maps six boats offline", () => {
  const parsed = decodeBrdbCsv(bytes([columns, ...rows].join("\r\n") + "\r\n"));
  assert.equal(parsed.status, "CANDIDATE_ONLY");
  assert.equal(parsed.records[0].NOTE, "A,B");
  assert.equal(parsed.records[1].NOTE, "");
  const mapped = mapBrdbProgramRoster(parsed.records, "20261125");
  assert.equal(mapped.status, "CANDIDATE_ONLY");
  assert.equal(mapped.rows.length, 6);
});
test("Shift-JIS Japanese bytes and quoted newline decode without row split", () => {
  const input = Uint8Array.from([...bytes(columns + "\r\n20261124,20261125,05,01,1,04101,\""), 0x82, 0xa0, ...bytes("\r\nX\"\r\n")]);
  const parsed = decodeBrdbCsv(input);
  assert.equal(parsed.status, "CANDIDATE_ONLY");
  assert.equal(parsed.records[0].NOTE, "あ\r\nX");
});
test("malformed or ambiguous CSV holds before roster mapping", () => {
  assert.equal(decodeBrdbCsv(bytes(columns + "\n")).status, "HOLD_CSV_EMPTY");
  assert.equal(decodeBrdbCsv(bytes("OPDT,OPDT\n1,2")).status, "HOLD_CSV_HEADER");
  assert.equal(decodeBrdbCsv(bytes(columns + "\n" + rows[0] + ",extra")).status, "HOLD_CSV_WIDTH");
  assert.equal(decodeBrdbCsv(bytes(columns + "\n" + rows[0].replace('"A,B"', '"unclosed'))).status, "HOLD_CSV_SYNTAX");
  assert.equal(decodeBrdbCsv(Uint8Array.of(0x82)).status, "HOLD_CSV_ENCODING");
  assert.equal(decodeBrdbCsv(bytes(columns + "\n" + rows[0]), { maxBytes: 3 }).status, "HOLD_CSV_SIZE");
});
