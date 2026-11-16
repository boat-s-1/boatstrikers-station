import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const path = resolve(dirname(fileURLToPath(import.meta.url)), "../../app/api/live/openapi-preview/route.js");
const source = readFileSync(path, "utf8")
  .replace(/^import .*;$/gm, "")
  .replace(/^export const /gm, "const ")
  .replace(/^export async function /gm, "async function ")
  + "\nglobalThis.handlers = { GET, POST };";
const date = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
const boats = () => Object.fromEntries(Array.from({ length: 6 }, (_, i) =>
  [String(i + 1), { entry_number: i + 1, number: 4001 + i }]));
const valid = () => ({ programs: { stadiums: { 2: { stadium_number: 2,
  races: { 1: { date, race_number: 1, racers: boats() } } } } } });

async function run({ mutate = () => {}, query = `?date=${date}`, method = "GET" } = {}) {
  let fetches = 0, clients = 0;
  const context = {
    process: { env: { CRON_SECRET: "test-secret", NEXT_PUBLIC_SUPABASE_URL: "https://example.test",
      SUPABASE_SERVICE_ROLE_KEY: "dummy" } },
    NextResponse: { json: (body, opts = {}) => ({ body, status: opts.status ?? 200 }) },
    createClient: () => { clients++; throw Error("database reached"); },
    fetch: async () => { fetches++; const data = valid(); mutate(data);
      return { ok: true, json: async () => data }; },
    URL, Date, console: { error: () => {} }
  };
  runInNewContext(source, context, { filename: path });
  const response = await context.handlers[method]({
    url: `https://example.test/api/live/openapi-preview${query}`,
    headers: { get: () => "Bearer test-secret" }
  });
  return { status: response.status, fetches, clients };
}

test("invalid date syntax fails before fetch or database client", async () => {
  const r = await run({ query: "?date=not-a-date" });
  assert.deepEqual(r, { status: 500, fetches: 0, clients: 0 });
});
test("empty stadium manifest fails closed", async () => {
  const r = await run({ mutate: d => { d.programs.stadiums = {}; } });
  assert.deepEqual(r, { status: 500, fetches: 1, clients: 0 });
});
test("wrong race date fails before database client", async () => {
  const r = await run({ mutate: d => { d.programs.stadiums[2].races[1].date = "2020-01-01"; } });
  assert.deepEqual(r, { status: 500, fetches: 1, clients: 0 });
});
test("invalid registration number fails before database client", async () => {
  const r = await run({ mutate: d => { d.programs.stadiums[2].races[1].racers[1].number = "abc"; } });
  assert.deepEqual(r, { status: 500, fetches: 1, clients: 0 });
});
test("invalid stadium number fails before database client", async () => {
  const r = await run({ mutate: d => { d.programs.stadiums[2].stadium_number = 25; } });
  assert.deepEqual(r, { status: 500, fetches: 1, clients: 0 });
});
test("invalid payload also fails closed on POST", async () => {
  const r = await run({ method: "POST", mutate: d => { d.programs.stadiums[2].races[1].racers = {}; } });
  assert.deepEqual(r, { status: 500, fetches: 1, clients: 0 });
});
