import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
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

function shortReason(row) {
  const racer = row.racer || {};
  const courseRate = Number(racer.course1_2_rate);
  const motorRate = Number(racer.motor_2_rate);
  const st = Number(racer.course1_average_st ?? racer.average_st);
  if (Number.isFinite(courseRate) && courseRate >= 60) return `1コース2連対率 ${courseRate.toFixed(1)}%`;
  if (Number.isFinite(motorRate) && motorRate >= 35) return `モーター2連対率 ${motorRate.toFixed(1)}%`;
  if (Number.isFinite(st)) return `平均ST ${st.toFixed(2)}`;
  return "AI v2 イン逃げ評価上位";
}

function captionEvents(narration, duration) {
  const parts = String(narration || "").split(/\n+/).map((value) => value.trim()).filter(Boolean);
  if (!parts.length) return "";
  const weights = parts.map((value) => Math.max(10, value.replace(/\s/g, "").length));
  const total = weights.reduce((sum, value) => sum + value, 0);
  let cursor = 0;
  return parts.map((value, index) => {
    const end = index === parts.length - 1 ? duration : cursor + duration * weights[index] / total;
    const event = `Dialogue: 5,${assTime(cursor)},${assTime(end)},Caption,,0,0,0,,{\\fad(120,120)}${assEscape(value)}`;
    cursor = end;
    return event;
  }).join("\n");
}

