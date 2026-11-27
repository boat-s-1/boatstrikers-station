import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const base = "http://127.0.0.1:33221";
const timedFetch = (url, options = {}) => fetch(url, { ...options, signal: AbortSignal.timeout(3000) });
const server = spawn("node", ["node_modules/next/dist/bin/next", "start", "-p", "33221", "-H", "127.0.0.1"], {
  env: { ...process.env, BS_ADMIN_PROGRAM_PREVIEW_ENABLED: "true", ADMIN_DASHBOARD_PASSWORD: "ci-only-private-preview", NODE_OPTIONS: `--require ${process.cwd()}/scripts/cloud-sync-offline/site-private-preview-network-mock.cjs` },
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
  const anonymousPage = await timedFetch(base + "/admin/program-preview");
  assert.equal(anonymousPage.status, 404);
  const anonymousHtml = await anonymousPage.text();
  assert.doesNotMatch(anonymousHtml, /検証用選手[1-6]|900[1-6]|模擬データです/);
  const anonymousStatus = await timedFetch(base + "/admin/exhibition-data-status");
  assert.equal(anonymousStatus.status, 404, "exhibition status must deny anonymous requests before DB read");
  assert.doesNotMatch(await anonymousStatus.text(), /PC-KYOTEI取得済み|BOATERS取得済み/);
  const authorizedStatus = await timedFetch(base + "/admin/exhibition-data-status", { headers: { cookie } });
  assert.equal(authorizedStatus.status, 200);
  assert.match(await authorizedStatus.text(), /展示データ判定状況/);
  const anonymousCollection = await timedFetch(base + "/admin/alerts/collection");
  assert.equal(anonymousCollection.status, 404);
  const authorizedCollection = await timedFetch(base + "/admin/alerts/collection", { headers: { cookie } });
  assert.equal(authorizedCollection.status, 200);
  assert.match(await authorizedCollection.text(), /24場のオリ展収集状況/);
  const anonymousStandard = await timedFetch(base + "/api/admin/national-beforeinfo-check?course=8&date=2026-11-27&race=1");
  assert.equal(anonymousStandard.status, 401);
  const disabledStandard = await timedFetch(base + "/api/admin/national-beforeinfo-check?course=8&date=2026-11-27&race=1", { headers: { cookie } });
  assert.equal(disabledStandard.status, 404);
  const anonymousVerified = await timedFetch(base + "/api/admin/verified-exhibition-check?course=5&date=2026-11-21&race=2");
  assert.equal(anonymousVerified.status, 401);
  const anonymousBulk = await timedFetch(base + "/api/admin/exhibition-source-diagnostic");
  assert.equal(anonymousBulk.status, 401);
  const disabledBulk = await timedFetch(base + "/api/admin/exhibition-source-diagnostic", { headers: { cookie } });
  assert.equal(disabledBulk.status, 404);
  const authorizedPage = await timedFetch(base + "/admin/program-preview", { headers: { cookie } });
  assert.equal(authorizedPage.status, 200);
  const html = await authorizedPage.text();
  assert.match(html, /模擬データです/);
  for (let boat = 1; boat <= 6; boat++) assert.match(html, new RegExp(`検証用選手${boat}`));

  process.stdout.write(`Private synthetic API: anonymous 404, admin 200; HTML: anonymous status ${anonymousPage.status} without roster, admin 200 with six boats.\\n`);
} finally {
  server.kill("SIGTERM");
}
process.exit(0);
