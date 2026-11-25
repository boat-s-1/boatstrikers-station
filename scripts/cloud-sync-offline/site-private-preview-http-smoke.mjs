import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const base = "http://127.0.0.1:33221";
const timedFetch = (url, options = {}) => fetch(url, { ...options, signal: AbortSignal.timeout(3000) });
const server = spawn("node", ["node_modules/next/dist/bin/next", "start", "-p", "33221", "-H", "127.0.0.1"], {
  env: { ...process.env, BS_ADMIN_PROGRAM_PREVIEW_ENABLED: "true", ADMIN_DASHBOARD_PASSWORD: "ci-only-private-preview" },
  stdio: ["ignore", "pipe", "pipe"],
});
let serverOutput = "";
server.stdout.on("data", (chunk) => { serverOutput = (serverOutput + chunk.toString()).slice(-1500); });
server.stderr.on("data", (chunk) => { serverOutput = (serverOutput + chunk.toString()).slice(-1500); });
async function ready() {
  let lastStatus = "no response";
  for (let attempt = 0; attempt < 20; attempt++) {
    if (server.exitCode !== null || server.signalCode !== null) throw new Error(`server exited: ${serverOutput}`);
    try {
      lastStatus = (await timedFetch(base + "/api/admin/program-preview")).status;
      if (lastStatus === 404) return;
    }
    catch { /* Starting. */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`server readiness timeout; last status: ${lastStatus}; server output: ${serverOutput}`);
}
try {
  await ready();
  const denied = await timedFetch(base + "/api/admin/program-preview");
  assert.equal(denied.status, 404, "anonymous access must be denied");
  const login = await timedFetch(base + "/api/admin/sync/login", {
    method: "POST",
    body: new URLSearchParams({ password: "ci-only-private-preview" }),
    redirect: "manual",
  });
  assert.equal(login.status, 303);
  const cookie = login.headers.get("set-cookie")?.split(";")[0];
  assert.match(cookie ?? "", /^bs_admin_sync=/);
  const allowed = await timedFetch(base + "/api/admin/program-preview", { headers: { cookie } });
  assert.equal(allowed.status, 200);
  const data = await allowed.json();
  assert.equal(data.synthetic, true);
  assert.equal(data.entries.length, 6);
  for (let boat = 1; boat <= 6; boat++) assert.equal(data.entries[boat - 1].boat, boat);
  assert.match(allowed.headers.get("cache-control") ?? "", /no-store/);
  process.stdout.write("Private synthetic API: anonymous 404, admin 200, six boats present.\\n");
} finally {
  server.kill("SIGTERM");
}
process.exit(0);
