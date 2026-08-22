"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import styles from "./shorts.module.css";
import localStyles from "./localCompanion.module.css";

const LOCAL_COMPANION = "http://127.0.0.1:3210";

function cleanName(value) {
  return String(value || "").replace(/[\s　]+/g, "");
}

function percent(value) {
  const n = Number(value);
  return Number.isFinite(n) ? `${Math.round(n * 100)}%` : "—";
}

function metric(value, suffix = "") {
  const n = Number(value);
  return Number.isFinite(n) ? `${n.toFixed(2)}${suffix}` : null;
}

function reason(row) {
  const racer = row.racer || {};
  const courseRate = Number(racer.course1_2_rate);
  const motorRate = Number(racer.motor_2_rate);
  const st = Number(racer.course1_average_st ?? racer.average_st);
  if (Number.isFinite(courseRate) && courseRate >= 60) return `1コース2連対率${courseRate.toFixed(1)}パーセントを高く評価`;
  if (Number.isFinite(motorRate) && motorRate >= 35) return `モーター2連対率${motorRate.toFixed(1)}パーセントが好材料`;
  if (Number.isFinite(st) && st <= 0.16) return `平均スタートタイミング${st.toFixed(2)}のスタート力に注目`;
  return "AI v2のイン逃げ評価が上位";
}

function defaultScript(date, picks) {
  const lines = ["BoatStrikers、一果が選ぶ！明日のイン逃げ期待度トップ3！"];
  [...picks].reverse().forEach((row, index) => {
    const rank = 3 - index;
    const name = row.racer?.racer_name ? `、1号艇${cleanName(row.racer.racer_name)}選手` : "";
    lines.push(`第${rank}位は、${row.stadium}${row.race_no}レース${name}。イン逃げ期待度${percent(row.probability).replace("%", "パーセント")}。${reason(row)}です。`);
  });
  lines.push("予想は参考情報です。最新の出走情報を確認して、無理のない範囲でお楽しみください。");
  return lines.join("\n");
}

function defaultPost(date, picks) {
  const list = picks.map((row, i) => `${i + 1}位 ${row.stadium}${row.race_no}R ${percent(row.probability)}`).join("\n");
  return `【一果のイン逃げ予想TOP3｜${date}】\n${list}\n\n詳しい根拠は動画でチェック！\n※予想は参考情報です。舟券購入は無理のない範囲で。\n#ボートレース #BoatStrikers #競艇予想`;
}

