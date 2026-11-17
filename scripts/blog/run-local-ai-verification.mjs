// PHASE 2 — real-AI verification on the operator's own PC (plan B). Windows (PowerShell / Windows Terminal) and macOS/Linux.
//
//   node scripts/blog/run-local-ai-verification.mjs [--price-input <USD per 1M>] [--price-output <USD per 1M>] [--model <name>] [--out <folder>]
//
// What it does, in order, stopping at the first problem:
//   1. checks Node.js 20+ and that it runs from the repository root;
//   2. asks for the OpenAI API key with a HIDDEN prompt (nothing is shown; the key is not part of any command line, so it
//      is not saved in PowerShell/PSReadLine history) — or uses OPENAI_API_KEY if it is already set in this window;
//   3. shows the plan (model, number of calls, output-token limit) and waits for "y";
//   4. one tiny connection check (max 1,000 output tokens, no retry);
//   5. at most 3 article generations — 一果・初音・キイナ once each, NO retry — on real race data
//      (tests/blog/fixtures/real-data/), each checked against the data, the 7 gates, a tampered copy and a copy without the period;
//      a case whose data fails the quality gate is HOLD and the AI is not called;
//   6. writes report.json + summary.md OUTSIDE the repository (default: <home>/boatstrikers-blog-ai-verification/<time>/),
//      after checking that the key does not appear in them.
// Nothing is written to any database; no environment variable or file in the repository is changed.
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve, relative, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { aiConfig } from "../../lib/blog/ai/config.mjs";
import { smoke } from "./openai-smoke.mjs";
import { runVerification } from "./verify-real-articles.mjs";

export const MAX_GENERATIONS = 3;
const REPO = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const CASES = join(REPO, "tests", "blog", "fixtures", "real-data", "cases.json");

export function parseArgs(argv) {
  const value = name => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
  const num = name => { const v = value(name); if (v === undefined) return undefined; const n = Number(v); if (!Number.isFinite(n) || n < 0) throw new Error(`${name} は0以上の数値で指定してください。`); return n; };
  return { priceInput: num("--price-input"), priceOutput: num("--price-output"), model: value("--model"), out: value("--out") };
}

// The output folder must be outside the repository, so results can never be committed by accident.
export function outputFolder({ out, now = new Date(), home = homedir(), repo = REPO }) {
  const base = resolve(out || join(home, "boatstrikers-blog-ai-verification"));
  const rel = relative(repo, base);
  if (rel === "" || (!rel.startsWith("..") && !isAbsolute(rel))) throw new Error("結果の保存先はリポジトリの外にしてください（Gitに残さないため）。");
  return join(base, now.toISOString().replace(/[:.]/g, "-"));
}

// Hidden input: characters are not echoed. Ctrl+C aborts. Works in Windows Terminal, PowerShell and cmd.
export function readHidden(prompt, { input = process.stdin, output = process.stdout } = {}) {
  return new Promise((resolvePromise, reject) => {
    if (!input.isTTY) { reject(new Error("キーの入力には対話できる画面（PowerShell や Windows Terminal）が必要です。")); return; }
    output.write(prompt);
    let value = "";
    input.setRawMode(true); input.resume(); input.setEncoding("utf8");
    const done = (error) => { input.setRawMode(false); input.pause(); input.removeListener("data", onData); output.write("\n"); error ? reject(error) : resolvePromise(value); };
    const onData = chunk => {
      for (const ch of chunk) {
        if (ch === "\u0003") return done(new Error("中止しました。"));
        if (ch === "\r" || ch === "\n") return done();
        if (ch === "\u0008" || ch === "\u007f") { value = value.slice(0, -1); continue; }
        if (ch >= " ") value += ch;
      }
    };
    input.on("data", onData);
  });
}

function readLine(prompt, { input = process.stdin, output = process.stdout } = {}) {
  return new Promise(resolvePromise => {
    output.write(prompt);
    input.resume(); input.setEncoding("utf8");
    const onData = chunk => { input.pause(); input.removeListener("data", onData); resolvePromise(String(chunk).trim()); };
    input.on("data", onData);
  });
}

// The report must never contain the key (checked before anything is written).
export function assertNoKey(text, key) {
  if (key && key.length >= 8 && text.includes(key)) throw new Error("結果にキーが含まれていたため、保存を中止しました。");
}

