import http from "node:http";
import { spawn, spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { randomUUID } from "node:crypto";

const HOST = "127.0.0.1";
const PORT = Number(process.env.BS_SHORTS_LOCAL_PORT || 3210);
const ROOT = path.resolve(import.meta.dirname, "..");
const jobs = new Map();

function allowedOrigin(origin = "") {
  return /^https:\/\/([a-z0-9-]+\.)*boat-strike\.online$/i.test(origin)
    || /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin)
    || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
}

function cors(req, res) {
  const origin = req.headers.origin || "";
  if (allowedOrigin(origin)) res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Private-Network", "true");
}

function json(res, status, value) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(value));
}

async function body(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1_000_000) throw new Error("送信データが大きすぎます。");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

function commandReady(command) {
  const result = spawnSync(command, ["-version"], { stdio: "ignore", shell: false });
  return !result.error && result.status === 0;
}

async function aivisHealth() {
  try {
    const response = await fetch("http://127.0.0.1:10101/version", { signal: AbortSignal.timeout(2500) });
    return { ok: response.ok, version: response.ok ? await response.text() : null };
  } catch {
    return { ok: false, version: null };
  }
}

async function health() {
  return {
    ok: true,
    companion: true,
    aivis: await aivisHealth(),
    ffmpeg: { ok: commandReady("ffmpeg") && commandReady("ffprobe") },
    outputRoot: path.join(ROOT, "output", "shorts"),
  };
}

function validatePlan(plan) {
  if (!plan || !plan.narration || !Array.isArray(plan.picks) || plan.picks.length < 3) throw new Error("原稿またはTOP3が不足しています。");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(plan.date || ""))) throw new Error("開催日が正しくありません。");
  return plan;
}

async function synthesizePreview(plan) {
  const tts = plan.tts || {};
  const endpoint = String(tts.endpoint || "http://127.0.0.1:10101").replace(/\/$/, "");
  const speaker = Number(tts.speakerId);
  if (!Number.isFinite(speaker)) throw new Error("スタイルIDが設定されていません。");
  const queryResponse = await fetch(`${endpoint}/audio_query?text=${encodeURIComponent(plan.narration)}&speaker=${speaker}`, { method: "POST" });
  if (!queryResponse.ok) throw new Error(`音声クエリの作成に失敗しました（HTTP ${queryResponse.status}）。`);
  const query = await queryResponse.json();
  query.speedScale = Number(tts.speedScale || 1.08);
  query.intonationScale = Number(tts.intonationScale || 1.05);
  const response = await fetch(`${endpoint}/synthesis?speaker=${speaker}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(query),
  });
  if (!response.ok) throw new Error(`音声生成に失敗しました（HTTP ${response.status}）。`);
  return Buffer.from(await response.arrayBuffer());
}

async function startJob(plan) {
  const id = randomUUID();
  const job = { id, status: "queued", progress: 5, message: "生成準備中", date: plan.date, createdAt: new Date().toISOString() };
  jobs.set(id, job);
  const tempDir = path.join(ROOT, ".shorts-local");
  await mkdir(tempDir, { recursive: true });
  const planPath = path.join(tempDir, `${id}.json`);
  await writeFile(planPath, JSON.stringify(plan, null, 2), "utf8");

  const child = spawn(process.execPath, [path.join(ROOT, "scripts", "render-short.mjs"), planPath], { cwd: ROOT, shell: false });
  job.status = "running";
  job.progress = 15;
  job.message = "ナレーター音声を生成中";
  const onOutput = (chunk) => {
    const value = chunk.toString();
    if (value.includes("TTS:")) Object.assign(job, { progress: 35, message: "ナレーター音声を生成中" });
    if (value.includes("ffmpeg") || value.includes("frame=")) Object.assign(job, { progress: 70, message: "9:16動画を書き出し中" });
    job.log = `${job.log || ""}${value}`.slice(-4000);
  };
  child.stdout.on("data", onOutput);
  child.stderr.on("data", onOutput);
  child.on("error", (error) => Object.assign(job, { status: "error", message: error.message, progress: 0 }));
  child.on("close", (code) => {
    if (code === 0) {
      const outputDir = path.join(ROOT, "output", "shorts", plan.date);
      Object.assign(job, { status: "complete", progress: 100, message: "MP4が完成しました", outputDir, outputPath: path.join(outputDir, `ichika-top3-${plan.date}.mp4`) });
    } else if (job.status !== "error") {
      Object.assign(job, { status: "error", progress: 0, message: (job.log || `生成処理が終了コード${code}で停止しました。`).trim().split("\n").slice(-3).join(" ") });
    }
  });
  return job;
}

const server = http.createServer(async (req, res) => {
  cors(req, res);
  if (req.method === "OPTIONS") return res.writeHead(204).end();
  const origin = req.headers.origin || "";
  if (origin && !allowedOrigin(origin)) return json(res, 403, { error: "許可されていない接続元です。" });
  const url = new URL(req.url || "/", `http://${HOST}:${PORT}`);
  try {
    if (req.method === "GET" && url.pathname === "/health") return json(res, 200, await health());
    if (req.method === "POST" && url.pathname === "/preview") {
      const wav = await synthesizePreview(validatePlan(await body(req)));
      res.writeHead(200, { "Content-Type": "audio/wav", "Content-Length": wav.length });
      return res.end(wav);
    }
    if (req.method === "POST" && url.pathname === "/jobs") return json(res, 202, await startJob(validatePlan(await body(req))));
    const match = url.pathname.match(/^\/jobs\/([0-9a-f-]+)(\/open)?$/i);
    if (match) {
      const job = jobs.get(match[1]);
      if (!job) return json(res, 404, { error: "生成履歴が見つかりません。" });
      if (req.method === "GET" && !match[2]) return json(res, 200, job);
      if (req.method === "POST" && match[2]) {
        if (job.status !== "complete" || !existsSync(job.outputDir)) throw new Error("完成した保存フォルダがありません。");
        if (process.platform === "win32") spawn("explorer.exe", [job.outputDir], { detached: true, stdio: "ignore" }).unref();
        else if (process.platform === "darwin") spawn("open", [job.outputDir], { detached: true, stdio: "ignore" }).unref();
        else spawn("xdg-open", [job.outputDir], { detached: true, stdio: "ignore" }).unref();
        return json(res, 200, { ok: true });
      }
    }
    return json(res, 404, { error: "Not found" });
  } catch (error) {
    return json(res, 400, { error: error?.message || String(error) });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`準備完了: http://${HOST}:${PORT}`);
  console.log("AivisSpeechを起動し、管理画面の「接続を再確認」を押してください。");
});
