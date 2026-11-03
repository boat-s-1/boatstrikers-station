import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { main, outputFolder, parseArgs, assertNoKey, MAX_GENERATIONS } from "../../scripts/blog/run-local-ai-verification.mjs";

// PHASE 2 (plan B): the operator's local real-AI run, with the OpenAI API faked. Proves the limits and the key handling
// before anyone spends money: at most 1 + 3 calls, nothing written inside the repository, the key never in any output.
const KEY = "sk-test-0123456789abcdefghij";
const mock = name => readFileSync(new URL(`./fixtures/mock-ai/${name}.json`, import.meta.url), "utf8");
const ANSWERS = [mock("ichika-kiryu-inside-escape"), mock("hatsune-women-inside-escape"), mock("kiina-kiryu-boat5")];

function fakeApi({ fail = null } = {}) {
  const bodies = [];
  let n = 0;
  const fetchImpl = async (url, init) => {
    bodies.push({ url, auth: init.headers.Authorization, body: JSON.parse(init.body) });
    if (fail) return new Response(JSON.stringify({ error: { message: "billing" } }), { status: fail });
    const text = n++ === 0 ? "{\"ok\":true}" : ANSWERS[n - 2];
    return new Response(JSON.stringify({ model: "gpt-test", usage: { input_tokens: 3000, output_tokens: 1500, total_tokens: 4500 }, output: [{ content: [{ type: "output_text", text }] }] }), { status: 200 });
  };
  return { fetchImpl, bodies };
}
function harness({ answer = "y", env = {}, fail = null } = {}) {
  const files = new Map(), logs = [], dirs = [];
  const api = fakeApi({ fail });
  const io = { readHidden: async () => KEY, readLine: async () => answer, fetchImpl: api.fetchImpl, mkdir: p => dirs.push(p), writeFile: (p, data) => files.set(p, data) };
  return { files, logs, dirs, api, run: () => main({ argv: ["--price-input", "1", "--price-output", "4", "--out", "/tmp/blog-ai-out"], env, io, log: l => logs.push(l), now: () => new Date("2026-11-04T01:00:00Z") }) };
}

test("cancelled before any call: answering anything but y calls nothing and writes nothing", async () => {
  const h = harness({ answer: "n" });
  assert.equal((await h.run()).status, "cancelled");
  assert.equal(h.api.bodies.length, 0);
  assert.equal(h.files.size, 0);
});

test("one connection check, then one generation per character (3 at most), no retry; report outside the repository without the key", async () => {
  const h = harness();
  const r = await h.run();
  assert.equal(r.status, "done");
  assert.equal(h.api.bodies.length, 1 + MAX_GENERATIONS);
  assert.ok(h.api.bodies.every(b => b.url === "https://api.openai.com/v1/responses" && b.auth === `Bearer ${KEY}`), "the key goes only to OpenAI");
  assert.equal(h.api.bodies[0].body.max_output_tokens, 1000);
  assert.ok(h.dirs[0].startsWith("/tmp/blog-ai-out"));
  const report = JSON.parse(h.files.get(join(h.dirs[0], "report.json")));
  assert.equal(report.calls, 3);
  assert.deepEqual(report.results.map(l => [l.character, l.verdict, l.tampered.verdict]), [["ichika", "PASS", "HOLD"], ["hatsune", "PASS", "HOLD"], ["kiina", "PASS", "HOLD"]]);
  assert.ok(report.results.every(l => l.generation.usage.output_tokens === 1500 && l.generation.estimated_cost_usd === 0.009 && Number.isFinite(l.generation.duration_ms)));
  for (const text of [...h.files.values(), ...h.logs]) assert.ok(!String(text).includes(KEY), "no key in any output");
  assert.match(h.files.get(join(h.dirs[0], "summary.md")), /記事生成の呼び出し：3回（上限3回・再試行なし。再生成回数は0）/);
});

test("billing or quota failure at the connection check stops before any article is generated", async () => {
  const h = harness({ fail: 429 });
  const r = await h.run();
  assert.equal(r.status, "smoke_failed");
  assert.equal(r.smokeResult.kind, "quota");
  assert.equal(h.api.bodies.length, 1);
  assert.equal(h.files.size, 0);
});

test("output folder inside the repository is refused; arguments are validated; the key check blocks saving", () => {
  const repo = resolve(new URL("../..", import.meta.url).pathname);
  assert.throws(() => outputFolder({ out: join(repo, "results"), repo }), /リポジトリの外/);
  assert.throws(() => outputFolder({ out: repo, repo }), /リポジトリの外/);
  assert.match(outputFolder({ out: "/tmp/x", repo, now: new Date("2026-11-04T01:02:03.456Z") }), /2026-11-04T01-02-03-456Z$/);
  assert.match(outputFolder({ home: "/home/boat", repo }), /boatstrikers-blog-ai-verification/, "default: a folder in the user's home");
  assert.deepEqual(parseArgs(["--price-input", "1.25", "--model", "m"]), { priceInput: 1.25, priceOutput: undefined, model: "m", out: undefined });
  assert.throws(() => parseArgs(["--price-input", "abc"]), /数値/);
  assert.throws(() => assertNoKey(`{"x":"${KEY}"}`, KEY), /保存を中止/);
});
