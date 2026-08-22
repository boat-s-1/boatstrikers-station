"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./news.module.css";

const LOCAL = "http://127.0.0.1:3210";
const CASTERS = [
  { key: "ichika", name: "一果", label: "注目レース", image: "/news/templates/ichika.jpg", color: "green" },
  { key: "hatsune", name: "初音", label: "女子戦NEWS", image: "/news/templates/hatsune.jpg", color: "pink" },
  { key: "kiina", name: "キイナ", label: "穴レース", image: "/news/templates/kiina.jpg", color: "gold" },
];

function narrationFor(caster, bullets) {
  const valid = bullets.map((v) => v.trim()).filter(Boolean);
  if (!valid.length) return "";
  const joins = valid.map((text, index) => `${index === 0 ? "最初" : index === valid.length - 1 ? "最後" : "続いて"}のニュースです。${text}。`).join("\n");
  return `深夜のBoatStrikersニュース。${caster.name}がお送りします。\n${joins}\n詳しい出走表や直前情報は、BoatStrikersでチェックしてください。`;
}

export default function NewsEditor({ initialDate }) {
  const [date, setDate] = useState(initialDate);
  const [character, setCharacter] = useState("ichika");
  const [bullets, setBullets] = useState(["", "", ""]);
  const [narrationOverride, setNarrationOverride] = useState("");
  const [health, setHealth] = useState(null);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");
  const [job, setJob] = useState(null);
  const [audioUrl, setAudioUrl] = useState("");
  const pollRef = useRef(null);
  const caster = CASTERS.find((item) => item.key === character) || CASTERS[0];
  const generatedNarration = useMemo(() => narrationFor(caster, bullets), [caster, bullets]);
  const narration = narrationOverride || generatedNarration;
  const ready = bullets.some((item) => item.trim()) && Boolean(narration.trim());

  useEffect(() => {
    checkLocal();
    return () => { if (pollRef.current) clearTimeout(pollRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateBullet(index, value) {
    setBullets((current) => current.map((item, i) => i === index ? value : item));
    setNarrationOverride("");
  }

  function buildPlan() {
    return {
      type: "boatstrikers_news", version: 1, format: "youtube_short_9x16", date, character,
      bullets: bullets.map((item) => item.trim()).filter(Boolean), narration,
      tts: { engine: "aivis", modelName: "まお", styleName: "おちつき", speakerId: 888753763, endpoint: "http://127.0.0.1:10101", speedScale: 1.08, intonationScale: 1.05 },
    };
  }

  async function localFetch(path, options = {}) {
    const response = await fetch(`${LOCAL}${path}`, { ...options, signal: AbortSignal.timeout(options.timeout || 10000) });
    if (!response.ok) { const detail = await response.json().catch(() => ({})); throw new Error(detail.error || `ローカル動画メーカーでエラーが発生しました（HTTP ${response.status}）。`); }
    return response;
  }

  async function checkLocal() {
    setChecking(true); setError("");
    try { const response = await localFetch("/health", { timeout: 4000 }); setHealth(await response.json()); }
    catch { setHealth(null); }
    finally { setChecking(false); }
  }

  async function previewVoice() {
    setError("");
    try {
      const response = await localFetch("/preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(buildPlan()), timeout: 120000 });
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      setAudioUrl(URL.createObjectURL(await response.blob()));
    } catch (e) { setError(e.message); }
  }

  async function pollJob(id, retries = 0) {
    try {
      const response = await localFetch(`/jobs/${id}`, { timeout: 30000 });
      const next = await response.json(); setJob(next);
      if (["queued", "running"].includes(next.status)) pollRef.current = setTimeout(() => pollJob(id), 1200);
      if (next.status === "error") setError(next.message);
    } catch (e) {
      if (retries < 10) pollRef.current = setTimeout(() => pollJob(id, retries + 1), 2500);
      else setError(e.message);
    }
  }

  async function renderVideo() {
    setError(""); setJob({ status: "queued", progress: 2, message: "生成リクエストを送信中" });
    try {
      const response = await localFetch("/jobs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(buildPlan()), timeout: 60000 });
      const next = await response.json(); setJob(next); pollJob(next.id);
    } catch (e) { setJob(null); setError(e.message); }
  }

  async function openOutput() { try { await localFetch(`/jobs/${job.id}/open`, { method: "POST", timeout: 5000 }); } catch (e) { setError(e.message); } }

  return <>
    <section className={styles.steps}><b>1 キャスター</b><span>→</span><b>2 ニュース入力</b><span>→</span><b>3 音声・MP4</b></section>
    <div className={styles.workspace}>
      <section className={styles.editor}>
        <div className={styles.sectionTitle}><span>STEP 1</span><h2>キャスターを選択</h2></div>
        <div className={styles.casters}>{CASTERS.map((item) => <button type="button" key={item.key} onClick={() => { setCharacter(item.key); setNarrationOverride(""); }} className={`${styles.caster} ${character === item.key ? styles.selected : ""}`}><Image src={item.image} alt={`${item.name}のニュース画面`} width={216} height={384} /><strong>{item.name}</strong><small>{item.label}</small></button>)}</div>

        <div className={styles.sectionTitle}><span>STEP 2</span><h2>ニュースを入力</h2></div>
        <label className={styles.date}><span>作成日</span><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <div className={styles.bulletInputs}>{bullets.map((item, index) => <label key={index}><b>{index + 1}</b><input value={item} maxLength={32} onChange={(e) => updateBullet(index, e.target.value)} placeholder={index === 0 ? "例：明日の注目レースは蒲郡10R" : "ニュースを短く入力（32文字まで）"} /><small>{item.length}/32</small></label>)}</div>
        <p className={styles.hint}>1項目18〜24文字程度がおすすめです。長い場合は動画側で文字を自動的に小さくします。</p>

        <div className={styles.sectionTitle}><span>STEP 3</span><h2>読み上げ原稿</h2></div>
        <textarea className={styles.script} value={narration} onChange={(e) => setNarrationOverride(e.target.value)} rows={8} />
        {narrationOverride && <button className={styles.reset} type="button" onClick={() => setNarrationOverride("")}>自動原稿に戻す</button>}
      </section>

      <aside className={styles.previewPanel}>
        <h2>動画プレビュー</h2>
        <div className={styles.sequence}><div><Image src="/news/templates/opening.jpg" alt="オープニング" width={108} height={192} /><span>OP 3秒</span></div><div className={styles.mainPreview}><Image src={caster.image} alt={caster.name} width={216} height={384} /><div className={styles.overlay}>{bullets.map((item, i) => <p key={i}>{item || `ニュース ${i + 1}`}</p>)}</div><span>{caster.name}</span></div><div><Image src="/news/templates/ending.jpg" alt="エンディング" width={108} height={192} /><span>END 4秒</span></div></div>
        <div className={styles.localBox}>
          <div className={styles.localHead}><h3>このパソコンで音声・MP4を生成</h3><button type="button" onClick={checkLocal}>接続を再確認</button></div>
          <div className={styles.badges}><span className={health?.companion ? styles.ok : styles.ng}>● ローカル動画メーカー {health?.companion ? "接続済み" : "未接続"}</span><span className={health?.aivis?.ok ? styles.ok : styles.ng}>● AivisSpeech {health?.aivis?.ok ? "接続済み" : "未接続"}</span><span className={health?.ffmpeg?.ok ? styles.ok : styles.ng}>● FFmpeg {health?.ffmpeg?.ok ? "準備完了" : "未確認"}</span></div>
          {!health && !checking && <p className={styles.help}>最新版のフォルダにある「start-shorts-maker.bat」を起動してください。</p>}
          <div className={styles.actions}><button type="button" disabled={!ready || !health?.aivis?.ok} onClick={previewVoice}>ナレーターを試聴</button><button type="button" className={styles.primary} disabled={!ready || !health?.aivis?.ok || !health?.ffmpeg?.ok || ["queued", "running"].includes(job?.status)} onClick={renderVideo}>ニュースMP4を生成</button></div>
          {audioUrl && <audio className={styles.audio} controls autoPlay src={audioUrl} />}
          {job && <div className={styles.progress}><div><span style={{ width: `${job.progress || 0}%` }} /></div><p>{job.message}</p>{job.status === "complete" && <button type="button" onClick={openOutput}>保存フォルダを開く</button>}</div>}
          {error && <p className={styles.error}>{error}</p>}
        </div>
      </aside>
    </div>
  </>;
}