export default function ShortsEditor({ date, candidates }) {
  const initial = candidates.slice(0, 3).map((_, index) => index);
  const [selected, setSelected] = useState(initial);
  const picks = selected.map((index) => candidates[index]).filter(Boolean);
  const generatedScript = useMemo(() => defaultScript(date, picks), [date, selected, candidates]);
  const generatedPost = useMemo(() => defaultPost(date, picks), [date, selected, candidates]);
  const [scriptOverride, setScriptOverride] = useState("");
  const [postOverride, setPostOverride] = useState("");
  const [engine, setEngine] = useState("aivis");
  const [speakerId, setSpeakerId] = useState("888753763");
  const [health, setHealth] = useState(null);
  const [checking, setChecking] = useState(true);
  const [localError, setLocalError] = useState("");
  const [job, setJob] = useState(null);
  const [audioUrl, setAudioUrl] = useState("");
  const pollRef = useRef(null);
  const script = scriptOverride || generatedScript;
  const post = postOverride || generatedPost;
  const seconds = Math.max(1, Math.round(script.replace(/\s/g, "").length / 6.2));

  useEffect(() => {
    checkLocal();
    return () => {
      if (pollRef.current) clearTimeout(pollRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
    // 初回だけローカル接続を確認する
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function changePick(position, value) {
    setSelected((current) => current.map((item, index) => index === position ? Number(value) : item));
    setScriptOverride("");
    setPostOverride("");
  }

  async function copy(text) {
    await navigator.clipboard.writeText(text);
  }

  function buildPlan() {
    return {
      version: 2, date, format: "youtube_short_9x16", voice: "boatstrikers_narrator",
      tts: {
        engine,
        modelName: "まお",
        styleName: speakerId === "888753763" ? "おちつき" : "カスタム",
        speakerId: speakerId === "" ? null : Number(speakerId),
        endpoint: engine === "aivis" ? "http://127.0.0.1:10101" : "http://127.0.0.1:50021",
        speedScale: 1.08,
        intonationScale: 1.05,
      },
      character: "ichika",
      picks: picks.map((row) => ({ ...row, racer: row.racer ? { ...row.racer, racer_name: cleanName(row.racer.racer_name) } : row.racer })),
      narration: script,
      socialPost: post,
    };
  }

  function downloadPlan() {
    const payload = buildPlan();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `ichika-short-${date}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function localFetch(path, options = {}) {
    const response = await fetch(`${LOCAL_COMPANION}${path}`, { ...options, signal: AbortSignal.timeout(options.timeout || 10000) });
    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      throw new Error(detail.error || `ローカル動画メーカーでエラーが発生しました（HTTP ${response.status}）。`);
    }
    return response;
  }

  async function checkLocal() {
    setChecking(true);
    setLocalError("");
    try {
      const response = await localFetch("/health", { timeout: 4000 });
      setHealth(await response.json());
    } catch {
      setHealth(null);
    } finally {
      setChecking(false);
    }
  }

  async function previewVoice() {
    setLocalError("");
    try {
      const response = await localFetch("/preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(buildPlan()), timeout: 120000 });
      const nextUrl = URL.createObjectURL(await response.blob());
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      setAudioUrl(nextUrl);
    } catch (error) {
      setLocalError(error.message);
    }
  }

  async function pollJob(id) {
    try {
      const response = await localFetch(`/jobs/${id}`, { timeout: 5000 });
      const next = await response.json();
      setJob(next);
      if (next.status === "queued" || next.status === "running") pollRef.current = setTimeout(() => pollJob(id), 1200);
      if (next.status === "error") setLocalError(next.message);
    } catch (error) {
      setLocalError(error.message);
    }
  }

  async function renderVideo() {
    setLocalError("");
    setJob({ status: "queued", progress: 2, message: "生成リクエストを送信中" });
    try {
      const response = await localFetch("/jobs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(buildPlan()), timeout: 10000 });
      const next = await response.json();
      setJob(next);
      pollJob(next.id);
    } catch (error) {
      setJob(null);
      setLocalError(error.message);
    }
  }

  async function openOutput() {
    try {
      await localFetch(`/jobs/${job.id}/open`, { method: "POST", timeout: 5000 });
    } catch (error) {
      setLocalError(error.message);
    }
  }

  return (
    <>
      <section className={styles.workflow}>
        <div className={`${styles.step} ${styles.active}`}><b>1</b><span>TOP3・台本</span></div>
        <div className={styles.line} />
        <div className={styles.step}><b>2</b><span>ナレーター音声</span></div>
        <div className={styles.line} />
        <div className={styles.step}><b>3</b><span>9:16動画</span></div>
        <div className={styles.line} />
        <div className={styles.step}><b>4</b><span>確認・投稿</span></div>
      </section>

      <div className={styles.workspace}>
        <section className={styles.editorPanel}>
          <div className={styles.sectionTitle}><div><span>STEP 1</span><h2>使用する3レース</h2></div><em>候補{candidates.length}件</em></div>
          <div className={styles.picks}>
            {selected.map((candidateIndex, position) => {
              const row = candidates[candidateIndex];
              return (
                <article className={styles.pickCard} key={position}>
                  <div className={styles.medal}>{position + 1}</div>
                  <select value={candidateIndex} onChange={(event) => changePick(position, event.target.value)}>
                    {candidates.map((candidate, index) => <option value={index} key={`${candidate.course_code}-${candidate.race_no}`}>候補#{candidate.rank_no} {candidate.stadium} {candidate.race_no}R</option>)}
                  </select>
                  <div className={styles.pickMain}><strong>{row.stadium} {row.race_no}R</strong><b>{percent(row.probability)}</b></div>
                  <p>1号艇 {row.racer?.racer_name || "選手名未取得"} {row.racer?.racer_class || ""}</p>
                  <small>{reason(row)}</small>
                  <div className={styles.stats}>
                    {metric(row.racer?.course1_2_rate, "%") && <span>1コース2連対 {metric(row.racer.course1_2_rate, "%")}</span>}
                    {metric(row.racer?.motor_2_rate, "%") && <span>モーター2連対 {metric(row.racer.motor_2_rate, "%")}</span>}
                    {metric(row.racer?.course1_average_st) && <span>1コースST {metric(row.racer.course1_average_st)}</span>}
                  </div>
                </article>
              );
            })}
          </div>

          <div className={styles.textSection}>
            <div className={styles.textHeading}><div><span>STEP 2</span><h2>公式ナレーター原稿</h2></div><button type="button" onClick={() => copy(script)}>コピー</button></div>
            <textarea value={script} onChange={(event) => setScriptOverride(event.target.value)} rows={10} />
            <div className={styles.textMeta}><span>推定 {seconds}秒</span><span>{script.replace(/\s/g, "").length}文字</span><button type="button" onClick={() => setScriptOverride("")}>自動原稿に戻す</button></div>
          </div>

          <div className={styles.textSection}>
            <div className={styles.textHeading}><div><span>SNS</span><h2>投稿文</h2></div><button type="button" onClick={() => copy(post)}>コピー</button></div>
            <textarea value={post} onChange={(event) => setPostOverride(event.target.value)} rows={8} />
          </div>

          <div className={styles.textSection}>
            <div className={styles.textHeading}><div><span>VOICE</span><h2>公式ナレーター設定</h2></div></div>
            <div className={styles.voiceSettings}>
              <label><span>音声エンジン</span><select value={engine} onChange={(event) => setEngine(event.target.value)}><option value="aivis">AivisSpeech</option><option value="voicevox">VOICEVOX</option></select></label>
              <label><span>スタイルID（まお／おちつき）</span><input type="number" min="0" placeholder="声を選んで入力" value={speakerId} onChange={(event) => setSpeakerId(event.target.value)} /></label>
            </div>
            <p className={styles.localNote}>音声とMP4は、音声エンジンを起動したWindowsパソコンで生成します。制作データにはこの設定が保存されます。</p>
          </div>

          <section className={localStyles.panel}>
            <div className={localStyles.heading}><h2>このパソコンで音声・MP4を生成</h2><button type="button" onClick={checkLocal} disabled={checking}>{checking ? "確認中…" : "接続を再確認"}</button></div>
            <div className={localStyles.badges}>
              <span className={`${localStyles.badge} ${health ? localStyles.ok : localStyles.ng}`}>● ローカル動画メーカー {health ? "接続済み" : "未接続"}</span>
              <span className={`${localStyles.badge} ${health?.aivis?.ok ? localStyles.ok : localStyles.ng}`}>● AivisSpeech {health?.aivis?.ok ? "接続済み" : "未接続"}</span>
              <span className={`${localStyles.badge} ${health?.ffmpeg?.ok ? localStyles.ok : localStyles.ng}`}>● FFmpeg {health?.ffmpeg?.ok ? "準備完了" : "未確認"}</span>
            </div>
            {!health && <p className={localStyles.help}>AivisSpeechを起動してから、プロジェクト内の「start-shorts-maker.bat」をダブルクリックしてください。ブラウザにローカルネットワークの許可が表示された場合は「許可」を選びます。</p>}
            {health && !health.aivis?.ok && <p className={localStyles.help}>ローカル動画メーカーには接続できました。AivisSpeechを起動してから再確認してください。</p>}
            {health && !health.ffmpeg?.ok && <p className={localStyles.help}>FFmpegまたはffprobeが見つかりません。FFmpegをインストールして、起動用バッチを開き直してください。</p>}
            <div className={localStyles.buttons}>
              <button type="button" className={localStyles.secondary} onClick={previewVoice} disabled={!health?.aivis?.ok || job?.status === "running"}>公式ナレーターを試聴</button>
              <button type="button" className={localStyles.primary} onClick={renderVideo} disabled={!health?.aivis?.ok || !health?.ffmpeg?.ok || job?.status === "running" || job?.status === "queued"}>このPCでMP4を生成</button>
              {job?.status === "complete" && <button type="button" className={localStyles.secondary} onClick={openOutput}>保存フォルダを開く</button>}
            </div>
            {audioUrl && <audio className={localStyles.audio} src={audioUrl} controls autoPlay />}
            {job && <div className={localStyles.progress}><div className={localStyles.progressTrack}><span style={{ width: `${job.progress || 0}%` }} /></div><p>{job.message}</p></div>}
            {job?.status === "complete" && <div className={localStyles.output}>完成ファイル：{job.outputPath}</div>}
            {localError && <p className={localStyles.error}>{localError}</p>}
          </section>

          <div className={styles.actions}>
            <button type="button" className={styles.download} onClick={downloadPlan}>音声・動画用データを保存</button>
          </div>
        </section>

        <aside className={styles.previewPanel}>
          <div className={styles.sectionTitle}><div><span>PREVIEW</span><h2>9:16構成</h2></div></div>
          <div className={styles.phone}>
            <div className={styles.previewBrand}>BoatStrikers</div>
            <div className={styles.previewTitle}>一果が選ぶ！<br /><strong>明日のイン逃げ<br />期待度TOP3</strong></div>
            <div className={styles.previewRanking}>
              {picks.map((row, index) => <div key={index}><b>{index + 1}</b><span>{row.stadium} {row.race_no}R</span><strong>{percent(row.probability)}</strong></div>)}
            </div>
            <Image src="/admin-newspaper/ichika-previous.png" alt="一果" width={420} height={600} className={styles.ichika} />
            <div className={styles.narrator}>VOICE：BoatStrikers公式ナレーター</div>
          </div>
          <div className={styles.voiceCard}><span>🎙️</span><div><strong>音声プロファイル</strong><p>公式ナレーター／{engine === "aivis" ? "まお・おちつき" : "VOICEVOX"}</p></div><em>{speakerId ? `ID ${speakerId}` : "未選択"}</em></div>
        </aside>
      </div>
    </>
  );
}