export function summaryMarkdown({ startedAt, model, smokeResult, verification, prices }) {
  const rows = verification.lines.map(l => {
    const g = l.generation || {}, u = g.usage || {};
    return `| ${l.character} | ${l.name} | ${l.ai_called ? "呼んだ" : "呼ばない"} | ${l.verdict ?? (l.error ? "失敗" : l.skipped ?? "-")} | ${l.reason ?? (l.error?.kind ?? "")} | ${l.dataset?.usable ?? "-"}/${l.dataset?.population ?? "-"} | ${u.input_tokens ?? "-"} | ${u.output_tokens ?? "-"} | ${g.duration_ms ?? "-"} | ${g.estimated_cost_usd ?? (prices ? "-" : "未設定")} | ${l.tampered?.verdict ?? "-"} | ${l.period_removed?.verdict ?? "-"} |`;
  });
  const gates = verification.lines.filter(l => l.gates).map(l => `- ${l.character}：${Object.entries(l.gates).map(([k, v]) => `${k}=${v}`).join("、")}`);
  return [`# BLOG 実AI検証（ローカルPC）`, "", `- 実行：${startedAt}`, `- モデル：${model}`, `- 疎通確認：${smokeResult.ok ? "OK" : "NG"}（${smokeResult.duration_ms ?? "-"}ms、出力${smokeResult.usage?.output_tokens ?? "-"}トークン）`,
    `- 記事生成の呼び出し：${verification.calls}回（上限${MAX_GENERATIONS}回・再試行なし。再生成回数は0）`, "",
    "| キャラ | ケース | AI | 判定 | 理由 | 集計数/母数 | 入力トークン | 出力トークン | 時間(ms) | 推定料金(USD) | 数値改ざん | 期間削除 |",
    "|---|---|---|---|---|---|---|---|---|---|---|---|", ...rows, "", "## 7ゲート", ...gates, ""].join("\n");
}

export async function main({ argv = process.argv.slice(2), env = process.env, io = {}, log = console.log, now = () => new Date() } = {}) {
  const [major] = process.versions.node.split(".").map(Number);
  if (major < 20) throw new Error(`Node.js 20 以上が必要です（現在 ${process.versions.node}）。`);
  if (!existsSync(CASES)) throw new Error("リポジトリの一番上のフォルダーで実行してください（実データの固定データが見つかりません）。");
  const args = parseArgs(argv);
  const folder = outputFolder({ out: args.out, now: now() });
  const key = env.OPENAI_API_KEY || await (io.readHidden || readHidden)("OpenAI APIキーを入力してください（画面には表示されません）: ");
  if (!key) throw new Error("キーが入力されませんでした。");
  const runEnv = { ...env, OPENAI_API_KEY: key,
    ...(args.model ? { BLOG_AI_MODEL: args.model } : {}),
    ...(args.priceInput !== undefined && args.priceOutput !== undefined ? { BLOG_AI_PRICE_INPUT_PER_1M: String(args.priceInput), BLOG_AI_PRICE_OUTPUT_PER_1M: String(args.priceOutput) } : {}) };
  const config = aiConfig(runEnv);
  log(`モデル：${config.model} ／ 疎通確認1回＋記事生成は最大${MAX_GENERATIONS}回（再試行なし） ／ 1回の出力上限 ${config.maxOutputTokens} トークン ／ 推定料金：${config.prices ? "あり" : "単価未指定のため計算しない"}`);
  log(`結果の保存先：${folder}`);
  const answer = await (io.readLine || readLine)("実行してよければ y を入力してください: ");
  if (answer.toLowerCase() !== "y") { log("中止しました（APIは呼んでいません）。"); return { status: "cancelled" }; }

  const smokeResult = await smoke({ env: runEnv, fetchImpl: io.fetchImpl || fetch });
  log(`疎通確認：${smokeResult.ok ? "OK" : `NG（${smokeResult.kind}：${smokeResult.message ?? ""}）`}`);
  if (!smokeResult.ok) return { status: "smoke_failed", smokeResult };

  const startedAt = now().toISOString();
  const verification = await runVerification({ casesFile: CASES, useAi: true, maxCalls: MAX_GENERATIONS, config, fetchImpl: io.fetchImpl || fetch,
    log: l => log(`${l.character ?? l.name}：${l.verdict ?? (l.error ? `失敗（${l.error.kind}）` : l.skipped)}${l.generation ? `・${l.generation.duration_ms}ms・入力${l.generation.usage?.input_tokens ?? "?"}/出力${l.generation.usage?.output_tokens ?? "?"}トークン` : ""}`) });
  const report = { startedAt, model: config.model, max_generations: MAX_GENERATIONS, prices: config.prices, smoke: { ...smokeResult }, calls: verification.calls, results: verification.lines };
  const json = JSON.stringify(report, null, 2), md = summaryMarkdown({ startedAt, model: config.model, smokeResult, verification, prices: config.prices });
  assertNoKey(json, key); assertNoKey(md, key);
  (io.mkdir || (p => mkdirSync(p, { recursive: true })))(folder);
  (io.writeFile || writeFileSync)(join(folder, "report.json"), json);
  (io.writeFile || writeFileSync)(join(folder, "summary.md"), md);
  log(`保存しました：${join(folder, "summary.md")}`);
  return { status: "done", folder, calls: verification.calls };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().then(r => process.exit(r.status === "done" || r.status === "cancelled" ? 0 : 1), e => { console.error(e.message); process.exit(1); });
}
