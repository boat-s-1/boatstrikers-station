"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import baseStyles from "./news.module.css";
import controlStyles from "./newsControls.module.css";
import errorStyles from "./newsError.module.css";

const styles = { ...baseStyles, ...controlStyles, ...errorStyles };

const LOCAL = "http://127.0.0.1:3210";
const CASTERS = [
  { key: "ichika", name: "一果", label: "イン逃げ", image: "/news/templates/ichika.jpg" },
  { key: "hatsune", name: "初音", label: "女子戦NEWS", image: "/news/templates/hatsune.jpg" },
  { key: "kiina", name: "キイナ", label: "穴レース", image: "/news/templates/kiina.jpg" },
];
const TEMPLATES = {
  ichika: [
    { key: "escape_top3", name: "イン逃げBEST3", source: "ichika_escape_best10", metric: "イン逃げ期待度", intro: "一果が、明日のイン逃げ注目レースを紹介します" },
    { key: "escape_focus", name: "注目イン戦ニュース", source: "ichika_escape_best10", metric: "イン逃げ期待度", intro: "一果が、前日データから注目のイン戦をお伝えします" },
    { key: "escape_check", name: "イン戦チェック", source: "ichika_escape_best10", metric: "AI期待度", intro: "一果と一緒に、明日のイン戦をチェックしましょう" },
  ],
  hatsune: [
    { key: "women_dominant", name: "女子戦本命BEST3", source: "hatsune_dominant_best3", metric: "女子戦本命度", intro: "初音が、明日の女子戦本命候補を紹介します" },
    { key: "women_risky", name: "女子戦波乱BEST3", source: "hatsune_risky_best3", metric: "波乱注目度", intro: "初音が、波乱に注意したい女子戦を紹介します" },
    { key: "women_news", name: "女子戦注目NEWS", source: "hatsune_dominant_best3", metric: "女子戦注目度", intro: "初音が、明日の女子戦ニュースをお届けします" },
  ],
  kiina: [
    { key: "boat5_top3", name: "5号艇穴候補BEST3", source: "kiina_boat5_best5", metric: "5号艇1着期待度", intro: "キイナが、明日の5号艇穴候補を紹介します" },
    { key: "hole_news", name: "穴レースNEWS", source: "kiina_boat5_best5", metric: "穴レース注目度", intro: "キイナが、前日データから穴レースをお届けします" },
    { key: "high_payout", name: "高配当注意報", source: "kiina_boat5_best5", metric: "高配当注目度", intro: "キイナが、明日の高配当注意レースを紹介します" },
  ],
};
const LENGTHS = [
  { key: "short", name: "短め", target: "100〜130文字", seconds: "約25〜30秒" },
  { key: "standard", name: "標準", target: "140〜180文字", seconds: "約30〜40秒" },
  { key: "detailed", name: "詳しく", target: "190〜240文字", seconds: "約40〜50秒" },
];

function pct(value) { const n = Number(value); return Number.isFinite(n) ? `${Math.round(n * 100)}%` : "—"; }
function compactName(value) { return String(value || "").replace(/[\s　]+/g, ""); }
function bulletFor(row, template) { return `${row.stadium}${row.race_no}R ${template.metric}${pct(row.probability)}`.slice(0, 32); }

function narrationFor(caster, template, bullets, lengthMode, selectedRows) {
  const valid = bullets.map((v) => v.trim()).filter(Boolean);
  if (!valid.length) return "";
  const details = valid.map((text, index) => {
    const row = selectedRows[index];
    const racerName = compactName(row?.racer?.racer_name);
    const order = index === 0 ? "最初" : index === valid.length - 1 ? "最後" : "続いて";
    if (lengthMode === "short") return `${index + 1}つ目、${text}。`;
    if (lengthMode === "detailed") {
      const person = racerName ? `${row.boatNo}号艇、${racerName}選手にも注目です。` : "直前気配にも注目です。";
      return `${order}のニュース、${text}。${person}`;
    }
    return `${order}は、${text}です。`;
  }).join("\n");
  const close = lengthMode === "short" ? "続きはBoatStrikersでチェック。" : lengthMode === "detailed" ? "前日予想は参考情報です。展示や進入も確認して、詳しくはBoatStrikersでチェックしてください。" : "詳しい出走表や直前情報は、BoatStrikersでチェックしてください。";
  const intro = lengthMode === "short" ? `深夜のBoatStrikersニュース。${caster.name}がお送りします。` : `深夜のBoatStrikersニュース。${caster.name}がお送りします。\n${template.intro}。`;
  return `${intro}\n${details}\n${close}`;
}

