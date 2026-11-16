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
const today = () => new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
const fixture = (date) => ({
  programs: { stadiums: { 2: { stadium_number: 2, races: {
    1: { date, race_number: 1, subtitle: "test", racers: Object.fromEntries(
      Array.from({ length: 6 }, (_, i) => [i + 1, {
        entry_number: i + 1, number: 4001 + i, name: `racer-${i + 1}`,
        national_win_rate: 5.5, average_start_timing: 0.15
      }])) }
  } } } }
});
async function invoke({ errorAt = null } = {}) {
  const date = today();
  const calls = [];
  const context = {
    process: { env: { BS_OPENAPI_TODAY_SYNC_ENABLED: "true", BS_OPENAPI_TODAY_SYNC_ENABLED: "true", CRON_SECRET: "secret", NEXT_PUBLIC_SUPABASE_URL: "https://example.test",
      SUPABASE_SERVICE_ROLE_KEY: "dummy" } },
    NextResponse: { json: (body, options = {}) => ({ body, status: options.status ?? 200 }) },
    createClient: () => ({ rpc: async (name, args) => {
      calls.push({ name, args });
      return { data: name, error: name === errorAt ? { message: "injected failure" } : null };
    } }),
    fetch: async () => ({ ok: true, json: async () => fixture(date) }),
    URL, Date, console: { error: () => {} }
  };
  runInNewContext(source, context, { filename: path });
  const response = await context.handlers.GET({
    url: `https://example.test/api/live/openapi-preview?date=${date}`,
    headers: { get: () => "Bearer secret" }
  });
  return { response, calls };
}
test("valid current-day program sends six entries to bootstrap before preview RPCs", async () => {
  const { response, calls } = await invoke();
  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(calls[0].name, "bs_apply_openapi_bootstrap");
  assert.equal(calls[0].args.p_events.length, 1);
  assert.equal(calls[0].args.p_entries.length, 6);
  assert.deepEqual([...calls[0].args.p_entries.map(x => x.boat_no)].sort(), [1,2,3,4,5,6]);
  assert.equal(calls[0].args.p_entries[0].national_win_rate, 5.5);
  assert.equal(calls[0].args.p_entries[0].average_st, 0.15);
  assert.deepEqual(calls.slice(1).map(c => c.name).sort(), [
    "bs_apply_openapi_preview", "bs_apply_openapi_preview_events"
  ]);
});
test("bootstrap RPC error prevents preview writes", async () => {
  const { response, calls } = await invoke({ errorAt: "bs_apply_openapi_bootstrap" });
  assert.equal(response.status, 500);
  assert.deepEqual(calls.map(c => c.name), ["bs_apply_openapi_bootstrap"]);
});
test("preview RPC error returns failure, not false success", async () => {
  const { response, calls } = await invoke({ errorAt: "bs_apply_openapi_preview" });
  assert.equal(response.status, 500);
  assert.equal(calls.length, 3);
});
