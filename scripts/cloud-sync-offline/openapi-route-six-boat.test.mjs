import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";

const path = resolve(dirname(fileURLToPath(import.meta.url)), "../../app/api/live/openapi-preview/route.js");
const source = readFileSync(path, "utf8").replace(/^import .*;$/gm, "")
  .replace(/^export const /gm, "const ")
  .replace(/^export async function /gm, "async function ")
  + "\nglobalThis.handlers = { GET, POST };";
const date = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
function fixture(boats) {
  return { programs: { stadiums: { 2: { stadium_number: 2, races: { 1: {
    date, stadium_number: 2, race_number: 1,
    racers: Object.fromEntries(boats.map((boat) => [String(boat), { entry_number: boat, number: 4000 + boat }]))
  } } } } } };
}
async function invoke(boats, mutate = () => {}) {
  let dbCalls = 0;
  const context = {
    process: { env: {
      BS_OPENAPI_TODAY_SYNC_ENABLED: "true",
      CRON_SECRET: "test-secret",
      NEXT_PUBLIC_SUPABASE_URL: "https://example.test",
      SUPABASE_SERVICE_ROLE_KEY: "dummy",
    } },
    NextResponse: { json: (body, options = {}) => ({ body, status: options.status ?? 200 }) },
    createClient: () => { dbCalls++; throw Error("DB reached"); },
    fetch: async () => ({ ok: true, json: async () => { const data = fixture(boats); mutate(data); return data; } }),
    URL, Date, console: { error: () => {} },
  };
  runInNewContext(source, context, { filename: path });
  const response = await context.handlers.GET({
    url: `https://example.test/api/live/openapi-preview?date=${date}`,
    headers: { get: () => "Bearer test-secret" },
  });
  return { response, dbCalls };
}
test("five boats stop before service-role client", async () => {
  const { response, dbCalls } = await invoke([1,2,3,4,5]);
  assert.equal(response.status, 500);
  assert.equal(dbCalls, 0);
});
test("duplicate boat number stops before service-role client", async () => {
  const { response, dbCalls } = await invoke([1,2,3,4,5,5]);
  assert.equal(response.status, 500);
  assert.equal(dbCalls, 0);
});
test("six distinct boats reach the service-role client", async () => {
  const { dbCalls } = await invoke([1,2,3,4,5,6]);
  assert.equal(dbCalls, 1);
});

test("malformed extra race cannot be silently skipped", async () => {
  const { response, dbCalls } = await invoke([1,2,3,4,5,6], (data) => {
    data.programs.stadiums[2].races[13] = { date, race_number: 13, racers: {} };
  });
  assert.equal(response.status, 500);
  assert.equal(dbCalls, 0);
});
