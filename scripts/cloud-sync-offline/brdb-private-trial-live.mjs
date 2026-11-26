import { runBrdbPrivateTrial } from "./brdb-private-trial.mjs";

const ENDPOINT = "https://api.gamble-os.net/systems/brdb";
const MAX_RESPONSE = 1_000_000;
const id = process.env.BRDB_TNC_ID;
const password = process.env.BRDB_TNC_PASSWORD;
const date = process.env.BRDB_TRIAL_DATE;
const course = Number(process.env.BRDB_TRIAL_COURSE);
const race = Number(process.env.BRDB_TRIAL_RACE);
if (process.argv[2] !== "--live" || process.env.BRDB_TRIAL_ONE_SHOT !== "YES" ||
    !id || !password) {
  throw new Error("HOLD_CONFIG: manual live flag and secret environment required");
}
async function request(operation, parameters) {
  const form = new URLSearchParams({ prccd: operation, tncid: id, tncpw: password, ...parameters });
  if (operation !== "getcsv") form.set("format", "json");
  const response = await fetch(ENDPOINT, {
    method: "POST",
    body: form,
    redirect: "manual",
    signal: AbortSignal.timeout(15_000),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  if (response.status !== 200 || response.headers.get("location")) throw new Error("HOLD_HTTP");
  const length = Number(response.headers.get("content-length") ?? 0);
  if (length > MAX_RESPONSE) throw new Error("HOLD_SIZE");
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length > MAX_RESPONSE) throw new Error("HOLD_SIZE");
  if (operation === "getcsv") return bytes;
  try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
  catch { throw new Error("HOLD_RESPONSE"); }
}
try {
  const result = await runBrdbPrivateTrial({ date, course, race, request });
  // Never print credentials, SQL, queue identifiers, CSV, or racer identities.
  process.stdout.write(JSON.stringify({
    status: result.status,
    calls: result.calls,
    masterCount: result.masterCount ?? 0,
    boatCount: result.boatCount ?? 0,
  }) + "\n");
  if (result.status !== "CANDIDATE_PRIVATE_ONLY") process.exitCode = 2;
} catch {
  process.stderr.write("HOLD_TRANSPORT_OR_CONFIG: no result accepted\n");
  process.exitCode = 2;
}
