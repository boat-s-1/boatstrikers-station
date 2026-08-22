import { copyFile, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
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

async function publishVideo(renderPath, mp4Path) {
  try {
    await rm(mp4Path, { force: true });
    await rename(renderPath, mp4Path);
  } catch (error) {
    const code = error?.code ? ` (${error.code})` : "";
    fail(`完成MP4を保存できません${code}。同名の動画を再生中の場合は、動画プレイヤーとエクスプローラーのプレビューを閉じて再生成してください。完成前の動画: ${renderPath}`);
  }
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

function numeric(...values) {
  for (const value of values) {
    if (value === null || value === undefined || value === "") continue;
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return null;
}

function pct(value) {
  const n = numeric(value);
  return n === null ? "—" : `${Math.round(n * 100)}%`;
}

function displayStadium(value) {
  return String(value || "会場未定")
    .replace(/^ボートレース/u, "")
    .replace(/^BOAT\s*RACE\s*/iu, "")
    .replace(/[\s　]+/gu, "");
}

function shortReason(row) {
  const racer = row.racer || {};
  const courseRate = numeric(racer.course1_top2_rate, racer.course1_2_rate);
  const motorRate = numeric(racer.motor_top2_rate, racer.motor_2_rate);
  const st = numeric(racer.course1_average_st, racer.average_st);
  if (Number.isFinite(courseRate) && courseRate >= 60) return `1コース2連対率 ${courseRate.toFixed(1)}%`;
  if (Number.isFinite(motorRate) && motorRate >= 35) return `モーター2連対率 ${motorRate.toFixed(1)}%`;
  if (Number.isFinite(st)) return `平均ST ${st.toFixed(2)}`;
  return "AI v2 イン逃げ評価上位";
}

function reasonLines(row) {
  const racer = row.racer || {};
  const values = [];
  const courseRate = numeric(racer.course1_top2_rate, racer.course1_2_rate);
  const motorRate = numeric(racer.motor_top2_rate, racer.motor_2_rate);
  const st = numeric(racer.course1_average_st, racer.average_st);
  if (Number.isFinite(st)) values.push(`平均ST ${st.toFixed(2)}`);
  if (Number.isFinite(courseRate)) values.push(`1コース2連対率 ${courseRate.toFixed(1)}%`);
  if (Number.isFinite(motorRate)) values.push(`モーター2連対率 ${motorRate.toFixed(1)}%`);
  if (!values.length) values.push(shortReason(row));
  return values.slice(0, 2);
}

function makeAss(plan, duration, font) {
  const end = assTime(duration);
  const introEnd = Math.min(4.5, duration * 0.12);
  const outroLength = Math.min(4, duration * 0.1);
  const sceneEnd = duration - outroLength;
  const sceneLength = Math.max(1, (sceneEnd - introEnd) / 3);
  const scenes = [...plan.picks.slice(0, 3)].reverse().map((row, index) => {
    const start = introEnd + sceneLength * index;
    const finish = index === 2 ? sceneEnd : start + sceneLength;
    const racer = row.racer || {};
    const courseRate = numeric(racer.course1_top2_rate, racer.course1_2_rate);
    const probability = pct(row.probability);
    const courseRateText = courseRate === null ? "—" : `${courseRate.toFixed(1)}%`;
    return [
      `Dialogue: 0,${assTime(start)},${assTime(finish)},AccentLine,,0,0,0,,{\\fad(180,180)\\pos(170,785)\\p1}m 0 0 l 740 0 740 10 0 10{\\p0}`,
      `Dialogue: 0,${assTime(start)},${assTime(finish)},AccentLine,,0,0,0,,{\\fad(180,180)\\pos(170,935)\\p1}m 0 0 l 740 0 740 10 0 10{\\p0}`,
      `Dialogue: 2,${assTime(start)},${assTime(finish)},Place,,0,0,0,,{\\fad(180,180)}${assEscape(displayStadium(row.stadium))} ${row.race_no}R`,
      `Dialogue: 2,${assTime(start + 0.22)},${assTime(finish)},MetricLabel,,0,0,0,,{\\fad(180,180)\\pos(115,815)}イン逃げ期待度`,
      `Dialogue: 3,${assTime(start + 0.38)},${assTime(finish)},MetricValue,,0,0,0,,{\\fad(220,180)\\pos(770,795)}${probability}`,
      `Dialogue: 2,${assTime(start + 0.54)},${assTime(finish)},MetricLabel,,0,0,0,,{\\fad(180,180)\\pos(115,965)}1コース2連率`,
      `Dialogue: 3,${assTime(start + 0.70)},${assTime(finish)},MetricValue,,0,0,0,,{\\fad(220,180)\\pos(770,945)}${courseRateText}`,
    ].join("\\n");
  }).join("\\n");
  return `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Place,${font},82,&H00163F22,&H00163F22,&H00FFFFFF,&H00000000,1,0,0,0,100,100,1,0,1,4,1,8,150,150,680,1
Style: MetricLabel,${font},58,&H00102F1A,&H00102F1A,&H00FFFFFF,&H00000000,1,0,0,0,100,100,0,0,1,2,0,7,0,0,0,1
Style: MetricValue,${font},94,&H002323C8,&H002323C8,&H00FFFFFF,&H00000000,1,0,0,0,100,100,0,0,1,4,1,8,0,0,0,1
Style: AccentLine,${font},20,&H0000D8FF,&H0000D8FF,&H0000D8FF,&H00000000,0,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${scenes}
`;
}

async function synthesize(plan, wavPath) {
  if (process.env.BS_TTS_WAV) {
    await copyFile(path.resolve(process.env.BS_TTS_WAV), wavPath);
    return;
  }
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
  const renderPath = path.join(outputDir, `.ichika-top3-${plan.date || "short"}-${process.pid}.rendering.mp4`);
  await synthesize(plan, wavPath);

  const duration = Number(capture("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", wavPath]));
  if (!Number.isFinite(duration)) fail("音声の長さを取得できません。");
  await writeFile(assPath, makeAss(plan, duration, process.env.BS_SHORTS_FONT || "Yu Gothic UI"), "utf8");

  const templateDir = path.resolve(process.env.BS_SHORTS_TEMPLATES || "public/shorts/templates");
  const templateSlots = [
    ["intro", "intro.jpg"],
    ["rank3", "rank-3.jpg"],
    ["rank2", "rank-2.jpg"],
    ["rank1", "rank-1.jpg"],
    ["outro", "outro.jpg"],
  ];
  const templates = templateSlots.map(([slot, fallback]) => plan.assetPaths?.[slot] ? path.resolve(plan.assetPaths[slot]) : path.join(templateDir, fallback));
  for (const template of templates) if (!existsSync(template)) fail(`動画テンプレートが見つかりません: ${template}`);
  const introEnd = Math.min(4.5, duration * 0.12);
  const outroLength = Math.min(4, duration * 0.1);
  const sceneLength = Math.max(1, (duration - introEnd - outroLength) / 3);
  const lengths = [introEnd, sceneLength, sceneLength, sceneLength, outroLength];
  const imageInputs = templates.flatMap((template) => ["-loop", "1", "-i", template]);
  const pieces = lengths.map((length, index) => `[${index}:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,trim=duration=${length},setpts=PTS-STARTPTS[v${index}]`).join(";");
  const filter = `${pieces};[v0][v1][v2][v3][v4]concat=n=5:v=1:a=0,subtitles=captions.ass[video]`;
  run("ffmpeg", ["-y", ...imageInputs, "-i", wavPath, "-filter_complex", filter, "-map", "[video]", "-map", "5:a:0", "-t", String(duration), "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-pix_fmt", "yuv420p", "-c:a", "aac", "-ar", "48000", "-ac", "2", "-b:a", "192k", "-movflags", "+faststart", renderPath], { cwd: outputDir });
  await publishVideo(renderPath, mp4Path);
  await writeFile(path.join(outputDir, "post.txt"), String(plan.socialPost || ""), "utf8");
  console.log(`完成: ${mp4Path}`);
}

main().catch((error) => fail(error?.message || String(error)));