export default function NewsEditor({ initialDate, candidateSets, dataError }) {
  const [date, setDate] = useState(initialDate);
  const [character, setCharacter] = useState("ichika");
  const [templateKey, setTemplateKey] = useState(TEMPLATES.ichika[0].key);
  const [lengthMode, setLengthMode] = useState("standard");
  const [selectedIndexes, setSelectedIndexes] = useState([0, 1, 2]);
  const [bullets, setBullets] = useState(["", "", ""]);
  const [narrationOverride, setNarrationOverride] = useState("");
  const [health, setHealth] = useState(null);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");
  const [job, setJob] = useState(null);
  const [audioUrl, setAudioUrl] = useState("");
  const pollRef = useRef(null);
  const caster = CASTERS.find((item) => item.key === character) || CASTERS[0];
  const templates = TEMPLATES[character];
  const template = templates.find((item) => item.key === templateKey) || templates[0];
  const candidates = candidateSets?.[template.source] || [];
  const selectedRows = selectedIndexes.map((index) => candidates[index]).filter(Boolean);
  const generatedNarration = narrationFor(caster, template, bullets, lengthMode, selectedRows);
  const narration = narrationOverride || generatedNarration;
  const charCount = narration.replace(/\s/g, "").length;
  const estimatedSeconds = narration ? Math.round(charCount / 6.2) + 7 : 0;
  const ready = bullets.some((item) => item.trim()) && Boolean(narration.trim());

  useEffect(() => {
    checkLocal();
    return () => { if (pollRef.current) clearTimeout(pollRef.current); if (audioUrl) URL.revokeObjectURL(audioUrl); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function selectCharacter(next) { setCharacter(next); setTemplateKey(TEMPLATES[next][0].key); setSelectedIndexes([0, 1, 2]); setNarrationOverride(""); }
  function selectTemplate(next) { setTemplateKey(next); setSelectedIndexes([0, 1, 2]); setNarrationOverride(""); }
  function toggleCandidate(index) { setSelectedIndexes((current) => current.includes(index) ? current.filter((item) => item !== index) : current.length < 3 ? [...current, index] : current); }
  function applyPreviousDay() { const next = selectedRows.slice(0, 3).map((row) => bulletFor(row, template)); setBullets([...next, "", ""].slice(0, 3)); setNarrationOverride(""); }
  function updateBullet(index, value) { setBullets((current) => current.map((item, i) => i === index ? value : item)); setNarrationOverride(""); }

  function buildPlan() {
    return { type: "boatstrikers_news", version: 2, format: "youtube_short_9x16", date, character, template: template.key, lengthMode, bullets: bullets.map((item) => item.trim()).filter(Boolean), narration, tts: { engine: "aivis", modelName: "まお", styleName: "おちつき", speakerId: 888753763, endpoint: "http://127.0.0.1:10101", speedScale: 1.08, intonationScale: 1.05 } };
  }
  async function localFetch(path, options = {}) { const response = await fetch(`${LOCAL}${path}`, { ...options, signal: AbortSignal.timeout(options.timeout || 10000) }); if (!response.ok) { const detail = await response.json().catch(() => ({})); throw new Error(detail.error || `ローカル動画メーカーでエラーが発生しました（HTTP ${response.status}）。`); } return response; }
  async function checkLocal() { setChecking(true); setError(""); try { const response = await localFetch("/health", { timeout: 4000 }); setHealth(await response.json()); } catch { setHealth(null); } finally { setChecking(false); } }
  async function previewVoice() { setError(""); try { const response = await localFetch("/preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(buildPlan()), timeout: 120000 }); if (audioUrl) URL.revokeObjectURL(audioUrl); setAudioUrl(URL.createObjectURL(await response.blob())); } catch (e) { setError(e.message); } }
  async function pollJob(id, retries = 0) { try { const response = await localFetch(`/jobs/${id}`, { timeout: 30000 }); const next = await response.json(); setJob(next); if (["queued", "running"].includes(next.status)) pollRef.current = setTimeout(() => pollJob(id), 1200); if (next.status === "error") setError(next.message); } catch (e) { if (retries < 10) pollRef.current = setTimeout(() => pollJob(id, retries + 1), 2500); else setError(e.message); } }
  async function renderVideo() { setError(""); setJob({ status: "queued", progress: 2, message: "生成リクエストを送信中" }); try { const response = await localFetch("/jobs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(buildPlan()), timeout: 60000 }); const next = await response.json(); setJob(next); pollJob(next.id); } catch (e) { setJob(null); setError(e.message); } }
  async function openOutput() { try { await localFetch(`/jobs/${job.id}/open`, { method: "POST", timeout: 5000 }); } catch (e) { setError(e.message); } }

  return <>
    <section className={styles.steps}><b>1 前日版・キャスター</b><span>→</span><b>2 テンプレート・字幕</b><span>→</span><b>3 音声・MP4</b></section>
    <div className={styles.workspace}>
      <section className={styles.editor}>
        <div className={styles.sectionTitle}><span>STEP 1</span><h2>前日版とキャスター</h2></div>
        <form method="get" className={styles.loadForm}><label><span>予想対象日</span><input type="date" name="date" value={date} onChange={(e) => setDate(e.target.value)} /></label><button type="submit">前日版を読み込む</button></form>
        {dataError && <p className={styles.dataError}>取得エラー：{dataError}</p>}
        <div className={styles.casters}>{CASTERS.map((item) => <button type="button" key={item.key} onClick={() => selectCharacter(item.key)} className={`${styles.caster} ${character === item.key ? styles.selected : ""}`}><Image src={item.image} alt={`${item.name}のニュース画面`} width={216} height={384} /><strong>{item.name}</strong><small>{item.label}</small></button>)}</div>

        <div className={styles.sectionTitle}><span>STEP 2</span><h2>原稿テンプレート</h2></div>
        <div className={styles.templateGrid}>{templates.map((item) => <button type="button" key={item.key} className={template.key === item.key ? styles.templateSelected : ""} onClick={() => selectTemplate(item.key)}><strong>{item.name}</strong><small>{item.intro}</small></button>)}</div>
        <div className={styles.candidateHead}><h3>{initialDate} 前日版候補</h3><span>{candidates.length}件</span></div>
        {candidates.length ? <><div className={styles.candidates}>{candidates.map((row, index) => <button type="button" key={`${row.course_code}-${row.race_no}-${index}`} className={selectedIndexes.includes(index) ? styles.candidateSelected : ""} onClick={() => toggleCandidate(index)}><b>{row.rank_no}位</b><strong>{row.stadium} {row.race_no}R</strong><span>{template.metric} {pct(row.probability)}</span><small>{row.boatNo}号艇 {compactName(row.racer?.racer_name) || "選手名未取得"}</small></button>)}</div><button type="button" className={styles.applyButton} disabled={!selectedRows.length} onClick={applyPreviousDay}>選択した{selectedRows.length}件を字幕へ反映</button></> : <p className={styles.noData}>この日付・テンプレートの前日版候補はありません。下の欄へ手入力できます。</p>}

        <h3 className={styles.subheading}>字幕の3項目</h3>
        <div className={styles.bulletInputs}>{bullets.map((item, index) => <label key={index}><b>{index + 1}</b><input value={item} maxLength={32} onChange={(e) => updateBullet(index, e.target.value)} placeholder={index === 0 ? "例：明日の注目レースは蒲郡10R" : "ニュースを短く入力（32文字まで）"} /><small>{item.length}/32</small></label>)}</div>
        <p className={styles.hint}>1項目18〜24文字程度がおすすめです。長い場合は動画側で文字を自動縮小します。</p>

        <div className={styles.sectionTitle}><span>STEP 3</span><h2>読み上げ原稿</h2></div>
        <div className={styles.lengthGrid}>{LENGTHS.map((item) => <button type="button" key={item.key} className={lengthMode === item.key ? styles.lengthSelected : ""} onClick={() => { setLengthMode(item.key); setNarrationOverride(""); }}><strong>{item.name}</strong><span>{item.target}</span><small>{item.seconds}</small></button>)}</div>
        <div className={`${styles.counter} ${charCount > 250 ? styles.counterWarn : ""}`}><strong>{charCount}文字</strong><span>動画：約{estimatedSeconds || "—"}秒（OP・END込み）</span></div>
        <textarea className={styles.script} value={narration} onChange={(e) => setNarrationOverride(e.target.value)} rows={10} />
        {narrationOverride && <button className={styles.reset} type="button" onClick={() => setNarrationOverride("")}>自動原稿に戻す</button>}
      </section>

      <aside className={styles.previewPanel}>
        <h2>動画プレビュー</h2>
        <div className={styles.sequence}><div><Image src="/news/templates/opening.jpg" alt="オープニング" width={108} height={192} /><span>OP 3秒</span></div><div className={styles.mainPreview}><Image src={caster.image} alt={caster.name} width={216} height={384} /><div className={styles.overlay}>{bullets.map((item, i) => <p key={i}>{item || `ニュース ${i + 1}`}</p>)}</div><span>{caster.name}</span></div><div><Image src="/news/templates/ending.jpg" alt="エンディング" width={108} height={192} /><span>END 4秒</span></div></div>
        <div className={styles.localBox}><div className={styles.localHead}><h3>このパソコンで音声・MP4を生成</h3><button type="button" onClick={checkLocal}>接続を再確認</button></div><div className={styles.badges}><span className={health?.companion ? styles.ok : styles.ng}>● ローカル動画メーカー {health?.companion ? "接続済み" : "未接続"}</span><span className={health?.aivis?.ok ? styles.ok : styles.ng}>● AivisSpeech {health?.aivis?.ok ? "接続済み" : "未接続"}</span><span className={health?.ffmpeg?.ok ? styles.ok : styles.ng}>● FFmpeg {health?.ffmpeg?.ok ? "準備完了" : "未確認"}</span></div>{!health && !checking && <p className={styles.help}>最新版のフォルダにある「start-shorts-maker.bat」を起動してください。</p>}<div className={styles.actions}><button type="button" disabled={!ready || !health?.aivis?.ok} onClick={previewVoice}>ナレーターを試聴</button><button type="button" className={styles.primary} disabled={!ready || !health?.aivis?.ok || !health?.ffmpeg?.ok || ["queued", "running"].includes(job?.status)} onClick={renderVideo}>ニュースMP4を生成</button></div>{audioUrl && <audio className={styles.audio} controls autoPlay src={audioUrl} />}{job && <div className={styles.progress}><div><span style={{ width: `${job.progress || 0}%` }} /></div><p>{job.message}</p>{job.status === "error" && job.errorDetails && <pre className={styles.errorDetails}>{job.errorDetails}</pre>}{job.status === "error" && job.logPath && <p className={styles.logPath}>詳細ログ：{job.logPath}</p>}{job.status === "complete" && <button type="button" onClick={openOutput}>保存フォルダを開く</button>}</div>}{error && <p className={styles.error}>{error}</p>}</div>
      </aside>
    </div>
  </>;
}
