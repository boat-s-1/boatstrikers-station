import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";

function fail(message) { console.error(`ERROR: ${message}`); process.exit(1); }
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: "inherit", shell: false, ...options });
  if (result.error) fail(`${command}を実行できません: ${result.error.message}`);
  if (result.status !== 0) fail(`${command}が終了コード${result.status}で停止しました。`);
}
function capture(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8", shell: false });
  if (result.error || result.status !== 0) fail(`${command}で情報を取得できません。`);
  return String(result.stdout || "").trim();
}
function arg(name) {
  const prefix = `--${name}=`;
  const hit = process.argv.slice(2).find((x) => x.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : null;
}
function assTime(seconds) {
  const n = Math.max(0, Number(seconds) || 0);
  const h = Math.floor(n / 3600); const m = Math.floor((n % 3600) / 60); const s = (n % 60).toFixed(2).padStart(5, "0");
  return `${h}:${String(m).padStart(2, "0")}:${s}`;
}
function assEscape(value) {
  return String(value ?? "").replaceAll("\\", "\\\\").replaceAll("{", "\\{").replaceAll("}", "\\}").replaceAll("\n", "\\N");
}
function safeName(value) { return String(value || "hatsune-news").replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, "-").slice(0, 70); }

async function fetchJson(url, secret, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (secret) headers.authorization = `Bearer ${secret}`;
  const response = await fetch(url, { ...options, headers });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || `HTTP ${response.status}: ${url}`);
  return payload;
}
async function download(url, target) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`画像取得失敗 HTTP ${response.status}: ${url}`);
  await writeFile(target, Buffer.from(await response.arrayBuffer()));
}
async function synthesize(text, wavPath, speakerId) {
  const endpoint = String(process.env.AIVIS_API_URL || "http://127.0.0.1:10101").replace(/\/$/, "");
  let queryResponse;
  try {
    queryResponse = await fetch(`${endpoint}/audio_query?text=${encodeURIComponent(text)}&speaker=${speakerId}`, { method: "POST" });
  } catch {
    throw new Error(`AivisSpeechへ接続できません。起動を確認してください (${endpoint})`);
  }
  if (!queryResponse.ok) throw new Error(`AivisSpeech audio_query失敗: HTTP ${queryResponse.status}`);
  const query = await queryResponse.json();
  query.speedScale = Number(process.env.HATSUNE_NEWS_SPEED || 1.05);
  query.intonationScale = Number(process.env.HATSUNE_NEWS_INTONATION || 1.03);
  const response = await fetch(`${endpoint}/synthesis?speaker=${speakerId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(query) });
  if (!response.ok) throw new Error(`AivisSpeech synthesis失敗: HTTP ${response.status}`);
  await writeFile(wavPath, Buffer.from(await response.arrayBuffer()));
}
function captionEvents(manifest, duration) {
  const captions = (Array.isArray(manifest.caption_json) ? manifest.caption_json : []).map((x) => String(x?.text || x || "").trim()).filter(Boolean);
  const items = captions.length ? captions : String(manifest.script || "").split(/[。！？\n]+/).map((x) => x.trim()).filter(Boolean);
  const weights = items.map((x) => Math.max(3, x.replace(/\s/g, "").length));
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  let cursor = 0;
  return items.map((text, i) => {
    const start = cursor;
    const slice = i === items.length - 1 ? duration - cursor : duration * (weights[i] / total);
    cursor += slice;
    return { text, start, end: Math.min(duration, cursor) };
  });
}
function makeAss(manifest, duration, font) {
  const end = assTime(duration);
  const sourceLine = (manifest.sources || []).slice(0, 3).map((x) => x.source_name || x.title).filter(Boolean).join(" / ") || "BoatStrikers 初音NEWS";
  const events = captionEvents(manifest, duration).map((x) => `Dialogue: 0,${assTime(x.start)},${assTime(x.end)},Caption,,0,0,0,,${assEscape(x.text)}`).join("\n");
  return `[Script Info]\nScriptType: v4.00+\nPlayResX: 1080\nPlayResY: 1920\nWrapStyle: 2\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Brand,${font},38,&H00FFFFFF,&H00FFFFFF,&H00622D75,&H00000000,1,0,0,0,100,100,2,0,1,3,1,8,45,45,55,1\nStyle: Program,${font},64,&H00FFFFFF,&H00FFFFFF,&H007A397F,&H00000000,1,0,0,0,100,100,0,0,1,4,1,8,55,55,135,1\nStyle: Headline,${font},50,&H002B2542,&H002B2542,&H00FFFFFF,&HDDFFFFFF,1,0,0,0,100,100,0,0,3,2,0,8,65,65,300,1\nStyle: Caption,${font},46,&H00FFFFFF,&H00FFFFFF,&H00301B3E,&HCC291332,1,0,0,0,100,100,0,0,3,2,0,2,65,65,150,1\nStyle: Source,${font},25,&H00FFFFFF,&H00FFFFFF,&H00301B3E,&HAA291332,0,0,0,0,100,100,0,0,3,1,0,2,45,45,30,1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\nDialogue: 0,0:00:00.00,${end},Brand,,0,0,0,,BoatStrikers × 初音\nDialogue: 0,0:00:00.00,${end},Program,,0,0,0,,${assEscape(manifest.visual?.program || "ヴィーナスNEWS")}\nDialogue: 0,0:00:00.40,${end},Headline,,0,0,0,,${assEscape(manifest.title)}\nDialogue: 0,0:00:00.00,${end},Source,,0,0,0,,出典：${assEscape(sourceLine)}\n${events}\n`;
}

async function main() {
  if (process.argv.includes("--check")) {
    run("ffmpeg", ["-version"]); run("ffprobe", ["-version"]);
    const endpoint = String(process.env.AIVIS_API_URL || "http://127.0.0.1:10101").replace(/\/$/, "");
    const response = await fetch(`${endpoint}/speakers`).catch(() => null);
    if (!response?.ok) fail(`AivisSpeechへ接続できません: ${endpoint}`);
    console.log("FFmpeg / ffprobe / AivisSpeech の接続OK"); return;
  }

  const id = Number(arg("id"));
  const manifestFile = arg("manifest");
  const baseUrl = String(arg("base-url") || process.env.HATSUNE_NEWS_BASE_URL || "https://www.boat-strike.online").replace(/\/$/, "");
  const secret = arg("secret") || process.env.HATSUNE_NEWS_ADMIN_SECRET || process.env.CRON_SECRET || "";
  let manifest;
  if (manifestFile) {
    manifest = JSON.parse(await readFile(path.resolve(manifestFile), "utf8"));
    manifest = manifest.manifest || manifest;
  } else {
    if (!Number.isFinite(id)) fail("使い方: npm run hatsune:render -- --id=123  または --manifest=manifest.json");
    if (!secret) fail("HATSUNE_NEWS_ADMIN_SECRET（または --secret=...）が必要です。");
    const payload = await fetchJson(`${baseUrl}/api/admin/hatsune-news/video/render-manifest?id=${id}`, secret);
    manifest = payload.manifest;
  }
  if (!manifest?.script) fail("読み上げ台本がありません。");

  const speaker = Number(arg("speaker") || process.env.HATSUNE_NEWS_SPEAKER_ID);
  if (!Number.isFinite(speaker)) fail("HATSUNE_NEWS_SPEAKER_ID または --speaker=<style id> を設定してください。");
  const outputDir = path.resolve(arg("out") || process.env.HATSUNE_NEWS_OUTPUT_DIR || "output/hatsune-news", String(manifest.id || "manual"));
  await mkdir(outputDir, { recursive: true });
  const wav = path.join(outputDir, "narration.wav");
  const ass = path.join(outputDir, "captions.ass");
  const mp4 = path.join(outputDir, `${safeName(manifest.visual?.program)}-${safeName(manifest.target_date || manifest.period_end || manifest.id)}.mp4`);
  await synthesize(manifest.script, wav, speaker);
  const duration = Number(capture("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", wav]));
  if (!Number.isFinite(duration)) fail("音声時間を取得できません。");
  await writeFile(ass, makeAss(manifest, duration, process.env.HATSUNE_NEWS_FONT || "Yu Gothic"), "utf8");

  let character = arg("image") || process.env.HATSUNE_NEWS_IMAGE || "";
  if (!character) {
    character = path.join(outputDir, "hatsune.png");
    const characterUrl = new URL(manifest.visual?.character_url || "/bsc/status-hatsune.png", baseUrl).toString();
    await download(characterUrl, character);
  } else character = path.resolve(character);
  if (!existsSync(character)) fail(`初音画像が見つかりません: ${character}`);

  const bgm = arg("bgm") || process.env.HATSUNE_NEWS_BGM || "";
  const se = arg("se") || process.env.HATSUNE_NEWS_SE || "";
  const args = ["-y", "-f", "lavfi", "-i", "color=c=0xF5EFFF:s=1080x1920:r=30", "-loop", "1", "-i", character, "-i", wav];
  let bgmIndex = -1, seIndex = -1;
  if (bgm) { bgmIndex = args.filter((x) => x === "-i").length; args.push("-stream_loop", "-1", "-i", path.resolve(bgm)); }
  if (se) { seIndex = args.filter((x) => x === "-i").length; args.push("-i", path.resolve(se)); }
  const videoFilter = "[1:v]scale=680:-1[char];[0:v][char]overlay=W-w+120:H-h+70,subtitles=captions.ass[video]";
  let audioFilter = ""; let audioMap = "2:a:0";
  if (bgmIndex >= 0 && seIndex >= 0) { audioFilter = `[${bgmIndex}:a]volume=0.10[bgm];[${seIndex}:a]volume=0.30[se];[2:a][bgm][se]amix=inputs=3:duration=first:dropout_transition=2[aout]`; audioMap = "[aout]"; }
  else if (bgmIndex >= 0) { audioFilter = `[${bgmIndex}:a]volume=0.10[bgm];[2:a][bgm]amix=inputs=2:duration=first:dropout_transition=2[aout]`; audioMap = "[aout]"; }
  else if (seIndex >= 0) { audioFilter = `[${seIndex}:a]volume=0.30[se];[2:a][se]amix=inputs=2:duration=first:dropout_transition=2[aout]`; audioMap = "[aout]"; }
  args.push("-filter_complex", audioFilter ? `${videoFilter};${audioFilter}` : videoFilter, "-map", "[video]", "-map", audioMap, "-t", String(duration), "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", mp4);
  run("ffmpeg", args, { cwd: outputDir });
  await writeFile(path.join(outputDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
  await writeFile(path.join(outputDir, "youtube.txt"), `${manifest.youtube_title || manifest.title}\n\n${manifest.youtube_description || ""}`, "utf8");
  await writeFile(path.join(outputDir, "x.txt"), `${manifest.x_text || ""}\n${(manifest.hashtags || []).map((x) => `#${x}`).join(" ")}`.trim(), "utf8");

  if (Number.isFinite(Number(manifest.id)) && secret && !manifestFile) {
    await fetchJson(`${baseUrl}/api/admin/hatsune-news/video/rendered`, secret, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: manifest.id, success: true, render_meta: { renderer_version: "hatsune-news-v1", duration_seconds: Number(duration.toFixed(2)), output_file: path.basename(mp4), rendered_on: process.platform } }) });
  }
  console.log(`完成: ${mp4}`);
}

main().catch(async (error) => fail(error?.message || String(error)));
