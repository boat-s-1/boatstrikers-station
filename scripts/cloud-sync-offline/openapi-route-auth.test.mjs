import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";

const routePath = resolve(dirname(fileURLToPath(import.meta.url)), "../../app/api/live/openapi-preview/route.js");
const source = readFileSync(routePath, "utf8")
  .replace(/^import .*;$/gm, "")
  .replace(/^export const /gm, "const ")
  .replace(/^export async function /gm, "async function ")
  + "\nglobalThis.handlers = { GET, POST };";

function makeHarness(secret) {
  let fetchCalls = 0;
  let databaseCalls = 0;
  const context = {
    process: { env: secret ? { CRON_SECRET: secret } : {} },
    NextResponse: { json: (body, options = {}) => ({ body, status: options.status ?? 200 }) },
    createClient: () => { databaseCalls++; throw new Error("database reached"); },
    fetch: () => { fetchCalls++; throw new Error("network reached"); },
    URL, Date, console,
  };
  runInNewContext(source, context, { filename: routePath });
  return { handlers: context.handlers, counts: () => ({ fetchCalls, databaseCalls }) };
}

for (const method of ["GET", "POST"]) {
  for (const [label, auth, secret] of [
    ["missing token", null, "test-secret"],
    ["incorrect token", "Bearer incorrect", "test-secret"],
    ["missing secret configuration", "Bearer test-secret", null],
  ]) {
    test(`${method} rejects ${label} before network or database access`, async () => {
      const harness = makeHarness(secret);
      const response = await harness.handlers[method]({
        url: "https://example.test/api/live/openapi-preview",
        headers: { get: () => auth },
      });
      assert.equal(response.status, 401);
      assert.deepEqual(harness.counts(), { fetchCalls: 0, databaseCalls: 0 });
    });
  }
}
