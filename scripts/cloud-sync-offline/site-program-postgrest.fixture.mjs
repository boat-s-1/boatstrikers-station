import EmbeddedPostgres from "embedded-postgres";
import assert from "node:assert/strict";
import { createHmac, randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { appendFileSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readSiteProgramCandidate } from "./site-program-server-read.mjs";

const [postgrestPath] = process.argv.slice(2);
if (!postgrestPath) throw new Error("Pass the absolute path to the local PostgREST binary");

const dir = join(mkdtempSync(join(tmpdir(), "dev1-postgrest-")), "cluster");
const password = randomBytes(16).toString("hex");
const pg = new EmbeddedPostgres({ databaseDir: dir, user: "fixture", password, port: 55429,
  persistent: false, autoRehydrateSymlinks: true, onLog: () => {}, onError: console.error });
await pg.initialise();
appendFileSync(join(dir,"postgresql.conf"), "\nunix_socket_directories = ''\n");
await pg.start();
const admin = pg.getPgClient();
let api;
try {
  await admin.connect();
  await admin.query(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE ROLE authenticator LOGIN PASSWORD '${password}';
    GRANT anon, service_role TO authenticator;`);
  for (const suffix of ["", "-read"]) {
    await admin.query(readFileSync(
      new URL(`./site-previous-day-snapshot${suffix}.candidate.sql`, import.meta.url), "utf8"));
  }
  const { raceDate, captured } = (await admin.query(`SELECT
    ((now() AT TIME ZONE 'Asia/Tokyo')::date+1)::text AS "raceDate", now()::text AS captured`)).rows[0];
  const event = {race_date:raceDate,course_code:1,race_no:1,closing_time:"15:22"};
  const entries = Array.from({length:6},(_,i)=>({...event,boat_no:i+1,racer_registration_no:String(4000+i)}));
  await admin.query("SELECT bs_stage_site_previous_day_program_candidate($1,$2,$3,$4)",
    [raceDate,captured,JSON.stringify([event]),JSON.stringify(entries)]);
  const secret = randomBytes(32).toString("hex");
  api = spawn(postgrestPath, [], { env: {
    ...process.env,
    PGRST_DB_URI:`postgres://authenticator:${password}@127.0.0.1:55429/postgres`,
    PGRST_DB_SCHEMAS:"public", PGRST_DB_ANON_ROLE:"anon",
    PGRST_JWT_SECRET:secret, PGRST_SERVER_HOST:"127.0.0.1", PGRST_SERVER_PORT:"55430",
  }, stdio:["ignore","ignore","pipe"] });
  let log = ""; api.stderr.on("data", chunk => {log += chunk;});
  let launchError; api.on("error", error=>{launchError=error});
  const root = "http://127.0.0.1:55430";
  let ready = false;
  for(let i=0;i<50 && !launchError;i++){
    try { if ((await fetch(root)).ok) {ready=true;break;} } catch {}
    await new Promise(r=>setTimeout(r,50));
  }
  assert.ok(ready,launchError?.message??log);
  const encode = value=>Buffer.from(JSON.stringify(value)).toString("base64url");
  const tokenBody = `${encode({alg:"HS256",typ:"JWT"})}.${encode({role:"service_role"})}`;
  const token = `${tokenBody}.${createHmac("sha256",secret).update(tokenBody).digest("base64url")}`;
  const rpc = (name, data, signed) => fetch(`${root}/rpc/${name}`, {method:"POST",
    headers:{"content-type":"application/json",...(signed?{authorization:`Bearer ${token}`}:{})},
    body:JSON.stringify(data)});
  const readName = "bs_read_site_previous_day_program_candidate";
  const anon = await rpc(readName,{p_date:raceDate},false);
  assert.equal(anon.status,401);
  const client = {async rpc(name,data){
    const r=await rpc(name,data,true);
    const body=await r.json();
    return r.ok?{data:body,error:null}:{data:null,error:body};
  }};
  const now = new Date().toISOString(), race={courseCode:1,raceNo:1};
  const preview = await readSiteProgramCandidate(client,{raceDate,now,race});
  assert.equal(preview.source,"previous_day_snapshot");
  assert.equal(preview.entries.length,6);
  const live = {events:[event],entries:entries.map(row=>({...row,exhibition_time:6.8}))};
  const afterMidnight = await readSiteProgramCandidate(client,{raceDate,race,live,now:`${raceDate}T00:00:00+09:00`});
  assert.equal(afterMidnight.source,"live");
  assert.equal(afterMidnight.entries[0].exhibition_time,6.8);
  const missing = await readSiteProgramCandidate(client,{raceDate:"2026-01-01",now});
  assert.equal(missing.status,"NO_SNAPSHOT");
  console.log("Actual PostgREST HTTP: anonymous 401; service read six boats; preview→live with simulated JST midnight; expired snapshot omitted.");
} finally {
  if (api && api.pid) {
    const closed = new Promise(resolve=>api.once("close",resolve));
    api.kill();
    await closed;
  }
  await admin.end();
  await pg.stop();
}