function makeAss(plan, duration, font) {
  const end = assTime(duration);
  const introEnd = Math.min(4.5, duration * 0.12);
  const outroLength = Math.min(4, duration * 0.1);
  const sceneEnd = duration - outroLength;
  const sceneLength = Math.max(1, (sceneEnd - introEnd) / 3);
  const scenes = [...plan.picks.slice(0, 3)].reverse().map((row, index) => {
    const rank = 3 - index;
    const start = introEnd + sceneLength * index;
    const finish = index === 2 ? sceneEnd : start + sceneLength;
    const racerName = String(row.racer?.racer_name || "注目レーサー").replace(/[\s　]+/g, "");
    return [
      `Dialogue: 2,${assTime(start)},${assTime(finish)},Rank,,0,0,0,,{\\fad(250,250)}第${rank}位`,
      `Dialogue: 2,${assTime(start)},${assTime(finish)},Place,,0,0,0,,{\\fad(300,250)}${assEscape(row.stadium)}  ${row.race_no}R`,
      `Dialogue: 2,${assTime(start)},${assTime(finish)},Racer,,0,0,0,,{\\fad(350,250)}1号艇  ${assEscape(racerName)}選手`,
      `Dialogue: 2,${assTime(start)},${assTime(finish)},Probability,,0,0,0,,{\\fad(400,250)}期待度  ${pct(row.probability)}`,
      `Dialogue: 2,${assTime(start)},${assTime(finish)},Reason,,0,0,0,,{\\fad(450,250)}POINT  ${assEscape(shortReason(row))}`,
    ].join("\n");
  }).join("\n");
  return `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Brand,${font},38,&H00FFFFFF,&H00FFFFFF,&H004325BA,&H00000000,1,0,0,0,100,100,2,0,1,3,1,8,50,50,55,1
Style: Header,${font},56,&H002D4054,&H002D4054,&H00FFFFFF,&H00000000,1,0,0,0,100,100,0,0,1,4,1,8,45,45,125,1
Style: Intro,${font},86,&H003E48EC,&H003E48EC,&H00FFFFFF,&H00000000,1,0,0,0,100,100,0,0,1,6,2,5,50,50,0,1
Style: IntroSub,${font},45,&H00FFFFFF,&H00FFFFFF,&H006041C4,&HDD6041C4,1,0,0,0,100,100,1,0,3,2,0,5,140,140,0,1
Style: Rank,${font},48,&H00FFFFFF,&H00FFFFFF,&H00472BD9,&HE6472BD9,1,0,0,0,100,100,1,0,3,2,0,7,80,0,475,1
Style: Place,${font},80,&H00253A50,&H00253A50,&H00FFFFFF,&H00000000,1,0,0,0,100,100,0,0,1,4,1,7,80,0,575,1
Style: Racer,${font},51,&H00384C60,&H00384C60,&H00FFFFFF,&H00000000,1,0,0,0,100,100,0,0,1,3,0,7,80,0,690,1
Style: Probability,${font},68,&H003E48EC,&H003E48EC,&H00FFFFFF,&H00000000,1,0,0,0,100,100,0,0,1,4,1,7,80,0,790,1
Style: Reason,${font},36,&H006041C4,&H006041C4,&H00FFFFFF,&HDCFDF3FF,1,0,0,0,100,100,0,0,3,2,0,7,80,380,915,1
Style: Caption,${font},39,&H00FFFFFF,&H00FFFFFF,&H00273A4C,&HE6273A4C,1,0,0,0,100,100,0,0,3,2,0,2,55,55,150,1
Style: Note,${font},25,&H00FFFFFF,&H00FFFFFF,&H004325BA,&HE64325BA,0,0,0,0,100,100,0,0,3,1,0,2,45,45,35,1
Style: Outro,${font},54,&H00FFFFFF,&H00FFFFFF,&H00472BD9,&HE6472BD9,1,0,0,0,100,100,0,0,3,2,0,5,100,100,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 1,0:00:00.00,${end},Brand,,0,0,0,,BoatStrikers  SHORTS
Dialogue: 1,0:00:00.00,${end},Header,,0,0,0,,一果のイン逃げ予想  |  明日版
Dialogue: 2,0:00:00.00,${assTime(introEnd)},Intro,,0,0,0,,{\\fad(250,300)}イン逃げ期待度\\NTOP 3
Dialogue: 2,0:00:00.60,${assTime(introEnd)},IntroSub,,0,0,0,,{\\fad(300,300)}AI v2 が選んだ注目レース
${scenes}
Dialogue: 3,${assTime(sceneEnd)},${end},Outro,,0,0,0,,{\\fad(250,300)}最新情報を確認して\\N無理なく楽しもう！
${captionEvents(plan.narration, duration)}
Dialogue: 0,0:00:00.00,${end},Note,,0,0,0,,予想は参考情報です。舟券購入は無理のない範囲で。
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
  await synthesize(plan, wavPath);

  const duration = Number(capture("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", wavPath]));
  if (!Number.isFinite(duration)) fail("音声の長さを取得できません。");
  await writeFile(assPath, makeAss(plan, duration, process.env.BS_SHORTS_FONT || "Yu Gothic"), "utf8");

  const character = path.resolve(process.env.BS_SHORTS_CHARACTER || "public/bsc/characters/ichika/名称未設定のデザイン (61).png");
  if (!existsSync(character)) fail(`一果の立ち絵が見つかりません: ${character}`);
  const filter = "[0:v]drawbox=x=0:y=0:w=1080:h=28:color=0xEA4D78:t=fill,drawbox=x=45:y=340:w=990:h=760:color=white@0.92:t=fill,drawbox=x=45:y=340:w=12:h=760:color=0xEA4D78:t=fill,drawbox=x=0:y=1690:w=1080:h=230:color=0x223C52@0.98:t=fill[bg];[1:v]scale=500:-1[char];[bg][char]overlay=W-w-20:H-h-205,subtitles=captions.ass[video]";
  run("ffmpeg", ["-y", "-f", "lavfi", "-i", "color=c=0xEAF8FF:s=1080x1920:r=30", "-loop", "1", "-i", character, "-i", wavPath, "-filter_complex", filter, "-map", "[video]", "-map", "2:a:0", "-t", String(duration), "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", mp4Path], { cwd: outputDir });
  await writeFile(path.join(outputDir, "post.txt"), String(plan.socialPost || ""), "utf8");
  console.log(`完成: ${mp4Path}`);
}

main().catch((error) => fail(error?.message || String(error)));
