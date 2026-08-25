import { copyFile, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";

function fail(message) { console.error(`ERROR: ${message}`); process.exit(1); }
function run(command, args, options = {}) { const result = spawnSync(command, args, { stdio: "inherit", shell: false, ...options }); if (result.error) fail(`${command}を実行できません: ${result.error.message}`); if (result.status !== 0) fail(`${command}が終了コード${result.status}で停止しました。`); }
function capture(command, args) { const result = spawnSync(command, args, { encoding: "utf8", shell: false }); if (result.error || result.status !== 0) fail(`${command}で情報を取得できません。`); return String(result.stdout || "").trim(); }
async function publishVideo(renderPath, mp4Path) { try { await rm(mp4Path, { force: true }); await rename(renderPath, mp4Path); } catch (error) { const code = error?.code ? ` (${error.code})` : ""; fail(`完成MP4を保存できません${code}。同名の動画を再生中の場合は、動画プレイヤーとエクスプローラーのプレビューを閉じて再生成してください。完成前の動画: ${renderPath}`); } }
function assEscape(value) { return String(value ?? "").replaceAll("\\", "\\\\").replaceAll("{", "\\{").replaceAll("}", "\\}").replaceAll("\n", " "); }
function assTime(seconds) { const value = Math.max(0, Number(seconds) || 0); const h = Math.floor(value / 3600); const m = Math.floor((value % 3600) / 60); const s = (value % 60).toFixed(2).padStart(5, "0"); return `${h}:${String(m).padStart(2, "0")}:${s}`; }
function fontSize(text) { const length = [...String(text)].length; if (length <= 18) return 49; if (length <= 24) return 41; return 34; }

function makeAss(plan, voiceDuration, font) {
  const mainStart = 3;
  const mainEnd = mainStart + voiceDuration;
  const bullets = plan.bullets.slice(0, 3);
  const y = [1405, 1530, 1655];
  const reveal = Math.max(1.2, voiceDuration / Math.max(3, bullets.length + 1));
  const events = bullets.map((text, index) => `Dialogue: ${index},${assTime(mainStart + .65 + reveal * index)},${assTime(mainEnd)},Bullet,,0,0,0,,{\\fad(180,120)\\pos(105,${y[index]})\\fs${fontSize(text)}}${assEscape(text)}`).join("\n");
  return `[Script Info]\nScriptType: v4.00+\nPlayResX: 1080\nPlayResY: 1920\nWrapStyle: 2\nScaledBorderAndShadow: yes\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Bullet,${font},46,&H00192C39,&H00192C39,&H00FFFFFF,&H55000000,1,0,0,0,100,100,.3,0,1,2,1,7,0,0,0,1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n${events}\n`;
}

async function synthesize(plan, wavPath) {
  if (process.env.BS_TTS_WAV) { await copyFile(path.resolve(process.env.BS_TTS_WAV), wavPath); return; }
  const tts = plan.tts || {}; const endpoint = String(tts.endpoint || "http://127.0.0.1:10101").replace(/\/$/, ""); const speaker = Number(tts.speakerId);
  if (!Number.isFinite(speaker)) fail("スタイルIDが設定されていません。");
  console.log(`TTS: ${tts.engine || "aivis"} / speaker ${speaker}`);
  let response; try { response = await fetch(`${endpoint}/audio_query?text=${encodeURIComponent(plan.narration)}&speaker=${speaker}`, { method: "POST" }); } catch { fail(`音声エンジンへ接続できません (${endpoint})`); }
  if (!response.ok) fail(`audio_queryに失敗しました: HTTP ${response.status}`);
  const query = await response.json(); query.speedScale = Number(tts.speedScale || 1.08); query.intonationScale = Number(tts.intonationScale || 1.05);
  const audio = await fetch(`${endpoint}/synthesis?speaker=${speaker}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(query) });
  if (!audio.ok) fail(`synthesisに失敗しました: HTTP ${audio.status}`);
  await writeFile(wavPath, Buffer.from(await audio.arrayBuffer()));
}

async function main() {
  const input = process.argv[2]; if (!input) fail("制作データJSONを指定してください。");
  const plan = JSON.parse(await readFile(path.resolve(input), "utf8"));
  if (plan.type !== "boatstrikers_news" || !plan.narration || !plan.bullets?.length) fail("ニュース制作データが不足しています。");
  const templateDir = path.resolve("public/news/templates");
  const characterImage = { ichika: "ichika.jpg", hatsune: "hatsune.jpg", kiina: "kiina.jpg" }[plan.character];
  const images = [path.join(templateDir, "opening.jpg"), path.join(templateDir, characterImage || "ichika.jpg"), path.join(templateDir, "ending.jpg")];
  for (const image of images) if (!existsSync(image)) fail(`テンプレート画像が見つかりません: ${image}`);
  const outputDir = path.resolve("output/news", plan.date || "undated"); await mkdir(outputDir, { recursive: true });
  const wavPath = path.join(outputDir, "narration.wav"); const assPath = path.join(outputDir, "captions.ass"); const mp4Path = path.join(outputDir, `boatstrikers-news-${plan.character}-${plan.date}.mp4`); const renderPath = path.join(outputDir, `.boatstrikers-news-${plan.character}-${plan.date}-${process.pid}.rendering.mp4`);
  await synthesize(plan, wavPath);
  const voiceDuration = Number(capture("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", wavPath]));
  if (!Number.isFinite(voiceDuration)) fail("音声の長さを取得できません。");
  await writeFile(assPath, makeAss(plan, voiceDuration, process.env.BS_SHORTS_FONT || "Yu Gothic UI"), "utf8");
  const total = voiceDuration + 7;
  const inputs = images.flatMap((image) => ["-loop", "1", "-i", image]);
  const filter = `[0:v]scale=1080:1920,crop=1080:1920,fps=30,trim=duration=3,setpts=PTS-STARTPTS[v0];[1:v]scale=1080:1920,crop=1080:1920,fps=30,trim=duration=${voiceDuration},setpts=PTS-STARTPTS[v1];[2:v]scale=1080:1920,crop=1080:1920,fps=30,trim=duration=4,setpts=PTS-STARTPTS[v2];[v0][v1][v2]concat=n=3:v=1:a=0,subtitles=captions.ass[video];[3:a]adelay=3000|3000,apad=pad_dur=4[audio]`;
  run("ffmpeg", ["-y", ...inputs, "-i", wavPath, "-filter_complex", filter, "-map", "[video]", "-map", "[audio]", "-t", String(total), "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-pix_fmt", "yuv420p", "-c:a", "aac", "-ar", "48000", "-ac", "2", "-b:a", "192k", "-movflags", "+faststart", renderPath], { cwd: outputDir });
  await publishVideo(renderPath, mp4Path);
  console.log(`完成: ${mp4Path}`);
}

main().catch((error) => fail(error?.message || String(error)));
