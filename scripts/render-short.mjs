import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

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

function assEscape(value) {
  return String(value ?? "").replaceAll("\\", "\\\\").replaceAll("{", "\\{").replaceAll("}", "\\}").replaceAll("\n", "\\N");
}

function assTime(seconds) {
  const value = Math.max(0, Number(seconds) || 0);
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const secs = (value % 60).toFixed(2).padStart(5, "0");
  return `${hours}:${String(minutes).padStart(2, "0")}:${secs}`;
}

function pct(value) {
  const n = Number(value);
  return Number.isFinite(n) ? `${Math.round(n * 100)}%` : "—";
}

function makeAss(plan, duration, font) {
  const ranking = plan.picks.slice(0, 3).map((row, index) => `${index + 1}位　${row.stadium} ${row.race_no}R　${pct(row.probability)}`).join("\n");
  const end = assTime(duration);
  return `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 2

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Brand,${font},42,&H00FFFFFF,&H00FFFFFF,&H00235B82,&H00000000,1,0,0,0,100,100,2,0,1,3,1,8,50,50,65,1
Style: Title,${font},72,&H003543DC,&H003543DC,&H00FFFFFF,&H00000000,1,0,0,0,100,100,0,0,1,5,1,8,50,50,160,1
Style: Ranking,${font},53,&H00243C55,&H00243C55,&H00FFFFFF,&HCCFFFFFF,1,0,0,0,100,100,0,0,3,2,0,8,75,75,430,1
Style: Caption,${font},42,&H00FFFFFF,&H00FFFFFF,&H00132D43,&H990F2E45,1,0,0,0,100,100,0,0,3,2,0,2,60,60,145,1
Style: Note,${font},27,&H00FFFFFF,&H00FFFFFF,&H00132D43,&H990F2E45,0,0,0,0,100,100,0,0,3,1,0,2,45,45,35,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:00.00,${end},Brand,,0,0,0,,BoatStrikers 公式ショート
Dialogue: 0,0:00:00.00,${end},Title,,0,0,0,,一果が選ぶ！\\N明日のイン逃げ期待度 TOP3
Dialogue: 0,0:00:00.70,${end},Ranking,,0,0,0,,${assEscape(ranking)}
Dialogue: 0,0:00:00.00,${end},Caption,,0,0,0,,VOICE：BoatStrikers公式ナレーター
Dialogue: 0,0:00:00.00,${end},Note,,0,0,0,,予想は参考情報です。舟券購入は無理のない範囲で。
`;
}

async function synthesize(plan, wavPath) {
  const tts = plan.tts || {};
  const endpoint = String(process.env.BS_TTS_ENDPOINT || tts.endpoint || "http://127.0.0.1:10101").replace(/\/$/, "");
  const rawSpeakerId = process.env.BS_TTS_SPEAKER_ID || tts.speakerId;
  const speakerId = Number(rawSpeakerId);
  if (rawSpeakerId === null || rawSpeakerId === undefined || rawSpeakerId === "" || !Number.isFinite(speakerId)) fail("スタイルIDが設定されていません。");
  console.log(`TTS: ${tts.engine || "compatible"} / speaker ${speakerId}`);

  let response;
  try {
    response = await fetch(`${endpoint}/audio_query?text=${encodeURIComponent(plan.narration)}&speaker=${speakerId}`, { method: "POST" });
  } catch {
    fail(`音声エンジンへ接続できません。起動を確認してください (${endpoint})`);
  }
  if (!response.ok) fail(`audio_queryに失敗しました: HTTP ${response.status}`);
  const query = await response.json();
  query.speedScale = Number(tts.speedScale || 1.08);
  query.intonationScale = Number(tts.intonationScale || 1.05);

  const synthesis = await fetch(`${endpoint}/synthesis?speaker=${speakerId}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(query),
  });
  if (!synthesis.ok) fail(`synthesisに失敗しました: HTTP ${synthesis.status}`);
  await writeFile(wavPath, Buffer.from(await synthesis.arrayBuffer()));
}

async function main() {
  const input = process.argv[2];
  if (!input || input === "--help") {
    console.log("使い方: npm run shorts:render -- <ichika-short-YYYY-MM-DD.json>");
    console.log("必要: AivisSpeech/VOICEVOX Engine、FFmpeg、ffprobe");
    process.exit(input ? 0 : 1);
  }
  if (input === "--check") {
    run("ffmpeg", ["-version"]);
    run("ffprobe", ["-version"]);
    console.log("FFmpegの準備は完了しています。");
    return;
  }

  const inputPath = path.resolve(input);
  if (!existsSync(inputPath)) fail(`制作データが見つかりません: ${inputPath}`);
  const plan = JSON.parse(await readFile(inputPath, "utf8"));
  if (!plan.narration || !Array.isArray(plan.picks) || plan.picks.length < 3) fail("制作データに原稿またはTOP3がありません。");

  const outputDir = path.resolve(process.env.BS_SHORTS_OUTPUT || "output/shorts", plan.date || "undated");
  await mkdir(outputDir, { recursive: true });
  const wavPath = path.join(outputDir, "narration.wav");
  const assPath = path.join(outputDir, "captions.ass");
  const mp4Path = path.join(outputDir, `ichika-top3-${plan.date || "short"}.mp4`);
  await synthesize(plan, wavPath);

  const duration = Number(capture("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", wavPath]));
  if (!Number.isFinite(duration)) fail("音声の長さを取得できません。");
  await writeFile(assPath, makeAss(plan, duration, process.env.BS_SHORTS_FONT || "Yu Gothic"), "utf8");

  const character = path.resolve(process.env.BS_SHORTS_CHARACTER || "public/admin-newspaper/ichika-previous.png");
  if (!existsSync(character)) fail(`一果の立ち絵が見つかりません: ${character}`);
  const filter = "[1:v]scale=760:-1[char];[0:v][char]overlay=W-w+210:H-h+45,subtitles=captions.ass[video]";
  run("ffmpeg", ["-y", "-f", "lavfi", "-i", "color=c=0xEAF8FF:s=1080x1920:r=30", "-loop", "1", "-i", character, "-i", wavPath, "-filter_complex", filter, "-map", "[video]", "-map", "2:a:0", "-t", String(duration), "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", mp4Path], { cwd: outputDir });
  await writeFile(path.join(outputDir, "post.txt"), String(plan.socialPost || ""), "utf8");
  console.log(`完成: ${mp4Path}`);
}

main().catch((error) => fail(error?.message || String(error)));
